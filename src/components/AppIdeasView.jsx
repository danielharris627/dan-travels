import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { renderNotesWithLinks } from '../lib/notesLinks.jsx'

export default function AppIdeasView() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusMode, setStatusMode] = useState('active')

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [linkHint, setLinkHint] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const notesRef = useRef(null)

  useEffect(() => {
    loadItems()
  }, [statusMode])

  async function loadItems() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('app_ideas')
      .select('*')
      .eq('status', statusMode)
      .order('created_at', { ascending: false })
    if (fetchError) setError(fetchError.message)
    else setItems(data ?? [])
    setLoading(false)
  }

  function handleAddLink() {
    const textarea = notesRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selectedText = value.slice(selectionStart, selectionEnd)
    if (!selectedText) {
      setLinkHint('Select some text first, then click Link.')
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
    if (!trimmedTitle || submitting) return
    setSubmitting(true)
    const { data, error: insertError } = await supabase
      .from('app_ideas')
      .insert({ title: trimmedTitle, status: 'active', notes: notes.trim() || null })
      .select()
      .single()
    if (insertError) setError(insertError.message)
    else if (data) {
      if (statusMode === 'active') setItems((prev) => [data, ...prev])
      setTitle('')
      setNotes('')
      setLinkHint(null)
    }
    setSubmitting(false)
  }

  async function handleToggle(item) {
    const nextStatus = item.status === 'done' ? 'active' : 'done'
    const completed_at = nextStatus === 'done' ? new Date().toISOString() : null
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: updateError } = await supabase
      .from('app_ideas')
      .update({ status: nextStatus, completed_at })
      .eq('id', item.id)
    if (updateError) {
      setError(updateError.message)
      setItems((prev) => [...prev, item])
    }
  }

  async function handleRemove(item) {
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    const { error: deleteError } = await supabase.from('app_ideas').delete().eq('id', item.id)
    if (deleteError) setError(deleteError.message)
  }

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink/40">
        App ideas — for this app, not your trip
      </p>

      <form onSubmit={handleAdd} className="mb-4 rounded-lg border border-line bg-card p-3">
        <div className="flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add an idea…"
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button
            type="submit"
            disabled={submitting || !title.trim()}
            className="flex-shrink-0 rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          className="mt-2 font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
        >
          {detailsOpen ? 'Hide notes' : '+ Add notes'}
        </button>
        {detailsOpen && (
          <div className="mt-3">
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
              rows={3}
              className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            {linkHint && <p className="mt-1 font-mono text-[10px] text-stamp">{linkHint}</p>}
          </div>
        )}
      </form>

      <div className="mb-3 flex w-fit gap-1 rounded-full bg-line/40 p-1">
        {[
          { key: 'active', label: 'To Build' },
          { key: 'done', label: 'Built' },
        ].map((s) => (
          <button
            key={s.key}
            onClick={() => setStatusMode(s.key)}
            className={`rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wide transition-colors ${
              statusMode === s.key ? 'bg-card text-ink shadow-sm' : 'text-ink/50 hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="rounded-lg border border-line bg-card px-4">
        {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}
        {error && <p className="py-4 font-mono text-xs text-stamp">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="py-6 text-center font-body text-sm text-ink/40">
            {statusMode === 'active' ? 'Nothing yet.' : 'Nothing built yet.'}
          </p>
        )}
        {!loading &&
          !error &&
          items.map((item) => (
            <div key={item.id} className="group flex items-start gap-3 border-b border-line px-1 py-3 last:border-b-0">
              <button
                onClick={() => handleToggle(item)}
                className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                  item.status === 'done' ? 'border-stamp' : 'border-line hover:border-teal'
                }`}
              >
                {item.status === 'done' && <span className="text-[9px] text-stamp">✓</span>}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-body text-sm ${item.status === 'done' ? 'text-ink/40 line-through' : 'text-ink'}`}>
                  {item.title}
                </p>
                {item.notes && (
                  <p className="mt-1 whitespace-pre-wrap font-body text-xs text-ink/50">
                    {renderNotesWithLinks(item.notes)}
                  </p>
                )}
              </div>
              <button
                onClick={() => handleRemove(item)}
                className="font-mono text-xs text-ink/30 opacity-0 transition-opacity hover:text-stamp group-hover:opacity-100"
              >
                remove
              </button>
            </div>
          ))}
      </div>
    </div>
  )
}
