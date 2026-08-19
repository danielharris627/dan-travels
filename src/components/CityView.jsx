import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import TagPicker from './TagPicker'
import PlaceRow from './PlaceRow'

function formatDateHeader(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`)
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

export default function CityView({ cityStop }) {
  const [tags, setTags] = useState([])
  const [allPlaces, setAllPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [view, setView] = useState('itinerary') // 'itinerary' | 'ideas'
  const [tagFilter, setTagFilter] = useState(null) // tag label | 'Done' | null
  const [areaFilter, setAreaFilter] = useState(null)
  const [hiddenAreas, setHiddenAreas] = useState([])
  const [showHiddenAreas, setShowHiddenAreas] = useState(false)

  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [notes, setNotes] = useState('')
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
  }, [cityStop?.id])

  async function loadHiddenAreas() {
    if (!cityStop) return
    const { data, error: hiddenError } = await supabase
      .from('hidden_areas')
      .select('area')
      .eq('city_stop_id', cityStop.id)
    if (hiddenError) setError(hiddenError.message)
    else setHiddenAreas((data ?? []).map((r) => r.area))
    setShowHiddenAreas(false)
  }

  async function loadTags() {
    const { data, error: tagError } = await supabase
      .from('tags')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('label', { ascending: true })
    if (tagError) setError(tagError.message)
    else setTags(data ?? [])
  }

  async function loadPlaces() {
    if (!cityStop) return
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('places')
      .select('*')
      .eq('city_stop_id', cityStop.id)
      .order('sort_order', { ascending: true })

    if (fetchError) setError(fetchError.message)
    else setAllPlaces(data ?? [])
    setLoading(false)
  }

  const tagLookup = Object.fromEntries(tags.map((t) => [t.label, t.icon]))
  const areaOptions = [...new Set(allPlaces.map((p) => p.area).filter(Boolean))].sort()
  const visibleAreaOptions = areaOptions.filter((a) => !hiddenAreas.includes(a))
  const displayedAreaOptions = showHiddenAreas ? areaOptions : visibleAreaOptions

  const isDoneView = tagFilter === 'Done'
  const filtered = allPlaces.filter((p) => {
    const statusOk = isDoneView ? p.status === 'done' : p.status === 'active'
    if (!statusOk) return false
    if (tagFilter && !isDoneView && !p.tags?.includes(tagFilter)) return false
    if (areaFilter && p.area !== areaFilter) return false
    return true
  })

  const ideaItems = filtered.filter((p) => !p.scheduled_date)
  const itineraryItems = filtered.filter((p) => p.scheduled_date)
  const itineraryByDate = {}
  for (const item of itineraryItems) {
    if (!itineraryByDate[item.scheduled_date]) itineraryByDate[item.scheduled_date] = []
    itineraryByDate[item.scheduled_date].push(item)
  }
  for (const date in itineraryByDate) {
    itineraryByDate[date].sort((a, b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'))
  }
  const sortedDates = Object.keys(itineraryByDate).sort()

  function handleFilterClick(label) {
    setTagFilter((prev) => (prev === label ? null : label))
  }

  function handleAreaClick(label) {
    setAreaFilter((prev) => (prev === label ? null : label))
  }

  async function handleToggleHideArea(area) {
    const isHidden = hiddenAreas.includes(area)

    if (isHidden) {
      setHiddenAreas((prev) => prev.filter((a) => a !== area))
      const { error: deleteError } = await supabase
        .from('hidden_areas')
        .delete()
        .eq('city_stop_id', cityStop.id)
        .eq('area', area)
      if (deleteError) setError(deleteError.message)
    } else {
      setHiddenAreas((prev) => [...prev, area])
      if (areaFilter === area) setAreaFilter(null)
      const { error: insertError } = await supabase
        .from('hidden_areas')
        .insert({ city_stop_id: cityStop.id, area })
      if (insertError) setError(insertError.message)
    }
  }

  async function handleCreateTag(label, icon) {
    const nextOrder = tags.length > 0 ? Math.max(...tags.map((t) => t.sort_order ?? 0)) + 1 : 0
    const { data, error: insertError } = await supabase
      .from('tags')
      .insert({ label, icon, sort_order: nextOrder })
      .select()
      .single()
    if (insertError) {
      setError(insertError.message)
      return
    }
    setTags((prev) => [...prev, data])
    setFormTags((prev) => [...prev, label])
  }

  async function handleUpdateTag(tag, newLabel, newIcon) {
    const labelChanged = newLabel !== tag.label
    const { error: updateError } = await supabase
      .from('tags')
      .update({ label: newLabel, icon: newIcon })
      .eq('id', tag.id)
    if (updateError) {
      setError(updateError.message)
      return
    }

    if (labelChanged) {
      const { data: affected, error: fetchError } = await supabase
        .from('places')
        .select('id, tags')
        .contains('tags', [tag.label])

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
    const confirmed = window.confirm(
      `Delete "${tag.label}"? Places already tagged with it keep the label but lose the icon match.`
    )
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
      setFormTags([])
      setLinkHint(null)
    }
    setSubmitting(false)
  }

  async function handleToggle(item) {
    const nextStatus = item.status === 'done' ? 'active' : 'done'
    const completed_at = nextStatus === 'done' ? new Date().toISOString() : null
    setAllPlaces((prev) => prev.map((p) => (p.id === item.id ? { ...p, status: nextStatus, completed_at } : p)))

    const { error: updateError } = await supabase
      .from('places')
      .update({ status: nextStatus, completed_at })
      .eq('id', item.id)
    if (updateError) setError(updateError.message)
  }

  async function handleRemove(item) {
    setAllPlaces((prev) => prev.filter((p) => p.id !== item.id))
    const { error: deleteError } = await supabase.from('places').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
  }

  async function handleSchedule(item, date, time) {
    setAllPlaces((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, scheduled_date: date, scheduled_time: time } : p))
    )
    const { error: updateError } = await supabase
      .from('places')
      .update({ scheduled_date: date, scheduled_time: time })
      .eq('id', item.id)
    if (updateError) setError(updateError.message)
    else setView('itinerary')
  }

  async function handleUnschedule(item) {
    setAllPlaces((prev) =>
      prev.map((p) => (p.id === item.id ? { ...p, scheduled_date: null, scheduled_time: null } : p))
    )
    const { error: updateError } = await supabase
      .from('places')
      .update({ scheduled_date: null, scheduled_time: null })
      .eq('id', item.id)
    if (updateError) setError(updateError.message)
  }

  async function handleMove(item, direction) {
    const index = ideaItems.findIndex((i) => i.id === item.id)
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= ideaItems.length) return
    const other = ideaItems[swapIndex]

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

  const tagFilterOptions = [...tags, { id: '__done__', label: 'Done', icon: '✅' }]

  return (
    <div>
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
              list="area-suggestions"
              className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <datalist id="area-suggestions">
              {areaOptions.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">Notes</span>
                <button
                  type="button"
                  onClick={handleAddLink}
                  className="rounded-full border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-teal hover:border-teal"
                >
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
              <span className="mb-1.5 block font-mono text-[10px] uppercase tracking-wide text-ink/40">
                Tags — a place can have more than one
              </span>
              <TagPicker
                tags={tags}
                selected={formTags}
                onToggle={toggleFormTag}
                onCreateTag={handleCreateTag}
                onUpdateTag={handleUpdateTag}
                onDeleteTag={handleDeleteTag}
                onMoveTag={handleMoveTag}
                allowManage
              />
            </div>
          </div>
        )}
      </form>

      <div className="mb-3 flex w-fit gap-1 rounded-full bg-line/40 p-1">
        {[
          { key: 'itinerary', label: 'Itinerary' },
          { key: 'ideas', label: 'Ideas' },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
              view === v.key ? 'bg-card text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex flex-wrap gap-2">
        {tagFilterOptions.map((opt) => {
          const isActive = tagFilter === opt.label
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleFilterClick(opt.label)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                isActive
                  ? 'border-teal bg-teal text-paper'
                  : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
              }`}
            >
              <span aria-hidden="true">{opt.icon}</span>
              {opt.label}
            </button>
          )
        })}
      </div>

      {areaOptions.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-2">
            {displayedAreaOptions.map((a) => {
              const isActive = areaFilter === a
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
              className="mt-2 font-mono text-[10px] uppercase tracking-wide text-ink/40 underline decoration-dotted underline-offset-2 hover:text-ink"
            >
              {showHiddenAreas ? 'Hide hidden areas again' : `Show hidden areas (${hiddenAreas.length})`}
            </button>
          )}
        </div>
      )}

      <div className="rounded-lg border border-line bg-card px-4">
        {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}
        {error && <p className="py-4 font-mono text-xs text-stamp">{error}</p>}

        {!loading && !error && view === 'ideas' && (
          <>
            {ideaItems.length === 0 && (
              <p className="py-6 text-center font-body text-sm text-ink/40">
                {isDoneView ? 'Nothing marked done yet.' : 'Nothing here yet. Add a place above.'}
              </p>
            )}
            {ideaItems.map((item, idx) => (
              <PlaceRow
                key={item.id}
                item={item}
                tagLookup={tagLookup}
                showReorder={!isDoneView}
                onMoveUp={!isDoneView && idx > 0 ? () => handleMove(item, 'up') : null}
                onMoveDown={!isDoneView && idx < ideaItems.length - 1 ? () => handleMove(item, 'down') : null}
                onToggle={handleToggle}
                onRemove={handleRemove}
                onSchedule={handleSchedule}
                onUnschedule={handleUnschedule}
              />
            ))}
          </>
        )}

        {!loading && !error && view === 'itinerary' && (
          <>
            {sortedDates.length === 0 && (
              <p className="py-6 text-center font-body text-sm text-ink/40">
                {isDoneView ? 'Nothing marked done yet.' : 'Nothing scheduled yet — schedule an idea to see it here.'}
              </p>
            )}
            {sortedDates.map((date) => (
              <div key={date} className="border-b border-line py-2 last:border-b-0">
                <p className="px-1 py-2 font-display text-sm font-semibold text-teal">{formatDateHeader(date)}</p>
                {itineraryByDate[date].map((item) => (
                  <PlaceRow
                    key={item.id}
                    item={item}
                    tagLookup={tagLookup}
                    showReorder={false}
                    onToggle={handleToggle}
                    onRemove={handleRemove}
                    onSchedule={handleSchedule}
                    onUnschedule={handleUnschedule}
                  />
                ))}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
