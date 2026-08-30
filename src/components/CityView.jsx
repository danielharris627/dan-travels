import { useEffect, useRef, useState } from 'react'
import { formatInTimeZone, toZonedTime } from 'date-fns-tz'
import { supabase } from '../lib/supabaseClient'
import TagPicker from './TagPicker'
import PlaceRow from './PlaceRow'
import DayNotes from './DayNotes'
import OtherNotes from './OtherNotes'

function getDayList(cityStop) {
  const tz = cityStop.timezone || 'America/New_York'
  const startLocal = toZonedTime(cityStop.start_at, tz)
  const endLocal = toZonedTime(cityStop.end_at, tz)
  const days = []
  const cursor = new Date(startLocal.getFullYear(), startLocal.getMonth(), startLocal.getDate())
  const endDate = new Date(endLocal.getFullYear(), endLocal.getMonth(), endLocal.getDate())
  while (cursor <= endDate) {
    const y = cursor.getFullYear()
    const m = String(cursor.getMonth() + 1).padStart(2, '0')
    const d = String(cursor.getDate()).padStart(2, '0')
    days.push({ dateStr: `${y}-${m}-${d}`, label: cursor.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }) })
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function formatDateHeader(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function CityView({ cityStop, view }) {
  const [tags, setTags] = useState([])
  const [allPlaces, setAllPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [tagFilter, setTagFilter] = useState(null)
  const [sortMode, setSortMode] = useState('title') // 'title' | 'area' | 'borough' | 'distance'
  const [sortBorough, setSortBorough] = useState(null)
  const [sortArea, setSortArea] = useState(null)
  const [userLocation, setUserLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [addFormOpen, setAddFormOpen] = useState(false)
  const [tagPickerOpen, setTagPickerOpen] = useState(true)
  const [selectedBorough, setSelectedBorough] = useState(null)
  const [selectedArea, setSelectedArea] = useState(null)
  const [areaTagFilter, setAreaTagFilter] = useState(null)
  const [hiddenAreas, setHiddenAreas] = useState([])
  const [showHiddenAreas, setShowHiddenAreas] = useState(false)

  const dayList = getDayList(cityStop)
  const todayStr = formatInTimeZone(new Date(), cityStop.timezone || 'America/New_York', 'yyyy-MM-dd')
  const defaultDay = dayList.find((d) => d.dateStr === todayStr)?.dateStr || dayList[0]?.dateStr || null
  const [selectedDay, setSelectedDay] = useState(defaultDay)

  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [formTags, setFormTags] = useState([])
  const [linkHint, setLinkHint] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const notesRef = useRef(null)

  useEffect(() => {
    loadTags()
  }, [])

  useEffect(() => {
    loadPlaces()
    loadHiddenAreas()
    setSelectedDay(defaultDay)
    setSelectedBorough(null)
    setSelectedArea(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityStop?.id])

  async function loadTags() {
    const { data, error: tagError } = await supabase.from('tags').select('*').order('sort_order', { ascending: true }).order('label', { ascending: true })
    if (tagError) setError(tagError.message)
    else setTags(data ?? [])
  }

  async function loadPlaces() {
    if (!cityStop) return
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.from('places').select('*').eq('city_stop_id', cityStop.id).order('sort_order', { ascending: true })
    if (fetchError) setError(fetchError.message)
    else setAllPlaces(data ?? [])
    setLoading(false)
  }

  async function loadHiddenAreas() {
    if (!cityStop) return
    const { data, error: hiddenError } = await supabase.from('hidden_areas').select('area').eq('city_stop_id', cityStop.id)
    if (hiddenError) setError(hiddenError.message)
    else setHiddenAreas((data ?? []).map((r) => r.area))
    setShowHiddenAreas(false)
  }

  const tagLookup = Object.fromEntries(tags.map((t) => [t.label, t.icon]))
  const tagLabelsInUse = new Set(allPlaces.flatMap((p) => p.tags || []))
  const tagsInThisCity = tags.filter((t) => tagLabelsInUse.has(t.label))

  const otherItems = allPlaces.filter((p) => p.in_itinerary && !p.scheduled_date)
  const itineraryByDate = {}
  for (const item of allPlaces.filter((p) => p.scheduled_date)) {
    if (!itineraryByDate[item.scheduled_date]) itineraryByDate[item.scheduled_date] = []
    itineraryByDate[item.scheduled_date].push(item)
  }
  for (const date in itineraryByDate) {
    itineraryByDate[date].sort((a, b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'))
  }

  const placesByTag = tagFilter === '__all__' ? allPlaces : tagFilter ? allPlaces.filter((p) => p.tags?.includes(tagFilter)) : []
  const sortBoroughOptions = [...new Set(placesByTag.map((p) => p.borough).filter(Boolean))].sort()
  const sortAreaOptions = [...new Set(placesByTag.map((p) => p.area).filter(Boolean))].sort()

  const placesFiltered = (() => {
    if (!tagFilter) return []
    let list = placesByTag
    if (sortMode === 'borough') {
      if (!sortBorough) return []
      list = list.filter((p) => p.borough === sortBorough)
    } else if (sortMode === 'area') {
      if (!sortArea) return []
      list = list.filter((p) => p.area === sortArea)
    }

    const sorted = [...list]
    if (sortMode === 'title' || sortMode === 'borough' || sortMode === 'area') {
      sorted.sort((a, b) => a.title.localeCompare(b.title))
    } else if (sortMode === 'distance' && userLocation) {
      const dist = (p) => {
        if (!p.lat || !p.lng) return Infinity
        const R = 6371
        const dLat = ((p.lat - userLocation.lat) * Math.PI) / 180
        const dLng = ((p.lng - userLocation.lng) * Math.PI) / 180
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos((userLocation.lat * Math.PI) / 180) * Math.cos((p.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
      }
      sorted.sort((a, b) => dist(a) - dist(b))
    }
    return sorted
  })()

  function handleSortChange(mode) {
    setSortMode(mode)
    setSortBorough(null)
    setSortArea(null)
    if (mode === 'distance' && !userLocation) {
      setLocationError(null)
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => setLocationError("Couldn't get your location — check browser permissions.")
      )
    }
  }

  const boroughOptions = [...new Set(allPlaces.map((p) => p.borough).filter(Boolean))].sort()
  const effectiveBorough = boroughOptions.length === 1 ? boroughOptions[0] : selectedBorough
  const areaOptionsInBorough = effectiveBorough
    ? [...new Set(allPlaces.filter((p) => p.borough === effectiveBorough).map((p) => p.area).filter(Boolean))].sort()
    : []
  const visibleAreaOptions = areaOptionsInBorough.filter((a) => !hiddenAreas.includes(a))
  const displayedAreaOptions = showHiddenAreas ? areaOptionsInBorough : visibleAreaOptions
  const areaFiltered = selectedArea ? allPlaces.filter((p) => p.area === selectedArea) : []
  const areaTagOptions = [...new Set(areaFiltered.flatMap((p) => p.tags || []))].sort()
  const areaFilteredByTag = areaTagFilter ? areaFiltered.filter((p) => p.tags?.includes(areaTagFilter)) : areaFiltered

  function handleAreaClick(label) {
    setSelectedArea((prev) => (prev === label ? null : label))
    setAreaTagFilter(null)
  }

  async function handleToggleHideArea(areaName) {
    const isHidden = hiddenAreas.includes(areaName)
    if (isHidden) {
      setHiddenAreas((prev) => prev.filter((a) => a !== areaName))
      const { error: deleteError } = await supabase.from('hidden_areas').delete().eq('city_stop_id', cityStop.id).eq('area', areaName)
      if (deleteError) setError(deleteError.message)
    } else {
      setHiddenAreas((prev) => [...prev, areaName])
      if (selectedArea === areaName) setSelectedArea(null)
      const { error: insertError } = await supabase.from('hidden_areas').insert({ city_stop_id: cityStop.id, area: areaName })
      if (insertError) setError(insertError.message)
    }
  }

  async function handleCreateTag(label, icon) {
    const nextOrder = tags.length > 0 ? Math.max(...tags.map((t) => t.sort_order ?? 0)) + 1 : 0
    const { data, error: insertError } = await supabase.from('tags').insert({ label, icon, sort_order: nextOrder }).select().single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTags((prev) => [...prev, data])
    setFormTags((prev) => [...prev, label])
  }

  async function handleUpdateTag(tag, newLabel, newIcon) {
    const labelChanged = newLabel !== tag.label
    const { error: updateError } = await supabase.from('tags').update({ label: newLabel, icon: newIcon }).eq('id', tag.id)
    if (updateError) {
      setError(updateError.message)
      return
    }
    if (labelChanged) {
      const { data: affected, error: fetchError } = await supabase.from('places').select('id, tags').contains('tags', [tag.label])
      if (fetchError) {
        setError(fetchError.message)
      } else if (affected?.length) {
        await Promise.all(
          affected.map((row) => {
            const newTags = row.tags.map((t) => (t === tag.label ? newLabel : t))
            return supabase.from('places').update({ tags: newTags }).eq('id', row.id)
          })
        )
      }
      setFormTags((prev) => prev.map((l) => (l === tag.label ? newLabel : l)))
      setTagFilter((prev) => (prev === tag.label ? newLabel : prev))
    }
    await loadTags()
    await loadPlaces()
  }

  async function handleDeleteTag(tag) {
    const confirmed = window.confirm(`Delete "${tag.label}"? Places already tagged with it keep the label but lose the icon match.`)
    if (!confirmed) return
    const { error: deleteError } = await supabase.from('tags').delete().eq('id', tag.id)
    if (deleteError) {
      setError(deleteError.message)
      return
    }
    setTags((prev) => prev.filter((t) => t.id !== tag.id))
    setFormTags((prev) => prev.filter((l) => l !== tag.label))
    setTagFilter((prev) => (prev === tag.label ? null : prev))
  }

  async function handleMoveTag(tag, direction) {
    const index = tags.findIndex((t) => t.id === tag.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= tags.length) return
    const other = tags[swapIndex]
    const reordered = [...tags]
    reordered[index] = other
    reordered[swapIndex] = tag
    setTags(reordered)
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('tags').update({ sort_order: other.sort_order }).eq('id', tag.id),
      supabase.from('tags').update({ sort_order: tag.sort_order }).eq('id', other.id),
    ])
    if (e1 || e2) setError((e1 || e2).message)
  }

  function toggleFormTag(label) {
    setFormTags((prev) => (prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label]))
  }

  function handleAddLink() {
    const textarea = notesRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selectedText = value.slice(selectionStart, selectionEnd)
    if (!selectedText) {
      setLinkHint('Select some text in the notes first, then click Link.')
      return
    }
    const url = window.prompt('Link URL:', 'https://')
    if (!url) return
    const newValue = value.slice(0, selectionStart) + `[${selectedText}](${url})` + value.slice(selectionEnd)
    setNotes(newValue)
    setLinkHint(null)
  }

  async function handleAdd(e) {
    e.preventDefault()
    const trimmedTitle = title.trim()
    if (!trimmedTitle || submitting || !cityStop) return
    setSubmitting(true)
    const nextOrder = allPlaces.length > 0 ? Math.max(...allPlaces.map((p) => p.sort_order ?? 0)) + 1 : 0
    const { data, error: insertError } = await supabase
      .from('places')
      .insert({
        city_stop_id: cityStop.id,
        title: trimmedTitle,
        area: area.trim() || null,
        notes: notes.trim() || null,
        tags: formTags,
        maps_url: mapsLink.trim() || null,
        sort_order: nextOrder,
      })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
    } else if (data) {
      setAllPlaces((prev) => [...prev, data])
      setTitle('')
      setArea('')
      setNotes('')
      setMapsLink('')
      setFormTags([])
      setLinkHint(null)
    }
    setSubmitting(false)
  }

  async function handleUpdatePlace(item, patch) {
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, ...patch } : p)))
    const { error: updateError } = await supabase.from('places').update(patch).eq('id', item.id)
    if (updateError) setError(updateError.message)
  }

  async function handleRemove(item) {
    setAllPlaces((prev) => prev.filter((p) => p.id !== item.id))
    const { error: deleteError } = await supabase.from('places').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
  }

  async function handleRemoveFromItinerary(item) {
    const patch = { in_itinerary: false, scheduled_date: null, scheduled_time: null }
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, ...patch } : p)))
    const { error: updateError } = await supabase.from('places').update(patch).eq('id', item.id)
    if (updateError) setError(updateError.message)
  }

  async function handleAddToItinerary(item) {
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, in_itinerary: true } : p)))
    const { error: updateError } = await supabase.from('places').update({ in_itinerary: true }).eq('id', item.id)
    if (updateError) setError(updateError.message)
  }

  async function handleSchedule(item, date, time) {
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, scheduled_date: date, scheduled_time: time } : p)))
    const { error: updateError } = await supabase.from('places').update({ scheduled_date: date, scheduled_time: time }).eq('id', item.id)
    if (updateError) setError(updateError.message)
    else setSelectedDay(date)
  }

  async function handleUnschedule(item) {
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, scheduled_date: null, scheduled_time: null } : p)))
    const { error: updateError } = await supabase.from('places').update({ scheduled_date: null, scheduled_time: null }).eq('id', item.id)
    if (updateError) setError(updateError.message)
    else setSelectedDay('other')
  }

  async function handleMoveOther(item, direction) {
    const index = otherItems.findIndex((i) => i.id === item.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= otherItems.length) return
    const other = otherItems[swapIndex]
    setAllPlaces((prev) =>
      prev.map((p) => {
        if (p.id === item.id) return { ...p, sort_order: other.sort_order }
        if (p.id === other.id) return { ...p, sort_order: item.sort_order }
        return p
      })
    )
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from('places').update({ sort_order: other.sort_order }).eq('id', item.id),
      supabase.from('places').update({ sort_order: item.sort_order }).eq('id', other.id),
    ])
    if (e1 || e2) setError((e1 || e2).message)
  }

  if (!cityStop) return null

  return (
    <div>
      {error && <p className="mb-3 font-mono text-xs text-stamp">{error}</p>}

      {view === 'itinerary' && (
        <>
          <div className="mb-4 flex flex-wrap gap-2">
            {dayList.map((d) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setSelectedDay(d.dateStr)}
                className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                  selectedDay === d.dateStr ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                }`}
              >
                {d.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelectedDay('other')}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                selectedDay === 'other' ? 'border-gold bg-gold text-paper' : 'border-line bg-card text-ink/60 hover:border-gold hover:text-ink'
              }`}
            >
              📝 Other
            </button>
          </div>

          {selectedDay && selectedDay !== 'other' && (
            <p className="mb-2 font-display text-base font-semibold text-teal">{formatDateHeader(selectedDay)}</p>
          )}
          {selectedDay && selectedDay !== 'other' && <DayNotes cityStopId={cityStop.id} date={selectedDay} />}
          {selectedDay === 'other' && <OtherNotes cityStopId={cityStop.id} />}
          {selectedDay && selectedDay !== 'other' && (
            <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/40">Scheduled places</p>
          )}

          {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}

          {!loading && selectedDay === 'other' && (
            <>
              {otherItems.length === 0 && (
                <p className="py-6 text-center font-body text-sm text-ink/40 rounded-lg border border-dashed border-line">
                  Nothing added yet. Go to Places or Areas and use "+ Add to itinerary" on things you've decided on.
                </p>
              )}
              {otherItems.map((item, idx) => (
                <PlaceRow
                  key={item.id}
                  item={item}
                  tagLookup={tagLookup}
                  mode="other"
                  dayList={dayList}
                  showReorder
                  onMoveUp={idx > 0 ? () => handleMoveOther(item, 'up') : null}
                  onMoveDown={idx < otherItems.length - 1 ? () => handleMoveOther(item, 'down') : null}
                  onRemove={handleRemoveFromItinerary}
                  onSchedule={handleSchedule}
                  onUpdate={handleUpdatePlace}
                />
              ))}
            </>
          )}

          {!loading && selectedDay !== 'other' && selectedDay && (
            <>
              {(!itineraryByDate[selectedDay] || itineraryByDate[selectedDay].length === 0) && (
                <p className="py-6 text-center font-body text-sm text-ink/40 rounded-lg border border-dashed border-line">
                  Nothing scheduled yet — schedule something from Other to see it here.
                </p>
              )}
              {itineraryByDate[selectedDay]?.map((item) => (
                <PlaceRow key={item.id} item={item} tagLookup={tagLookup} mode="scheduled" showReorder={false} onRemove={handleRemoveFromItinerary} onUnschedule={handleUnschedule} onUpdate={handleUpdatePlace} />
              ))}
            </>
          )}
        </>
      )}

      {view === 'areas' && (
        <>
          {boroughOptions.length === 0 ? (
            <p className="py-6 text-center font-body text-sm text-ink/40">No areas yet — add places with an area on the Places tab.</p>
          ) : (
            <>
              {boroughOptions.length > 1 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {boroughOptions.map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => {
                        setSelectedBorough((prev) => (prev === b ? null : b))
                        setSelectedArea(null)
                      }}
                      className={`rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                        selectedBorough === b ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                      }`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              )}

              {effectiveBorough && (
                <>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {displayedAreaOptions.map((a) => {
                      const isActive = selectedArea === a
                      const isHidden = hiddenAreas.includes(a)
                      return (
                        <div key={a} className="group relative">
                          <button
                            type="button"
                            onClick={() => handleAreaClick(a)}
                            className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                              isHidden
                                ? 'border-dashed border-line/70 bg-transparent text-ink/30'
                                : isActive
                                ? 'border-gold bg-gold text-paper'
                                : 'border-line bg-card text-ink/50 hover:border-gold hover:text-ink'
                            }`}
                          >
                            📍 {a}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleToggleHideArea(a)
                            }}
                            aria-label={isHidden ? `Unhide ${a}` : `Hide ${a}`}
                            className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-paper group-hover:flex"
                          >
                            {isHidden ? '+' : '✕'}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  {hiddenAreas.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowHiddenAreas((s) => !s)}
                      className="mb-4 block font-mono text-[10px] uppercase tracking-wide text-ink/40 underline decoration-dotted underline-offset-2 hover:text-ink"
                    >
                      {showHiddenAreas ? 'Hide hidden areas again' : `Show hidden areas (${hiddenAreas.length})`}
                    </button>
                  )}
                </>
              )}

              {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}
              {!loading && !effectiveBorough && <p className="py-6 text-center font-body text-sm text-ink/40">Select a borough above.</p>}
              {!loading && effectiveBorough && !selectedArea && <p className="py-6 text-center font-body text-sm text-ink/40">Select an area above.</p>}

              {selectedArea && areaTagOptions.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Category:</span>
                  <select
                    value={areaTagFilter || ''}
                    onChange={(e) => setAreaTagFilter(e.target.value || null)}
                    className="rounded-md border border-line bg-card px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                  >
                    <option value="">All</option>
                    {areaTagOptions.map((label) => (
                      <option key={label} value={label}>
                        {tagLookup[label] ?? ''} {label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {!loading && selectedArea && areaFilteredByTag.length === 0 && <p className="py-6 text-center font-body text-sm text-ink/40">Nothing saved here yet.</p>}
              {!loading &&
                selectedArea &&
                areaFilteredByTag.map((item) => (
                  <PlaceRow key={item.id} item={item} tagLookup={tagLookup} mode="reference" showReorder={false} onRemove={handleRemove} onAddToItinerary={handleAddToItinerary} onUpdate={handleUpdatePlace} />
                ))}
            </>
          )}
        </>
      )}

      {view === 'places' && (
        <>
          <button
            type="button"
            onClick={() => setAddFormOpen((o) => !o)}
            className="mb-3 rounded-full border border-dashed border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-ink/50 hover:border-teal hover:text-ink"
          >
            {addFormOpen ? '− Hide add-place form' : '+ Add a place'}
          </button>

          {addFormOpen && (
          <form onSubmit={handleAdd} className="mb-6 rounded-lg border border-line bg-card p-3">
            <div className="flex gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Add a place…"
                className="flex-1 rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
              />
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="flex-shrink-0 rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                Add
              </button>
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen((open) => !open)}
              className="mt-2 font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
            >
              {detailsOpen ? 'Hide details' : '+ Add area, notes, or tags'}
              {!detailsOpen && formTags.length > 0 && ` (${formTags.length} tag${formTags.length === 1 ? '' : 's'})`}
            </button>
            {detailsOpen && (
              <div className="mt-3 space-y-3">
                <input
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="Area (optional) — e.g. Greenwich Village"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                />
                <input
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                  placeholder="Google Maps link (optional)"
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                />
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Notes</span>
                    <button type="button" onClick={handleAddLink} className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-teal hover:border-teal">
                      🔗 Link
                    </button>
                  </div>
                  <textarea
                    ref={notesRef}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value)
                      setLinkHint(null)
                    }}
                    placeholder="Notes… select text and hit Link to turn it into a hyperlink"
                    rows={3}
                    className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
                  />
                  {linkHint && <p className="mt-1 font-mono text-[10px] text-stamp">{linkHint}</p>}
                </div>
                <div>
                  <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-ink/40">Tags — a place can have more than one</span>
                  <TagPicker tags={tags} selected={formTags} onToggle={toggleFormTag} onCreateTag={handleCreateTag} onUpdateTag={handleUpdateTag} onDeleteTag={handleDeleteTag} onMoveTag={handleMoveTag} allowManage />
                </div>
              </div>
            )}
          </form>
          )}

          {tags.length > 0 && (
            <button
              type="button"
              onClick={() => setTagPickerOpen((o) => !o)}
              className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/40 underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              {tagPickerOpen ? '− Collapse categories' : '+ Show categories'}
            </button>
          )}

          {tagPickerOpen && (
            <div className="mb-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setTagFilter((prev) => (prev === '__all__' ? null : '__all__'))}
                className={`rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                  tagFilter === '__all__' ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                }`}
              >
                ⭐ All
              </button>
              {tagsInThisCity.map((opt) => {
                const isActive = tagFilter === opt.label
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTagFilter((prev) => (prev === opt.label ? null : opt.label))}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                      isActive ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                    }`}
                  >
                    <span aria-hidden="true">{opt.icon}</span>
                    {opt.label}
                  </button>
                )
              })}
            </div>
          )}

          {!tagPickerOpen && tagFilter && (
            <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink/50">
              Showing: {tagFilter === '__all__' ? '⭐ All' : `${tagLookup[tagFilter] ?? ''} ${tagFilter}`}
            </p>
          )}

          {tagFilter && (
            <div className="mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Sort:</span>
                <select
                  value={sortMode}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="rounded-md border border-line bg-card px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                >
                  <option value="title">Alphabetical</option>
                  <option value="borough">By borough</option>
                  <option value="area">By area</option>
                  <option value="distance">Closest to me</option>
                </select>
                {locationError && <span className="font-mono text-[10px] text-stamp">{locationError}</span>}
              </div>

              {sortMode === 'borough' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Borough:</span>
                  <select
                    value={sortBorough || ''}
                    onChange={(e) => setSortBorough(e.target.value || null)}
                    className="rounded-md border border-line bg-card px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                  >
                    <option value="" disabled>
                      Select a borough…
                    </option>
                    {sortBoroughOptions.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {sortMode === 'area' && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Area:</span>
                  <select
                    value={sortArea || ''}
                    onChange={(e) => setSortArea(e.target.value || null)}
                    className="rounded-md border border-line bg-card px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                  >
                    <option value="" disabled>
                      Select an area…
                    </option>
                    {sortAreaOptions.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}
          {!loading && !tagFilter && <p className="py-6 text-center font-body text-sm text-ink/40 rounded-lg border border-dashed border-line">Select a category above.</p>}
          {!loading && tagFilter && placesFiltered.length === 0 && <p className="py-6 text-center font-body text-sm text-ink/40 rounded-lg border border-dashed border-line">Nothing here yet.</p>}
          {!loading &&
            tagFilter &&
            placesFiltered.map((item) => (
              <PlaceRow key={item.id} item={item} tagLookup={tagLookup} mode="reference" showReorder={false} onRemove={handleRemove} onAddToItinerary={handleAddToItinerary} onUpdate={handleUpdatePlace} />
            ))}
        </>
      )}
    </div>
  )
}
