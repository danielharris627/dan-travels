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

export default function PlaceRow({
  item,
  tagLookup,
  showReorder,
  onMoveUp,
  onMoveDown,
  onToggle,
  onRemove,
  onSchedule,
  onUnschedule,
}) {
  const isDone = item.status === 'done'
  const [scheduling, setScheduling] = useState(false)
  const [date, setDate] = useState(item.scheduled_date || '')
  const [time, setTime] = useState(item.scheduled_time || '')

  function confirmSchedule() {
    if (!date) return
    onSchedule(item, date, time || null)
    setScheduling(false)
  }

  return (
    <div className="group border-b border-line px-1 py-3 last:border-b-0">
      <div className="flex items-start gap-3">
        <button
          onClick={() => onToggle(item)}
          aria-pressed={isDone}
          aria-label={isDone ? 'Mark as not visited' : 'Mark as visited'}
          className={`relative mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
            isDone ? 'border-stamp' : 'border-line hover:border-teal'
          }`}
        >
          {isDone && (
            <span className="stamp-mark absolute -rotate-[8deg] font-mono text-[9px] font-semibold uppercase tracking-tight text-stamp">
              ✓
            </span>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className={`font-body text-[15px] ${isDone ? 'text-ink/40 line-through decoration-stamp/60' : 'text-ink'}`}>
              {item.title}
            </p>
            {item.area && <span className="font-mono text-xs text-ink/40">· {item.area}</span>}
            {item.source && (
              <span className="font-mono text-[10px] text-ink/30" title={item.source}>
                {item.source.match(/\d{2}$/)?.[0] ? `'${item.source.match(/\d{2}$/)[0]}` : item.source}
              </span>
            )}
            {item.scheduled_date && (
              <span className="rounded-full bg-teal/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-teal">
                {formatScheduled(item.scheduled_date, item.scheduled_time)}
              </span>
            )}
          </div>

          {item.tags?.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {item.tags.map((label) => (
                <span
                  key={label}
                  className="flex items-center gap-1 rounded-full bg-gold/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-gold"
                >
                  <span aria-hidden="true">{tagLookup[label] ?? '🏷️'}</span>
                  {label}
                </span>
              ))}
            </div>
          )}

          {item.notes && (
            <p className="mt-1.5 whitespace-pre-wrap font-body text-sm text-ink/60">
              {renderNotesWithLinks(item.notes)}
            </p>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {(item.maps_url || (item.lat && item.lng)) && (
              <a
                href={item.maps_url || `https://www.google.com/maps/search/?api=1&query=${item.lat},${item.lng}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
              >
                🗺️ Open in Maps
              </a>
            )}
            {item.scheduled_date ? (
              <button
                onClick={() => onUnschedule(item)}
                className="font-mono text-[10px] uppercase tracking-wide text-ink/40 underline decoration-dotted underline-offset-2 hover:text-ink"
              >
                Move back to ideas
              </button>
            ) : scheduling ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="rounded-md border border-line bg-paper px-2 py-1 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                />
                <button
                  onClick={confirmSchedule}
                  disabled={!date}
                  className="rounded-md bg-teal px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-paper disabled:opacity-40"
                >
                  Confirm
                </button>
                <button
                  onClick={() => setScheduling(false)}
                  className="rounded-md border border-line px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-ink/50 hover:text-ink"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setScheduling(true)}
                className="font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
              >
                Schedule this
              </button>
            )}
          </div>
        </div>

        {showReorder && (
          <div className="flex flex-shrink-0 flex-col items-center gap-0.5 pt-0.5">
            <button
              onClick={onMoveUp}
              disabled={!onMoveUp}
              aria-label="Move up"
              className="text-ink/40 hover:text-ink disabled:cursor-default disabled:opacity-20"
            >
              ▲
            </button>
            <button
              onClick={onMoveDown}
              disabled={!onMoveDown}
              aria-label="Move down"
              className="text-ink/40 hover:text-ink disabled:cursor-default disabled:opacity-20"
            >
              ▼
            </button>
          </div>
        )}

        <button
          onClick={() => onRemove(item)}
          className="flex-shrink-0 font-mono text-xs text-ink/30 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100"
          aria-label={`Remove ${item.title}`}
        >
          remove
        </button>
      </div>
    </div>
  )
}
