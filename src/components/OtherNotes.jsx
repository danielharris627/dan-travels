import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import RichTextEditor from './RichTextEditor'

export default function OtherNotes({ cityStopId }) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadNote()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityStopId])

  async function loadNote() {
    setLoading(true)
    setError(null)
    const { data, error: fetchError } = await supabase.from('other_notes').select('*').eq('city_stop_id', cityStopId).maybeSingle()
    if (fetchError) setError(fetchError.message)
    else setContent(data?.content || '')
    setLoading(false)
  }

  async function handleSave(newContent) {
    setContent(newContent)
    const { error: upsertError } = await supabase
      .from('other_notes')
      .upsert({ city_stop_id: cityStopId, content: newContent, updated_at: new Date().toISOString() }, { onConflict: 'city_stop_id' })
    if (upsertError) setError(upsertError.message)
  }

  if (loading) return <p className="py-4 text-center font-mono text-xs text-ink/40">Loading…</p>

  return (
    <div className="mb-4 rounded-lg border border-line bg-card p-4">
      {error && <p className="mb-2 font-mono text-xs text-stamp">{error}</p>}
      <RichTextEditor content={content} onSave={handleSave} placeholder="Quick notes that don't need a formal place — jot anything here…" />
    </div>
  )
}
