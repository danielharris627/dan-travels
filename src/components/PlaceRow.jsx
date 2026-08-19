import { useState } from 'react'
import { renderNotesWithLinks } from '../lib/notesLinks.jsx'

function formatScheduled(date, time) {
  if (!date) return null
  const d = new Date(`${date}T${time || '00:00'}`)
  const dateLabel = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  if (!time) return dateLabel
  const timeLabel = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${dateLabel} · ${timeLabel}`
}

function sourceBadge(source) {
  if (!source) return null
  const m = source.match(/(20\d{2})/)
  return m ? `'${m[1].slice(2)}` : null
}

export default function PlaceRow({
  item,
  tagLookup,
  mode = 'reference', // 'reference' (Places/Areas) | 'other' (unscheduled itinerary) | 'scheduled' (day view)
  dayList,
  showReorder,
  onMoveUp,
  onMoveDown,
  onRemove,
  onSchedule,
  onUnschedule,
  onAddToItinerary,
  onUpdate,
}) {
  const [scheduling, setScheduling] = useState(false)
  const [pickedDay, setPickedDay] = useState(item.scheduled_date || '')
  const [pickedTime, setPickedTime] = useState(item.scheduled_time || '')

  const [editing, setEditing] = useState(false)
  const [draftTitle, setDraftTitle] = useState(item.title)
  const [draftArea, setDraftArea] = useState(item.area || '')
  const [draftNotes, setDraftNotes] = useState(item.notes || '')
  const [draftMapsUrl, setDraftMapsUrl] = useState(item.maps_url || '')

  const badge = sourceBadge(item.source)

  function startEdit() {
    setDraftTitle(item.title)
    setDraftArea(item.area || '')
    setDraftNotes(item.notes || '')
    setDraftMapsUrl(item.maps_url || '')
    setEditing(true)
  }

  function saveEdit() {
    onUpdate?.(item, {
      title: draftTitle.trim(),
      area: draftArea.trim() || null,
      notes: draftNotes.trim() || null,
      maps_url: draftMapsUrl.trim() || null,
    })
    setEditing(false)
  }

  function confirmSchedule() {
    if (!pickedDay) return
    onSchedule(item, pickedDay, pickedTime || null)
    setScheduling(false)
  }

  if (editing) {
    return (
      <div className="rounded-lg border border-line bg-card p-3 mb-2">
        <input
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink focus:border-teal focus:outline-none"
        />
        <input
          value={draftArea}
          onChange={(e) => setDraftArea(e.target.value)}
          placeholder="Area"
          className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none"
        />
        <input
          value={draftMapsUrl}
          onChange={(e) => setDraftMapsUrl(e.target.value)}
          placeholder="Google Maps link"
          className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none"
        />
        <textarea
          value={draftNotes}
          onChange={(e) => setDraftNotes(e.target.value)}
          placeholder="Notes"
          rows={2}
          className="mb-2 w-full rounded-md border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none"
        />
        <div className="flex gap-2">
          <button onClick={saveEdit} className="rounded-md bg-teal px-3 py-1.5 font-body text-xs font-medium text-paper hover:opacity-90">
            Save
          </button>
          <button onClick={() => setEditing(false)} className="rounded-md border border-line px-3 py-1.5 font-body text-xs text-ink/50 hover:text-ink">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-card p-3 mb-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="font-body text-[15px] text-ink">{item.title}</p>
            {item.area && <span className="font-mono text-xs text-ink/40">· {item.area}</span>}
            {badge && <span className="font-mono text-[10px] text-ink/30">{badge}</span>}
            {item.scheduled_date && (
              <span className="rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-teal">
                {formatScheduled(item.scheduled_date, item.scheduled_time)}
              </span>
            )}
          </div>

          {item.tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.tags.map((label) => (
                <span key={label} className="flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gold">
                  <span aria-hidden="true">{tagLookup[label] ?? '🏷️'}</span>
                  {label}
                </span>
              ))}
            </div>
          )}

          {item.notes && <p className="mt-1.5 whitespace-pre-wrap font-body text-sm text-ink/60">{renderNotesWithLinks(item.notes)}</p>}

          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {(item.maps_url || (item.lat && item.lng)) && (
              <a
                href={item.maps_url || `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
              >
                🗺️ Maps
              </a>
            )}

            {mode === 'reference' && !item.in_itinerary && (
              <button onClick={() => onAddToItinerary(item)} className="font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70">
                + Add to itinerary
              </button>
            )}

            {mode === 'other' && !scheduling && (
              <button onClick={() => setScheduling(true)} className="font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70">
                Schedule
              </button>
            )}

            {mode === 'scheduled' && (
              <button onClick={() => onUnschedule(item)} className="font-mono text-[10px] uppercase tracking-wide text-ink/40 underline decoration-dotted underline-offset-2 hover:text-ink">
                Move back to Other
              </button>
            )}
          </div>

          {mode === 'other' && scheduling && (
            <div className="mt-2 rounded-md border border-line bg-paper p-2">
              <div className="mb-2 flex flex-wrap gap-1.5">
                {dayList?.map((d) => (
                  <button
                    key={d.dateStr}
                    type="button"
                    onClick={() => setPickedDay(d.dateStr)}
                    className={`rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide ${
                      pickedDay === d.dateStr ? 'border-teal bg-teal text-paper' : 'border-line text-ink/60 hover:border-teal'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="time"
                  value={pickedTime}
                  onChange={(e) => setPickedTime(e.target.value)}
                  className="rounded-md border border-line bg-card px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                />
                <button onClick={confirmSchedule} disabled={!pickedDay} className="rounded-md bg-teal px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-paper disabled:opacity-40">
                  Confirm
                </button>
                <button onClick={() => setScheduling(false)} className="rounded-md border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink/50 hover:text-ink">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-shrink-0 items-center gap-1">
          {showReorder && (
            <div className="mr-1 flex flex-col items-center gap-0.5">
              <button onClick={onMoveUp} disabled={!onMoveUp} aria-label="Move up" className="text-ink/40 hover:text-ink disabled:cursor-default disabled:opacity-20">
                ▲
              </button>
              <button onClick={onMoveDown} disabled={!onMoveDown} aria-label="Move down" className="text-ink/40 hover:text-ink disabled:cursor-default disabled:opacity-20">
                ▼
              </button>
            </div>
          )}
          <button
            onClick={startEdit}
            aria-label={`Edit ${item.title}`}
            className="flex h-6 w-6 items-center justify-center text-sm text-ink/35 hover:text-teal"
          >
            ✏
          </button>
          <button
            onClick={() => onRemove(item)}
            aria-label={`Remove ${item.title}`}
            className="flex h-6 w-6 items-center justify-center text-sm text-ink/35 hover:text-stamp"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  )
}
