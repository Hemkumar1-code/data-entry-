import { NavLink } from 'react-router-dom';
import { motion as Motion } from 'framer-motion';
import { logoutUser } from '../services/authService';
import { useSession } from '../store/useSession';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin', icon: '🗺' },
  { label: 'Users', path: '/admin/users', icon: '👥' },
  { label: 'Trips', path: '/admin/trips', icon: '📍' },
  { label: 'Settings', path: '/admin/settings', icon: '⚙️' },
];

export default function Sidebar() {
  const { clearSession } = useSession();

  const handleLogout = async () => {
    await logoutUser();
    clearSession();
  };

  return (
    <Motion.aside
      className="w-60 min-h-screen bg-white/5 backdrop-blur-xl border-r border-white/10 flex flex-col py-6 px-4"
      initial={{ x: -60, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-8 px-2">
        <h1 className="text-xl font-bold text-emerald-400 tracking-tight">LiveTrack</h1>
        <p className="text-xs text-white/40 mt-0.5">Ops Visibility</p>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map(({ label, path, icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/admin'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? 'bg-emerald-500/20 text-emerald-400 font-medium'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={handleLogout}
        className="mt-4 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-all text-left flex items-center gap-3"
      >
        <span>🚪</span> Logout
      </button>
    </Motion.aside>
  );
}
