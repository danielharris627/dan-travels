import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RichTextEditor from './RichTextEditor'

export default function ResourcesView({ tripId, cityStopId, cityName }) {
  const [resources, setResources] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [activeId, setActiveId] = useState(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newCategorySynced, setNewCategorySynced] = useState(false)
  const [addingCategory, setAddingCategory] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [editingCategoryId, setEditingCategoryId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editSynced, setEditSynced] = useState(false)

  useEffect(() => {
    loadResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, cityStopId])

  async function loadResources() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase
      .from('resources')
      .select('*')
      .eq('trip_id', tripId)
      .or(`city_stop_id.is.null,city_stop_id.eq.${cityStopId}`)
      .order('sort_order', { ascending: true })
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
    const { data, error: insertError } = await supabase
      .from('resources')
      .insert({ trip_id: tripId, city_stop_id: newCategorySynced ? null : cityStopId, category: name, content: '', sort_order: nextOrder })
      .select()
      .single()
    if (insertError) setError(insertError.message)
    else if (data) {
      setResources((prev) => [...prev, data])
      setActiveId(data.id)
      setNewCategoryName('')
      setNewCategorySynced(false)
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

  function startEditCategory(resource) {
    setEditingCategoryId(resource.id)
    setEditName(resource.category)
    setEditSynced(resource.city_stop_id === null)
  }

  async function saveEditCategory() {
    const name = editName.trim()
    if (!name) return
    const patch = { category: name, city_stop_id: editSynced ? null : cityStopId }
    setResources((prev) => prev.map((r) => (r.id === editingCategoryId ? { ...r, ...patch } : r)))
    const { error: updateError } = await supabase.from('resources').update(patch).eq('id', editingCategoryId)
    if (updateError) setError(updateError.message)
    setEditingCategoryId(null)
  }

  return (
    <div>
      <p className="mb-3 font-mono text-[10px] uppercase tracking-wide text-ink/40">
        🔗 synced categories show for every city on this trip · 📍 unmarked ones are just for {cityName || 'this city'}
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {resources.map((r) => {
          if (editingCategoryId === r.id) {
            return (
              <div key={r.id} className="flex items-center gap-1.5 rounded-full border border-teal bg-card px-2 py-1">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="w-32 rounded border-none bg-transparent font-body text-sm text-ink focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setEditSynced((s) => !s)}
                  title="Toggle: synced across all cities vs. just this city"
                  className="text-sm"
                >
                  {editSynced ? '🔗' : '📍'}
                </button>
                <button type="button" onClick={saveEditCategory} className="font-mono text-[10px] uppercase text-teal">
                  Save
                </button>
                <button type="button" onClick={() => setEditingCategoryId(null)} className="font-mono text-[10px] uppercase text-ink/40">
                  ✕
                </button>
              </div>
            )
          }
          const synced = r.city_stop_id === null
          return (
            <div key={r.id} className="group relative">
              <button
                type="button"
                onClick={() => setActiveId(r.id)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                  activeId === r.id ? 'border-teal bg-teal text-paper' : 'border-line bg-card text-ink/60 hover:border-teal hover:text-ink'
                }`}
              >
                <span className="text-xs" aria-hidden="true">{synced ? '🔗' : '📍'}</span>
                {r.category}
              </button>
              <div className="absolute -right-1.5 -top-1.5 hidden gap-0.5 group-hover:flex">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    startEditCategory(r)
                  }}
                  aria-label={`Rename ${r.category}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-ink text-[8px] text-paper"
                >
                  ✏
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteCategory(r)
                  }}
                  aria-label={`Delete ${r.category}`}
                  className="flex h-4 w-4 items-center justify-center rounded-full bg-stamp text-[8px] text-paper"
                >
                  ✕
                </button>
              </div>
            </div>
          )
        })}
        {!addingCategory && (
          <button type="button" onClick={() => setAddingCategory(true)} className="rounded-full border border-dashed border-line px-3 py-1.5 font-body text-sm text-ink/50 hover:border-teal hover:text-ink">
            + New category
          </button>
        )}
      </div>

      {addingCategory && (
        <form onSubmit={handleCreateCategory} className="mb-4 rounded-md border border-line bg-card p-3">
          <div className="flex gap-2">
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
          </div>
          <label className="mt-2 flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-ink/50">
            <input type="checkbox" checked={newCategorySynced} onChange={(e) => setNewCategorySynced(e.target.checked)} />
            Sync across all cities in this trip (e.g. Flights &amp; Transport) — leave unchecked to keep it just for {cityName || 'this city'}
          </label>
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
