import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RichTextEditor from './RichTextEditor'

export default function ResourcesView({ tripId }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeId, setActiveId] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [addingCategory, setAddingCategory] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId])

  async function loadResources() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.from('resources').select('*').eq('trip_id', tripId).order('sort_order', { ascending: true })
    if (fetchError) setError(fetchError.message)
    else {
      setResources(data ?? [])
      if (data?.length && !activeId) setActiveId(data[0].id)
    }
    setLoading(false)
  }

  const active = resources.find((r) => r.id === activeId) || null

  async function handleSave(newContent) {
    if (!active) return
    const { data, error: updateError } = await supabase
      .from('resources')
      .update({ content: newContent, updated_at: new Date().toISOString() })
      .eq('id', active.id)
      .select()
      .single()
    if (updateError) setError(updateError.message)
    else if (data) setResources((prev) => prev.map((r) => (r.id === data.id ? data : r)))
  }

  async function handleCreateCategory(e) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name || submitting) return
    setSubmitting(true)
    const nextOrder = resources.length > 0 ? Math.max(...resources.map((r) => r.sort_order ?? 0)) + 1 : 0
    const { data, error: insertError } = await supabase.from('resources').insert({ trip_id: tripId, category: name, content: '', sort_order: nextOrder }).select().single()
    if (insertError) setError(insertError.message)
    else if (data) {
      setResources((prev) => [...prev, data])
      setActiveId(data.id)
      setNewCategoryName('')
      setAddingCategory(false)
    }
    setSubmitting(false)
  }

  async function handleDeleteCategory(resource) {
    const confirmed = window.confirm(`Delete "${resource.category}" and its note? This can't be undone.`)
    if (!confirmed) return
    setResources((prev) => prev.filter((r) => r.id !== resource.id))
    if (activeId === resource.id) setActiveId(null)
    const { error: deleteError } = await supabase.from('resources').delete().eq('id', resource.id)
    if (deleteError) setError(deleteError.message)
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {resources.map((r) => (
          <div key={r.id} className="group relative">
            <button
              type="button"
              onClick={() => setActiveId(r.id)}
              className={`rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                activeId === r.id ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
              }`}
            >
              {r.category}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleDeleteCategory(r)
              }}
              aria-label={`Delete ${r.category}`}
              className="absolute -right-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full bg-stamp text-[8px] text-paper group-hover:flex"
            >
              ✕
            </button>
          </div>
        ))}
        {!addingCategory && (
          <button type="button" onClick={() => setAddingCategory(true)} className="rounded-full border border-dashed border-line px-3 py-1.5 font-body text-sm text-ink/50 hover:border-teal hover:text-ink">
            + New category
          </button>
        )}
      </div>

      {addingCategory && (
        <form onSubmit={handleCreateCategory} className="mb-4 flex gap-2">
          <input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name — e.g. Links, Packing…"
            autoFocus
            className="flex-1 rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
          />
          <button type="submit" disabled={!newCategoryName.trim() || submitting} className="rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper disabled:opacity-40">
            Add
          </button>
          <button
            type="button"
            onClick={() => {
              setAddingCategory(false)
              setNewCategoryName('')
            }}
            className="rounded-md border border-line px-4 py-2 font-body text-sm text-ink/50 hover:text-ink"
          >
            Cancel
          </button>
        </form>
      )}

      {loading && <p className="py-6 text-center font-mono text-xs text-ink/40">Loading…</p>}
      {error && <p className="py-4 font-mono text-xs text-stamp">{error}</p>}

      {!loading && !error && resources.length === 0 && !addingCategory && (
        <p className="py-6 text-center font-body text-sm text-ink/40">No categories yet. Add one above — Links, Flights/Transport, Packing, whatever's useful.</p>
      )}

      {!loading && !error && active && (
        <div className="rounded-lg border border-line bg-card p-4">
          <RichTextEditor content={active.content} onSave={handleSave} />
        </div>
      )}
    </div>
  )
}
