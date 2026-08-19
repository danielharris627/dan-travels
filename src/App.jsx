import { useEffect, useState } from 'react'
import { supabase } from './lib/supabaseClient'
import CityView from './components/CityView'
import TripSetup from './components/TripSetup'
import TripPicker from './components/TripPicker'
import ResourcesView from './components/ResourcesView'
import AppIdeasView from './components/AppIdeasView'

export default function App() {
  const [trips, setTrips] = useState([])
  const [loading, setLoading] = useState(true)
  const [manualCityStopId, setManualCityStopId] = useState(null)
  const [showPicker, setShowPicker] = useState(false)
  const [showSetup, setShowSetup] = useState(false)
  const [showResources, setShowResources] = useState(false)
  const [showAppIdeas, setShowAppIdeas] = useState(false)

  useEffect(() => {
    loadTrips()
  }, [])

  async function loadTrips() {
    setLoading(true)
    const { data, error } = await supabase
      .from('trips')
      .select('*, city_stops(*)')
      .order('created_at', { ascending: false })
    if (!error) setTrips(data ?? [])
    setLoading(false)
  }

  const allCityStops = trips.flatMap((t) => (t.city_stops ?? []).map((c) => ({ ...c, tripName: t.name })))

  // Auto-select rule: the earliest city stop that hasn't ended yet. Covers
  // "before the trip" (soonest upcoming stop), "during a stop" (hasn't ended),
  // and rolls over automatically the moment a stop's end_at passes.
  const now = new Date()
  const upcoming = allCityStops
    .filter((c) => new Date(c.end_at) > now)
    .sort((a, b) => new Date(a.start_at) - new Date(b.start_at))
  const autoCityStop = upcoming[0] || null

  const activeCityStop = manualCityStopId
    ? allCityStops.find((c) => c.id === manualCityStopId) || autoCityStop
    : autoCityStop

  function handleSetupDone() {
    setShowSetup(false)
    loadTrips()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper">
        <p className="font-mono text-xs text-ink/40">Loading…</p>
      </div>
    )
  }

  if (trips.length === 0 || showSetup) {
    return (
      <div className="min-h-screen bg-paper px-6 py-12">
        <TripSetup onDone={handleSetupDone} onCancel={trips.length > 0 ? () => setShowSetup(false) : null} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto max-w-2xl px-6 pt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">
              {activeCityStop ? activeCityStop.city_name : "Dan's Travels"}
            </h1>
            {activeCityStop && <p className="font-mono text-xs text-ink/40">{activeCityStop.tripName}</p>}
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              onClick={() => setShowAppIdeas((a) => !a)}
              aria-label="App ideas"
              title="App ideas"
              className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs transition-colors ${
                showAppIdeas ? 'border-teal bg-teal text-paper' : 'border-line text-ink/40 hover:border-teal hover:text-ink'
              }`}
            >
              💡
            </button>
            <button
              onClick={() => setShowResources((r) => !r)}
              className={`rounded-full border px-3 py-1.5 font-mono text-xs uppercase tracking-wide transition-colors ${
                showResources
                  ? 'border-teal bg-teal text-paper'
                  : 'border-line text-ink/60 hover:border-teal hover:text-ink'
              }`}
            >
              Resources
            </button>
            <button
              onClick={() => setShowPicker((p) => !p)}
              className="rounded-full border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-ink/60 hover:border-teal hover:text-ink"
            >
              Switch
            </button>
            <button
              onClick={() => setShowSetup(true)}
              className="rounded-full border border-line px-3 py-1.5 font-mono text-xs uppercase tracking-wide text-ink/60 hover:border-teal hover:text-ink"
            >
              + Trip
            </button>
          </div>
        </div>

        {showPicker && (
          <TripPicker
            trips={trips}
            activeCityStopId={activeCityStop?.id}
            isManual={!!manualCityStopId}
            onSelect={(id) => {
              setManualCityStopId(id)
              setShowPicker(false)
            }}
            onUseAuto={() => {
              setManualCityStopId(null)
              setShowPicker(false)
            }}
            onClose={() => setShowPicker(false)}
          />
        )}
      </header>

      <main className="mx-auto max-w-2xl px-6 pb-24">
        {showAppIdeas ? (
          <AppIdeasView />
        ) : showResources ? (
          activeCityStop ? (
            <ResourcesView tripId={activeCityStop.trip_id} />
          ) : (
            <p className="py-6 text-center font-body text-sm text-ink/40">No active trip to show resources for.</p>
          )
        ) : activeCityStop ? (
          <CityView cityStop={activeCityStop} />
        ) : (
          <div className="rounded-lg border border-dashed border-line px-6 py-16 text-center">
            <p className="font-display text-lg text-ink/50">No active trip</p>
            <p className="mt-1 font-body text-sm text-ink/35">All your trips have ended. Add a new one above.</p>
          </div>
        )}
      </main>
    </div>
  )
}
