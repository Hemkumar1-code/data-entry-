import { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { loginUser, getUserRole } from '../services/authService';
import { useSession } from '../store/useSession';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/GlassCard';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser, setRole, setProfile } = useSession();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cred = await loginUser(email, password);
      const profile = await getUserRole(cred.user.uid);
      setUser(cred.user);
      setProfile(profile);
      if (profile?.role === 'admin') {
        setRole('admin');
        navigate('/admin');
      } else {
        setRole('field');
        navigate('/field');
      }
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
      </div>

      <GlassCard className="w-full max-w-md p-8 relative z-10">
        <div className="text-center mb-8">
          <Motion.div
            className="text-5xl mb-4"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ repeat: Infinity, duration: 3 }}
          >
            📍
          </Motion.div>
          <h1 className="text-3xl font-bold text-white">LiveTrack</h1>
          <p className="text-white/50 text-sm mt-1">Real-time field operations</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <div>
            <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
            />
          </div>

          <AnimatePresence>
            {error && (
              <Motion.p
                className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </Motion.p>
            )}
          </AnimatePresence>

          <Motion.button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            whileTap={{ scale: 0.97 }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </Motion.button>
        </form>

        <p className="text-center text-white/30 text-xs mt-6">
          Admin and field users share the same login
        </p>
      </GlassCard>
    </div>
  );
}
