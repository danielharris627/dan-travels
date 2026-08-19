import { useState } from 'react'

const EMOJI_PALETTE = [
  '🥾', '🍺', '☕', '🍽️', '🥐', '🍪', '🎵', '🌳', '🏖️', '🍰',
  '🍕', '🌮', '🍣', '🎨', '🛍️', '📷', '🌅', '🚶', '🚲', '🏛️',
  '⭐', '📍', '🎉', '🍷', '🍸', '🛶', '🍳', '🥞', '🧇', '🥯',
  '🥓', '🍞', '🫖', '🧋', '🍹', '🥃', '🎭', '🌊', '⛰️', '🏞️',
  '🌸', '🧁', '🍩', '🍫', '❄️', '🐕',
]

export default function TagPicker({ tags, selected, onToggle, onCreateTag, onUpdateTag, onDeleteTag, onMoveTag, allowManage = false }) {
  const [panel, setPanel] = useState(null)
  const [label, setLabel] = useState('')
  const [icon, setIcon] = useState(EMOJI_PALETTE[0])

  function openCreate() {
    setPanel('create')
    setLabel('')
    setIcon(EMOJI_PALETTE[0])
  }

  function openEdit(tag) {
    setPanel(tag)
    setLabel(tag.label)
    setIcon(tag.icon)
  }

  function closePanel() {
    setPanel(null)
  }

  function handleSave(e) {
    e.preventDefault()
    const trimmed = label.trim()
    if (!trimmed) return

    if (panel === 'create') {
      onCreateTag(trimmed, icon || '🏷️')
    } else if (panel && typeof panel === 'object') {
      onUpdateTag(panel, trimmed, icon || '🏷️')
    }
    closePanel()
  }

  function handleDelete(tag) {
    onDeleteTag(tag)
    if (panel && typeof panel === 'object' && panel.id === tag.id) closePanel()
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag, index) => {
          const isActive = selected.includes(tag.label)
          return (
            <div key={tag.id} className="group relative">
              <button
                type="button"
                onClick={() => onToggle(tag.label)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                  isActive
                    ? 'border-teal bg-teal text-paper'
                    : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                }`}
              >
                <span aria-hidden="true">{tag.icon}</span>
                {tag.label}
              </button>
              {allowManage && (
                <div className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover:flex">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveTag(tag, 'up')
                    }}
                    disabled={index === 0}
                    aria-label={`Move ${tag.label} earlier`}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-paper disabled:opacity-30"
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onMoveTag(tag, 'down')
                    }}
                    disabled={index === tags.length - 1}
                    aria-label={`Move ${tag.label} later`}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-paper disabled:opacity-30"
                  >
                    ▼
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      openEdit(tag)
                    }}
                    aria-label={`Edit ${tag.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-paper"
                  >
                    ✏
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(tag)
                    }}
                    aria-label={`Delete ${tag.label}`}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-stamp text-[8px] text-paper"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          )
        })}

        {allowManage && panel !== 'create' && (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-full border border-dashed border-line px-3 py-1.5 font-body text-sm text-ink/50 hover:border-teal hover:text-ink"
          >
            + New tag
          </button>
        )}
      </div>

      {allowManage && panel && (
        <div className="mt-3 rounded-md border border-line bg-card p-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wide text-ink/40">
            {panel === 'create' ? 'Pick an icon, or type/paste your own' : `Editing "${panel.label}"`}
          </p>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {EMOJI_PALETTE.map((emoji) => (
              <button
                type="button"
                key={emoji}
                onClick={() => setIcon(emoji)}
                className={`flex h-8 w-8 items-center justify-center rounded-md border text-base transition-colors ${
                  icon === emoji ? 'border-teal bg-teal/10' : 'border-line hover:border-teal'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              aria-label="Custom icon"
              className="h-9 w-9 flex-shrink-0 rounded-md border border-line bg-paper text-center text-base focus:border-teal focus:outline-none"
            />
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Tag name…"
              className="min-w-[10rem] flex-1 rounded-md border border-line bg-paper px-3 py-1.5 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={!label.trim()}
              className="rounded-md bg-teal px-3 py-1.5 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {panel === 'create' ? 'Add' : 'Save'}
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md border border-line px-3 py-1.5 font-body text-sm text-ink/50 hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
