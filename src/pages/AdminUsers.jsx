import { useState, useEffect } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { db, onValue, ref } from '../firebase';
import { registerUser } from '../services/authService';
import { deleteUserRecord } from '../services/adminService';
import GlassCard from '../components/GlassCard';

export default function AdminUsers() {
  const [users, setUsers] = useState({});
  const [tracking, setTracking] = useState({});
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'field' });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const unsubUsers = onValue(ref(db, 'users'), (snap) => setUsers(snap.val() || {}));
    const unsubTrack = onValue(ref(db, 'tracking'), (snap) => setTracking(snap.val() || {}));
    return () => { unsubUsers(); unsubTrack(); };
  }, []);

  const isActive = (uid) => tracking[uid]?.meta?.active === true;

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      await registerUser(form.email, form.password, form.role, form.name);
      setForm({ name: '', email: '', password: '', role: 'field' });
      setShowAdd(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (uid) => {
    if (!window.confirm('Delete this user record from the database?')) return;
    await deleteUserRecord(uid);
  };

  return (
    <div className="flex-1 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Users</h2>
            <p className="text-white/40 text-sm mt-0.5">{Object.keys(users).length} registered</p>
          </div>
          <Motion.button
            onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all"
            whileTap={{ scale: 0.96 }}
          >
            + Add User
          </Motion.button>
        </div>

        {/* Add User Form */}
        <AnimatePresence>
          {showAdd && (
            <Motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6"
            >
              <GlassCard className="p-6">
                <h3 className="text-white font-semibold mb-4">New User</h3>
                <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Name</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      placeholder="Full Name"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      required
                      placeholder="email@example.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Password</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 uppercase tracking-wider">Role</label>
                    <select
                      value={form.role}
                      onChange={(e) => setForm({ ...form, role: e.target.value })}
                      className="w-full bg-[#0B1220] border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
                    >
                      <option value="field">Field User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  {error && (
                    <p className="col-span-full text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-2">
                      {error}
                    </p>
                  )}
                  <div className="col-span-full flex gap-3">
                    <button
                      type="submit"
                      disabled={adding}
                      className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-semibold transition-all disabled:opacity-50"
                    >
                      {adding ? 'Creating…' : 'Create User'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAdd(false)}
                      className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </GlassCard>
            </Motion.div>
          )}
        </AnimatePresence>

        {/* Users Table */}
        <GlassCard className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-xs text-white/40 uppercase tracking-wider px-6 py-4">Name</th>
                  <th className="text-left text-xs text-white/40 uppercase tracking-wider px-6 py-4">Email</th>
                  <th className="text-left text-xs text-white/40 uppercase tracking-wider px-6 py-4">Role</th>
                  <th className="text-left text-xs text-white/40 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs text-white/40 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(users).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-white/30 py-12 text-sm">No users yet</td>
                  </tr>
                ) : (
                  Object.entries(users).map(([uid, u]) => (
                    <Motion.tr
                      key={uid}
                      className="border-b border-white/5 hover:bg-white/3 transition-all"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <span className="text-white text-sm font-medium">{u.name || '—'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-white/60 text-sm">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : 'bg-blue-500/20 text-blue-400'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`flex items-center gap-1.5 text-xs font-medium ${isActive(uid) ? 'text-emerald-400' : 'text-white/30'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive(uid) ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                          {isActive(uid) ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleDelete(uid)}
                          className="text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all"
                        >
                          Delete
                        </button>
                      </td>
                    </Motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
