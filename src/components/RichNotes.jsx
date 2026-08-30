import { useState } from 'react'

const LIST_LINE = /^(\s*)-\s+(\[( |x)\]\s+)?(.*)$/
const HEADER_LINE = /^(#{1,6})\s+(.*)$/
const INLINE = /(\*\*(.+?)\*\*)|(__(.+?)__)|(\[([^\]]+)\]\((https?:\/\/[^\s)]+)\))/g

function renderInline(text, keyPrefix) {
  const parts = []
  let lastIndex = 0
  let match
  let key = 0
  INLINE.lastIndex = 0
  while ((match = INLINE.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1]) {
      parts.push(<strong key={`${keyPrefix}-${key++}`}>{match[2]}</strong>)
    } else if (match[3]) {
      parts.push(<u key={`${keyPrefix}-${key++}`}>{match[4]}</u>)
    } else if (match[5]) {
      parts.push(
        <a
          key={`${keyPrefix}-${key++}`}
          href={match[7]}
          target="_blank"
          rel="noreferrer"
          className="text-teal underline decoration-dotted underline-offset-2 hover:text-teal/70"
        >
          {match[6]}
        </a>
      )
    }
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts
}

// Parses into a flat block sequence. Nested bullets/checklists render with
// indent-based left margin rather than a true nested tree — simpler and
// avoids off-by-one nesting bugs, same visual result for 1-2 levels deep.
function parseBlocks(text) {
  const rawLines = (text || '').split('\n')
  const blocks = []
  let i = 0

  while (i < rawLines.length) {
    let blankCount = 0
    while (i < rawLines.length && rawLines[i].trim() === '') {
      blankCount++
      i++
    }
    if (i >= rawLines.length) break
    const line = rawLines[i]
    // blankCount of 1 is the normal single-line-break gap already handled by
    // block spacing; anything beyond that is an intentional extra gap.
    const extraGap = Math.max(0, blankCount - 1)

    const headerMatch = line.match(HEADER_LINE)
    if (headerMatch) {
      blocks.push({ type: 'header', level: headerMatch[1].length, text: headerMatch[2], lineIndex: i, extraGap })
      i++
      continue
    }

    const listMatch = line.match(LIST_LINE)
    if (listMatch) {
      const items = []
      while (i < rawLines.length) {
        const m = rawLines[i].match(LIST_LINE)
        if (!m) break
        items.push({
          indent: Math.floor(m[1].length / 2),
          isChecklist: m[2] !== undefined,
          checked: m[3] === 'x',
          text: m[4],
          lineIndex: i,
        })
        i++
      }
      blocks.push({ type: 'list', items, extraGap })
      continue
    }

    const paraLines = []
    while (i < rawLines.length && rawLines[i].trim() !== '' && !rawLines[i].match(LIST_LINE) && !rawLines[i].match(HEADER_LINE)) {
      paraLines.push(rawLines[i])
      i++
    }
    blocks.push({ type: 'paragraph', text: paraLines.join('\n'), lineIndex: i - paraLines.length, extraGap })
  }

  return blocks
}

export default function RichNotes({ content, onToggleCheckbox }) {
  const blocks = parseBlocks(content)
  const [collapsed, setCollapsed] = useState(new Set())

  function toggleCollapse(lineIndex) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(lineIndex)) next.delete(lineIndex)
      else next.add(lineIndex)
      return next
    })
  }

  if (blocks.length === 0) {
    return <p className="font-body text-sm text-ink/40">Nothing written yet.</p>
  }

  return (
    <div>
      {blocks.map((block, bi) => {
        const marginTop = bi === 0 ? 0 : 0.5 + (block.extraGap || 0) * 0.75
        const style = { marginTop: `${marginTop}rem` }
        if (block.type === 'header') {
          const sizeClass =
            block.level === 1 ? 'text-xl' : block.level === 2 ? 'text-lg' : block.level === 3 ? 'text-base' : block.level === 4 ? 'text-sm' : 'text-xs uppercase tracking-wide'
          return (
            <p key={bi} style={style} className={`font-display font-semibold text-teal ${sizeClass}`}>
              {renderInline(block.text, `h${bi}`)}
            </p>
          )
        }
        if (block.type === 'paragraph') {
          return (
            <p key={bi} style={style} className="whitespace-pre-wrap font-body text-sm text-ink/80">
              {renderInline(block.text, `p${bi}`)}
            </p>
          )
        }
        // list — single pass: an item is hidden if some earlier item at a
        // lower indent is collapsed and we haven't yet returned to that
        // indent level or shallower.
        let hideBelowIndent = null
        return (
          <div key={bi} style={style} className="space-y-1">
            {block.items.map((item, ii) => {
              if (hideBelowIndent !== null) {
                if (item.indent > hideBelowIndent) return null
                hideBelowIndent = null
              }
              const hasChildren = block.items[ii + 1] && block.items[ii + 1].indent > item.indent
              const isCollapsed = collapsed.has(item.lineIndex)
              if (hasChildren && isCollapsed) hideBelowIndent = item.indent

              return (
                <div
                  key={ii}
                  className="flex items-start gap-2 font-body text-sm text-ink/80"
                  style={{ marginLeft: `${item.indent * 1.25}rem` }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={() => toggleCollapse(item.lineIndex)}
                      aria-label={isCollapsed ? 'Expand' : 'Collapse'}
                      className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center text-ink/40 hover:text-teal"
                    >
                      {isCollapsed ? '▸' : '▾'}
                    </button>
                  ) : item.isChecklist ? (
                    <button
                      type="button"
                      onClick={() => onToggleCheckbox?.(item.lineIndex)}
                      className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                        item.checked ? 'border-stamp bg-stamp text-paper' : 'border-line hover:border-teal'
                      }`}
                      aria-pressed={item.checked}
                    >
                      {item.checked && <span className="text-[9px]">✓</span>}
                    </button>
                  ) : (
                    <span className="mt-0.5 flex-shrink-0 text-ink/40">–</span>
                  )}
                  <span className={item.checked ? 'text-ink/40 line-through decoration-stamp/60' : ''}>
                    {renderInline(item.text, `l${bi}-${ii}`)}
                    {hasChildren && isCollapsed && <span className="ml-1 text-ink/30">…</span>}
                  </span>
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}
