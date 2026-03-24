import { motion as Motion, AnimatePresence } from 'framer-motion';
import { useLiveTracking } from '../hooks/useLiveTracking';
import { useSession } from '../store/useSession';
import { logoutUser } from '../services/authService';
import { getWhatsAppNumbers } from '../services/adminService';
import { sendWhatsAppFallback } from '../services/notifyService';
import GlassCard from '../components/GlassCard';
import { formatDuration, intervalToDuration } from 'date-fns';
import { useState } from 'react';

function formatMs(ms) {
  if (!ms || ms <= 0) return '0 min';
  const d = intervalToDuration({ start: 0, end: ms });
  return formatDuration(d, { format: ['hours', 'minutes', 'seconds'] }) || '< 1s';
}

export default function FieldApp() {
  const { firebaseUser, profile, clearSession } = useSession();
  const uid = firebaseUser?.uid;
  const { active, distance, startTime, error, start, stop } = useLiveTracking(uid);
  const [summary, setSummary] = useState(null);
  const [stopping, setStopping] = useState(false);

  const handleStop = async () => {
    setStopping(true);
    const result = await stop();
    setStopping(false);
    if (result) {
      setSummary(result);
      try {
        const numbers = await getWhatsAppNumbers();
        const numList = Object.values(numbers || {});
        if (numList.length > 0) {
          sendWhatsAppFallback(numList, {
            userName: profile?.name || firebaseUser?.email || 'Field User',
            distanceKm: (result.distance / 1000).toFixed(2),
            durationMin: Math.round(result.durationMs / 60000),
            mapLink: 'https://www.openstreetmap.org',
          });
        }
      } catch {
        // notification errors are non-critical
      }
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    clearSession();
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex flex-col items-center justify-center p-4 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={`absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full blur-3xl transition-all duration-1000 ${
            active ? 'bg-emerald-500/15' : 'bg-white/5'
          }`}
        />
      </div>

      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-3">
        <span className="text-white/40 text-sm">{profile?.name || firebaseUser?.email}</span>
        <button
          onClick={handleLogout}
          className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 px-3 py-1.5 rounded-lg transition-all"
        >
          Logout
        </button>
      </div>

      <GlassCard className="w-full max-w-sm p-8 text-center relative z-10">
        <h1 className="text-2xl font-bold text-white mb-1">LiveTrack</h1>
        <p className="text-white/40 text-sm mb-8">Field User</p>

        {/* Animated pulse indicator */}
        <div className="relative mx-auto mb-8 w-36 h-36 flex items-center justify-center">
          {active && (
            <>
              <Motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-400/60"
                animate={{ scale: [1, 1.5, 1.5], opacity: [1, 0, 0] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'easeOut' }}
              />
              <Motion.div
                className="absolute inset-0 rounded-full border-2 border-emerald-400/40"
                animate={{ scale: [1, 1.8, 1.8], opacity: [1, 0, 0] }}
                transition={{ repeat: Infinity, duration: 2, delay: 0.5, ease: 'easeOut' }}
              />
            </>
          )}
          <Motion.div
            className={`w-28 h-28 rounded-full border-4 flex flex-col items-center justify-center transition-all duration-500 ${
              active
                ? 'border-emerald-400 bg-emerald-500/20'
                : 'border-white/20 bg-white/5'
            }`}
            animate={
              active
                ? {
                    boxShadow: [
                      '0 0 0 0 rgba(52,211,153,0.4)',
                      '0 0 0 20px rgba(52,211,153,0)',
                      '0 0 0 0 rgba(52,211,153,0)',
                    ],
                  }
                : {}
            }
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <span className="text-3xl">{active ? '📡' : '📍'}</span>
            <span className={`text-xs font-semibold mt-1 ${active ? 'text-emerald-400' : 'text-white/40'}`}>
              {active ? 'LIVE' : 'IDLE'}
            </span>
          </Motion.div>
        </div>

        {/* Status */}
        <AnimatePresence mode="wait">
          <Motion.p
            key={active ? 'active' : 'stopped'}
            className={`text-sm font-medium mb-6 ${active ? 'text-emerald-400' : 'text-white/50'}`}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {active ? '● Tracking Active' : '○ Tracking Stopped'}
          </Motion.p>
        </AnimatePresence>

        {/* Stats */}
        {active && (
          <Motion.div
            className="grid grid-cols-2 gap-3 mb-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="bg-white/5 rounded-xl px-3 py-2.5">
              <p className="text-xs text-white/40 mb-0.5">Distance</p>
              <p className="text-white font-semibold">{(distance / 1000).toFixed(2)} km</p>
            </div>
            <div className="bg-white/5 rounded-xl px-3 py-2.5">
              <p className="text-xs text-white/40 mb-0.5">Started</p>
              <p className="text-white font-semibold text-xs">
                {startTime ? new Date(startTime).toLocaleTimeString() : '--'}
              </p>
            </div>
          </Motion.div>
        )}

        {/* Buttons */}
        <div className="space-y-3">
          <Motion.button
            onClick={start}
            disabled={active}
            className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.97 }}
          >
            🚀 Start Tracking
          </Motion.button>
          <Motion.button
            onClick={handleStop}
            disabled={!active || stopping}
            className="w-full py-4 rounded-2xl bg-red-500 hover:bg-red-400 text-white font-bold text-base transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            whileTap={{ scale: 0.97 }}
          >
            {stopping ? 'Saving…' : '⏹ Stop Tracking'}
          </Motion.button>
        </div>

        {error && (
          <Motion.p
            className="mt-4 text-red-400 text-xs bg-red-500/10 rounded-xl px-4 py-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            ⚠️ {error}
          </Motion.p>
        )}
      </GlassCard>

      {/* Trip Summary Modal */}
      <AnimatePresence>
        {summary && (
          <Motion.div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <GlassCard className="w-full max-w-sm p-6 text-center">
              <div className="text-4xl mb-4">🏁</div>
              <h2 className="text-xl font-bold text-white mb-2">Trip Complete!</h2>
              <div className="space-y-3 my-6">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Distance</span>
                  <span className="text-white font-semibold">{(summary.distance / 1000).toFixed(2)} km</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Duration</span>
                  <span className="text-white font-semibold">{formatMs(summary.durationMs)}</span>
                </div>
              </div>
              <button
                onClick={() => setSummary(null)}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all"
              >
                Done
              </button>
            </GlassCard>
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
