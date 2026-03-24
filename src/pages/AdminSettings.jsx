import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { getWhatsAppNumbers, saveWhatsAppNumbers } from '../services/adminService';
import GlassCard from '../components/GlassCard';

export default function AdminSettings() {
  const [numbers, setNumbers] = useState({});
  const [newNumber, setNewNumber] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getWhatsAppNumbers().then((nums) => {
      setNumbers(nums || {});
      setLoading(false);
    });
  }, []);

  const addNumber = () => {
    const trimmed = newNumber.trim().replace(/\s/g, '');
    if (!trimmed) return;
    const key = Date.now().toString();
    setNumbers((prev) => ({ ...prev, [key]: trimmed }));
    setNewNumber('');
  };

  const removeNumber = (key) => {
    setNumbers((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    await saveWhatsAppNumbers(numbers);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-white">Settings</h2>
          <p className="text-white/40 text-sm mt-0.5">Configure WhatsApp notifications</p>
        </div>

        <GlassCard className="p-6">
          <h3 className="text-white font-semibold mb-1">WhatsApp Numbers</h3>
          <p className="text-white/40 text-sm mb-5">
            These numbers receive a notification when a field user completes a trip.
          </p>

          {loading ? (
            <p className="text-white/30 text-sm">Loading…</p>
          ) : (
            <>
              {/* Add number */}
              <div className="flex gap-3 mb-5">
                <input
                  value={newNumber}
                  onChange={(e) => setNewNumber(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNumber()}
                  placeholder="+91 98765 43210"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                />
                <Motion.button
                  onClick={addNumber}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all"
                  whileTap={{ scale: 0.96 }}
                >
                  Add
                </Motion.button>
              </div>

              {/* Numbers list */}
              <div className="space-y-2 mb-5">
                <AnimatePresence>
                  {Object.entries(numbers).length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-6">No numbers added yet</p>
                  ) : (
                    Object.entries(numbers).map(([key, num]) => (
                      <Motion.div
                        key={key}
                        className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📱</span>
                          <span className="text-white text-sm font-mono">{num}</span>
                        </div>
                        <button
                          onClick={() => removeNumber(key)}
                          className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Remove
                        </button>
                      </Motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              <Motion.button
                onClick={handleSave}
                disabled={saving}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  saved
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-white'
                } disabled:opacity-50`}
                whileTap={{ scale: 0.97 }}
              >
                {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Settings'}
              </Motion.button>
            </>
          )}
        </GlassCard>

        {/* Info card */}
        <GlassCard className="p-6 mt-4">
          <h3 className="text-white font-semibold mb-2">How notifications work</h3>
          <p className="text-white/50 text-sm leading-relaxed">
            When a field user stops tracking, the app opens WhatsApp with a pre-filled message to each
            saved number. For fully automated server-side delivery, integrate Twilio&apos;s WhatsApp API on a
            backend/cloud function using the numbers stored here.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
