export default function TripPicker({ trips, activeCityStopId, isManual, onSelect, onUseAuto, onClose }) {
  return (
    <div className="mb-6 rounded-lg border border-line bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Switch trip / city</h2>
        <button onClick={onClose} className="font-mono text-xs text-ink/40 hover:text-ink">
          close
        </button>
      </div>

      <button
        onClick={onUseAuto}
        className={`mb-3 w-full rounded-md border px-3 py-2 text-left font-body text-sm transition-colors ${
          !isManual ? 'border-teal bg-teal/10 text-ink' : 'border-line text-ink/60 hover:border-teal'
        }`}
      >
        🕐 Auto — whatever's currently active
      </button>

      <div className="space-y-3">
        {trips.map((trip) => (
          <div key={trip.id}>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-wide text-ink/40">{trip.name}</p>
            <div className="flex flex-wrap gap-2">
              {(trip.city_stops ?? []).map((stop) => (
                <button
                  key={stop.id}
                  onClick={() => onSelect(stop.id)}
                  className={`rounded-full border px-3 py-1.5 font-body text-sm transition-colors ${
                    isManual && activeCityStopId === stop.id
                      ? 'border-teal bg-teal text-paper'
                      : 'border-line bg-paper text-ink/70 hover:border-teal'
                  }`}
                >
                  {stop.city_name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
