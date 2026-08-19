import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RichNotes from './RichNotes'

export default function DayNotes({ cityStopId, date }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    loadNote()
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityStopId, date])

  async function loadNote() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('day_notes')
      .select('*')
      .eq('city_stop_id', cityStopId)
      .eq('date', date)
      .maybeSingle()
    if (fetchError) setError(fetchError.message)
    else setContent(data?.content || '')
    setLoading(false)
  }

  function startEdit() {
    setDraft(content)
    setEditing(true)
  }

  async function saveContent(newContent) {
    setSaving(true)
    const { error: upsertError } = await supabase
      .from('day_notes')
      .upsert(
        { city_stop_id: cityStopId, date, content: newContent, updated_at: new Date().toISOString() },
        { onConflict: 'city_stop_id,date' }
      )
    if (upsertError) setError(upsertError.message)
    setSaving(false)
  }

  async function handleSave() {
    setContent(draft)
    setEditing(false)
    await saveContent(draft)
  }

  async function handleToggleCheckbox(lineIndex) {
    const lines = content.split('\n')
    const line = lines[lineIndex]
    if (!line) return
    let newLine
    if (line.includes('- [ ]')) newLine = line.replace('- [ ]', '- [x]')
    else if (line.includes('- [x]')) newLine = line.replace('- [x]', '- [ ]')
    else return
    lines[lineIndex] = newLine
    const newContent = lines.join('\n')
    setContent(newContent)
    await saveContent(newContent)
  }

  function wrapSelection(before, after = before) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd)
    const newValue = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    setDraft(newValue)
  }

  function insertLinePrefix(prefix) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, value } = textarea
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const newValue = value.slice(0, lineStart) + prefix + value.slice(lineStart)
    setDraft(newValue)
  }

  function handleBold() {
    wrapSelection('**')
  }

  function handleBullet() {
    insertLinePrefix('- ')
  }

  function handleChecklist() {
    insertLinePrefix('- [ ] ')
  }

  function handleLink() {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd)
    if (!selected) return
    const url = window.prompt('Link URL:', 'https://')
    if (!url) return
    const newValue = value.slice(0, selectionStart) + `[${selected}](${url})` + value.slice(selectionEnd)
    setDraft(newValue)
  }

  if (loading) return <p className="py-4 text-center font-mono text-xs text-ink/40">Loading…</p>

  return (
    <div className="mb-4 rounded-lg border border-line bg-card p-4">
      {error && <p className="mb-2 font-mono text-xs text-stamp">{error}</p>}

      {!editing ? (
        <>
          <RichNotes content={content} onToggleCheckbox={handleToggleCheckbox} />
          <button
            type="button"
            onClick={startEdit}
            className="mt-3 font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
          >
            Edit
          </button>
          {saving && <span className="ml-2 font-mono text-[10px] text-ink/30">saving…</span>}
        </>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={handleBold}
              className="rounded-md border border-line px-2 py-1 font-mono text-[10px] font-bold uppercase text-ink/60 hover:border-teal hover:text-ink"
            >
              B
            </button>
            <button
              type="button"
              onClick={handleBullet}
              className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink"
            >
              • Bullet
            </button>
            <button
              type="button"
              onClick={handleChecklist}
              className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink"
            >
              ☐ Checklist
            </button>
            <button
              type="button"
              onClick={handleLink}
              className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-teal hover:border-teal"
            >
              🔗 Link
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={10}
            placeholder="Write the day here… **bold**, - bullets (indent with 2 spaces to nest), - [ ] checklist items, [text](url) links"
            className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper hover:opacity-90"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-md border border-line px-4 py-2 font-body text-sm text-ink/50 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  )
}
