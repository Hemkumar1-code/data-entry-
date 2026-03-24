import { useState, useEffect, useRef } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { db, onValue, ref } from '../firebase';
import GlassCard from '../components/GlassCard';
import { formatDuration, intervalToDuration, format } from 'date-fns';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function FitBounds({ positions }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      map.fitBounds(positions, { padding: [30, 30] });
    }
  }, [positions, map]);
  return null;
}

function formatMs(ms) {
  if (!ms || ms <= 0) return '0 min';
  const d = intervalToDuration({ start: 0, end: ms });
  return formatDuration(d, { format: ['hours', 'minutes', 'seconds'] }) || '< 1s';
}

export default function AdminTrips() {
  const [trips, setTrips] = useState({});
  const [users, setUsers] = useState({});
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [replayIdx, setReplayIdx] = useState(null);
  const replayTimer = useRef(null);

  useEffect(() => {
    const unsubTrips = onValue(ref(db, 'trips'), (snap) => setTrips(snap.val() || {}));
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}));
    return () => { unsubTrips(); unsubUsers(); };
  }, []);

  // Flatten trips for display
  const allTrips = [];
  Object.entries(trips).forEach(([uid, userTrips]) => {
    Object.entries(userTrips || {}).forEach(([tripId, trip]) => {
      allTrips.push({ uid, tripId, ...trip, userName: users[uid]?.name || uid });
    });
  });
  allTrips.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const startReplay = (trip) => {
    setReplayIdx(0);
    clearInterval(replayTimer.current);
    const path = (trip.path || []).filter((p) => p?.latitude);
    let idx = 0;
    replayTimer.current = setInterval(() => {
      idx++;
      if (idx >= path.length) {
        clearInterval(replayTimer.current);
        setReplayIdx(path.length - 1);
        return;
      }
      setReplayIdx(idx);
    }, 200);
  };

  const stopReplay = () => {
    clearInterval(replayTimer.current);
    setReplayIdx(null);
  };

  useEffect(() => () => clearInterval(replayTimer.current), []);

  const getPositions = (trip, idx) => {
    const path = (trip.path || []).filter((p) => p?.latitude);
    const slice = idx !== null ? path.slice(0, idx + 1) : path;
    return slice.map((p) => [p.latitude, p.longitude]);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Trip History</h2>
          <p className="text-white/40 text-sm mt-0.5">{allTrips.length} trips recorded</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Trip list */}
          <div className="space-y-3">
            {allTrips.length === 0 ? (
              <GlassCard className="p-8 text-center">
                <p className="text-white/30 text-sm">No trips recorded yet</p>
              </GlassCard>
            ) : (
              allTrips.map((trip) => (
                <Motion.div key={trip.tripId} whileHover={{ scale: 1.01 }}>
                  <GlassCard
                    className={`p-4 cursor-pointer transition-all ${selectedTrip?.tripId === trip.tripId ? 'border-emerald-500/40' : ''}`}
                    onClick={() => { setSelectedTrip(trip); stopReplay(); }}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-white font-semibold text-sm">{trip.userName}</p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {trip.startTime ? format(trip.startTime, 'dd MMM yyyy, HH:mm') : '—'}
                        </p>
                      </div>
                      <span className="text-xs bg-white/5 text-white/50 px-2 py-1 rounded-lg">
                        #{trip.tripId.slice(-6)}
                      </span>
                    </div>
                    <div className="flex gap-6 mt-3">
                      <div>
                        <p className="text-xs text-white/40">Distance</p>
                        <p className="text-white text-sm font-medium">{((trip.distance || 0) / 1000).toFixed(2)} km</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Duration</p>
                        <p className="text-white text-sm font-medium">{formatMs((trip.endTime || 0) - (trip.startTime || 0))}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/40">Points</p>
                        <p className="text-white text-sm font-medium">{(trip.path || []).length}</p>
                      </div>
                    </div>
                  </GlassCard>
                </Motion.div>
              ))
            )}
          </div>

          {/* Map detail */}
          <div className="sticky top-0">
            <AnimatePresence mode="wait">
              {selectedTrip ? (
                <Motion.div
                  key={selectedTrip.tripId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <GlassCard className="overflow-hidden">
                    <div className="h-64">
                      <MapContainer
                        center={[20.5937, 78.9629]}
                        zoom={10}
                        className="h-full w-full"
                        style={{ background: '#0B1220' }}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        {(() => {
                          const positions = getPositions(selectedTrip, replayIdx);
                          return (
                            <>
                              {positions.length > 0 && <FitBounds positions={positions} />}
                              {positions.length > 1 && (
                                <Polyline positions={positions} color="#34d399" weight={3} />
                              )}
                              {positions.length > 0 && (
                                <Marker position={positions[positions.length - 1]} />
                              )}
                            </>
                          );
                        })()}
                      </MapContainer>
                    </div>
                    <div className="p-4">
                      <div className="flex gap-4 mb-3">
                        <div>
                          <p className="text-xs text-white/40">User</p>
                          <p className="text-white text-sm font-medium">{selectedTrip.userName}</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/40">Distance</p>
                          <p className="text-white text-sm font-medium">{((selectedTrip.distance || 0) / 1000).toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-xs text-white/40">Duration</p>
                          <p className="text-white text-sm font-medium">
                            {formatMs((selectedTrip.endTime || 0) - (selectedTrip.startTime || 0))}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => startReplay(selectedTrip)}
                          className="flex-1 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-sm font-medium transition-all"
                        >
                          ▶ Replay
                        </button>
                        <button
                          onClick={stopReplay}
                          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60 text-sm font-medium transition-all"
                        >
                          ■ Stop
                        </button>
                      </div>
                    </div>
                  </GlassCard>
                </Motion.div>
              ) : (
                <GlassCard className="p-8 text-center">
                  <p className="text-white/30 text-sm">Select a trip to view route</p>
                </GlassCard>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
