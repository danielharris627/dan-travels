import { useRef, useState } from 'react'
import RichNotes from './RichNotes'

export default function RichTextEditor({ content, onSave, placeholder, rows = 8 }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [linkHint, setLinkHint] = useState(null)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef(null)

  function startEdit() {
    setDraft(content || '')
    setEditing(true)
    setLinkHint(null)
  }

  async function handleSave() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
    setEditing(false)
  }

  async function handleToggleCheckbox(lineIndex) {
    const lines = (content || '').split('\n')
    const line = lines[lineIndex]
    if (!line) return
    let newLine
    if (line.includes('- [ ]')) newLine = line.replace('- [ ]', '- [x]')
    else if (line.includes('- [x]')) newLine = line.replace('- [x]', '- [ ]')
    else return
    lines[lineIndex] = newLine
    await onSave(lines.join('\n'))
  }

  function wrapSelection(before, after = before) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd)
    setDraft(value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd))
  }

  function insertLinePrefix(prefix) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, value } = textarea
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    setDraft(value.slice(0, lineStart) + prefix + value.slice(lineStart))
  }

  function handleIndent() {
    insertLinePrefix('  ')
  }

  function handleOutdent() {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, value } = textarea
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    if (value.slice(lineStart, lineStart + 2) === '  ') {
      setDraft(value.slice(0, lineStart) + value.slice(lineStart + 2))
    }
  }

  function handleLink() {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd)
    if (!selected) {
      setLinkHint('Select some text first, then click Link.')
      return
    }
    let url = window.prompt('Link URL:', 'https://')
    if (!url) return
    url = url.trim()
    // Auto-add https:// if they typed a bare domain — this is the fix for
    // links silently not working when the scheme is missing.
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`
    setDraft(value.slice(0, selectionStart) + `[${selected}](${url})` + value.slice(selectionEnd))
    setLinkHint(null)
  }

  if (!editing) {
    return (
      <div>
        <RichNotes content={content} onToggleCheckbox={handleToggleCheckbox} />
        <button
          type="button"
          onClick={startEdit}
          className="mt-3 font-mono text-[10px] uppercase tracking-wide text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
        >
          Edit
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => wrapSelection('**')} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] font-bold uppercase text-ink/60 hover:border-teal hover:text-ink">
          B
        </button>
        <button type="button" onClick={() => insertLinePrefix('- ')} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink">
          • Bullet
        </button>
        <button type="button" onClick={() => insertLinePrefix('- [ ] ')} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink">
          ☐ Checklist
        </button>
        <button type="button" onClick={handleIndent} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink">
          → Indent
        </button>
        <button type="button" onClick={handleOutdent} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink">
          ← Outdent
        </button>
        <button type="button" onClick={() => insertLinePrefix('## ')} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 hover:border-teal hover:text-ink">
          # Heading
        </button>
        <button type="button" onClick={() => wrapSelection('__')} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-ink/60 underline hover:border-teal hover:text-ink">
          U
        </button>
        <button type="button" onClick={handleLink} className="rounded-md border border-line px-2 py-1 font-mono text-[10px] uppercase text-teal hover:border-teal">
          🔗 Link
        </button>
      </div>
      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={rows}
        placeholder={placeholder || '**bold**, - bullets (Indent/Outdent to nest), - [ ] checklist items, [text](url) links'}
        className="w-full rounded-md border border-line bg-paper px-3 py-2 font-mono text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
      />
      {linkHint && <p className="mt-1 font-mono text-[10px] text-stamp">{linkHint}</p>}
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper hover:opacity-90 disabled:opacity-40">
          Save
        </button>
        <button type="button" onClick={() => setEditing(false)} className="rounded-md border border-line px-4 py-2 font-body text-sm text-ink/50 hover:text-ink">
          Cancel
        </button>
      </div>
    </div>
  )
}
