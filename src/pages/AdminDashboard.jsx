import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AnimatePresence, motion as Motion } from 'framer-motion';
import { db, onValue, ref } from '../firebase';
import GlassCard from '../components/GlassCard';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const liveIcon = new L.DivIcon({
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#34d399;border:2px solid #fff;box-shadow:0 0 8px rgba(52,211,153,0.8)"></div>`,
  className: '',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function FlyToUser({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, 15, { animate: true, duration: 1 });
  }, [position, map]);
  return null;
}

export default function AdminDashboard() {
  const [tracking, setTracking] = useState({});
  const [users, setUsers] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [flyTo, setFlyTo] = useState(null);

  useEffect(() => {
    const unsubTrack = onValue(ref(db, 'tracking'), (snap) => setTracking(snap.val() || {}));
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}));
    return () => { unsubTrack(); unsubUsers(); };
  }, []);

  const activeEntries = Object.entries(tracking).filter(([, v]) => v?.meta?.active);

  const getMarkerPosition = (trackData) => {
    const meta = trackData?.meta;
    if (meta?.lastLat && meta?.lastLng) return [meta.lastLat, meta.lastLng];
    return null;
  };

  const getPath = (trackData) => {
    const points = trackData?.points ? Object.values(trackData.points) : [];
    return points
      .filter((p) => p?.latitude && p?.longitude)
      .map((p) => [p.latitude, p.longitude]);
  };

  const handleMarkerClick = (uid, trackData) => {
    const markerPos = getMarkerPosition(trackData);
    setSelectedUser({ uid, ...trackData?.meta, name: users[uid]?.name });
    if (markerPos) setFlyTo(markerPos);
  };

  return (
    <div className="flex-1 relative min-h-screen">
      {/* Full screen map */}
      <MapContainer
        center={[20.5937, 78.9629]}
        zoom={5}
        className="h-full w-full absolute inset-0"
        style={{ zIndex: 0, background: '#0B1220' }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
        />
        {flyTo && <FlyToUser position={flyTo} />}

        {activeEntries.map(([uid, trackData]) => {
          const markerPos = getMarkerPosition(trackData);
          const routePath = getPath(trackData);
          if (!markerPos) return null;
          return (
            <div key={uid}>
              <Marker
                position={markerPos}
                icon={liveIcon}
                eventHandlers={{ click: () => handleMarkerClick(uid, trackData) }}
              >
                <Popup>
                  <div className="text-sm font-sans">
                    <p className="font-bold">{users[uid]?.name || uid}</p>
                    <p className="text-gray-500">{users[uid]?.email}</p>
                    {trackData?.meta?.lastTs && (
                      <p className="text-gray-400 text-xs mt-1">
                        {new Date(trackData.meta.lastTs).toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Popup>
              </Marker>
              {routePath.length > 1 && (
                <Polyline positions={routePath} color="#34d399" weight={3} opacity={0.8} />
              )}
            </div>
          );
        })}
      </MapContainer>

      {/* Overlay cards */}
      <div className="absolute top-4 right-4 w-72 space-y-3 z-10">
        {/* Active users */}
        <GlassCard className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-white">Active Users</h3>
            <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">
              {activeEntries.length} LIVE
            </span>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {activeEntries.length === 0 ? (
              <p className="text-white/30 text-xs text-center py-4">No active users</p>
            ) : (
              activeEntries.map(([uid, trackData]) => (
                <Motion.div
                  key={uid}
                  className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2 cursor-pointer hover:bg-white/10 transition-all"
                  onClick={() => handleMarkerClick(uid, trackData)}
                  whileHover={{ scale: 1.02 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-white text-xs font-medium truncate max-w-[120px]">
                      {users[uid]?.name || uid}
                    </span>
                  </div>
                  <span className="text-emerald-400 text-xs">LIVE</span>
                </Motion.div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Selected user detail */}
        <AnimatePresence>
          {selectedUser && (
            <GlassCard className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-semibold text-white">User Details</h4>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="text-white/40 hover:text-white text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="text-white text-sm font-medium">{selectedUser.name || selectedUser.uid}</p>
              {selectedUser.lastTs && (
                <p className="text-white/40 text-xs mt-1">
                  Last seen: {new Date(selectedUser.lastTs).toLocaleTimeString()}
                </p>
              )}
              {selectedUser.lastLat && (
                <p className="text-white/40 text-xs">
                  {selectedUser.lastLat.toFixed(5)}, {selectedUser.lastLng.toFixed(5)}
                </p>
              )}
            </GlassCard>
          )}
        </AnimatePresence>
      </div>

      {/* Stats bottom left */}
      <div className="absolute bottom-6 left-4 z-10">
        <GlassCard className="px-4 py-2.5 flex items-center gap-4">
          <div className="text-center">
            <p className="text-xs text-white/40">Total</p>
            <p className="text-white font-bold">{Object.keys(users).length}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-white/40">Active</p>
            <p className="text-emerald-400 font-bold">{activeEntries.length}</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-xs text-white/40">Idle</p>
            <p className="text-white/60 font-bold">{Object.keys(users).length - activeEntries.length}</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
