import { useState } from 'react'
import { fromZonedTime } from 'date-fns-tz'
import { supabase } from '../lib/supabaseClient'

const TIMEZONES = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Los_Angeles', label: 'Pacific (LA / SF)' },
  { value: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { value: 'America/Anchorage', label: 'Alaska' },
  { value: 'Pacific/Honolulu', label: 'Hawaii' },
  { value: 'Europe/London', label: 'UK' },
  { value: 'Europe/Paris', label: 'Central Europe' },
  { value: 'Asia/Tokyo', label: 'Japan' },
]

function emptyStop() {
  return { city_name: '', start_at: '', end_at: '', timezone: 'America/New_York' }
}

export default function TripSetup({ onDone, onCancel }) {
  const [tripName, setTripName] = useState('')
  const [stops, setStops] = useState([emptyStop()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  function updateStop(index, field, value) {
    setStops((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)))
  }

  function addStop() {
    setStops((prev) => [...prev, emptyStop()])
  }

  function removeStop(index) {
    setStops((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmedName = tripName.trim()
    const validStops = stops.filter((s) => s.city_name.trim() && s.start_at && s.end_at)
    if (!trimmedName || validStops.length === 0 || submitting) return

    setSubmitting(true)
    setError(null)

    const { data: trip, error: tripError } = await supabase.from('trips').insert({ name: trimmedName }).select().single()

    if (tripError) {
      setError(tripError.message)
      setSubmitting(false)
      return
    }

    const { error: stopsError } = await supabase.from('city_stops').insert(
      validStops.map((s, i) => ({
        trip_id: trip.id,
        city_name: s.city_name.trim(),
        start_at: fromZonedTime(s.start_at, s.timezone).toISOString(),
        end_at: fromZonedTime(s.end_at, s.timezone).toISOString(),
        timezone: s.timezone,
        sort_order: i,
      }))
    )

    if (stopsError) {
      setError(stopsError.message)
      setSubmitting(false)
      return
    }

    setSubmitting(false)
    onDone()
  }

  return (
    <div className="mx-auto max-w-lg">
      <h2 className="mb-4 font-display text-2xl text-ink">New trip</h2>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-line bg-card p-4">
        <input
          value={tripName}
          onChange={(e) => setTripName(e.target.value)}
          placeholder="Trip name — e.g. NYC + SF, September 2026"
          className="w-full rounded-md border border-line bg-paper px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal"
        />

        <div className="space-y-3">
          {stops.map((stop, i) => (
            <div key={i} className="rounded-md border border-line bg-paper p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wide text-ink/40">City stop {i + 1}</span>
                {stops.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStop(i)}
                    className="font-mono text-[10px] uppercase tracking-wide text-stamp"
                  >
                    remove
                  </button>
                )}
              </div>
              <input
                value={stop.city_name}
                onChange={(e) => updateStop(i, 'city_name', e.target.value)}
                placeholder="City — e.g. New York"
                className="mb-2 w-full rounded-md border border-line bg-card px-3 py-2 font-body text-sm text-ink placeholder:text-ink/35 focus:border-teal focus:outline-none"
              />
              <div className="mb-2">
                <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/40">
                  Local timezone
                </label>
                <select
                  value={stop.timezone}
                  onChange={(e) => updateStop(i, 'timezone', e.target.value)}
                  className="w-full rounded-md border border-line bg-card px-2 py-1.5 font-body text-sm text-ink focus:border-teal focus:outline-none"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/40">
                    Arrive
                  </label>
                  <input
                    type="datetime-local"
                    value={stop.start_at}
                    onChange={(e) => updateStop(i, 'start_at', e.target.value)}
                    className="w-full rounded-md border border-line bg-card px-2 py-1.5 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-ink/40">
                    Leave
                  </label>
                  <input
                    type="datetime-local"
                    value={stop.end_at}
                    onChange={(e) => updateStop(i, 'end_at', e.target.value)}
                    className="w-full rounded-md border border-line bg-card px-2 py-1.5 font-mono text-xs text-ink focus:border-teal focus:outline-none"
                  />
                </div>
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-ink/30">
                Enter the arrive/leave times as they'd read on a clock in {stop.city_name || 'that city'} — not
                converted to your own timezone.
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addStop}
          className="rounded-md border border-dashed border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-ink/50 hover:border-teal hover:text-ink"
        >
          + Add another city
        </button>

        {error && <p className="font-mono text-xs text-stamp">{error}</p>}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-teal px-4 py-2 font-body text-sm font-medium text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save trip
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border border-line px-4 py-2 font-body text-sm text-ink/50 hover:text-ink"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
