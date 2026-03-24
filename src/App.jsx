import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { getUserRole } from './services/authService';
import { SessionProvider } from './store/SessionContext';
import { useSession } from './store/useSession';

import Login from './pages/Login';
import FieldApp from './pages/FieldApp';
import AdminLayout from './pages/AdminLayout';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminTrips from './pages/AdminTrips';
import AdminSettings from './pages/AdminSettings';

function AppRoutes() {
  const { firebaseUser, role, setUser, setRole, setProfile } = useSession();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const profile = await getUserRole(user.uid);
        setUser(user);
        setProfile(profile);
        setRole(profile?.role || 'field');
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
      }
    });
    return unsub;
    // setUser/setRole/setProfile are stable context callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (firebaseUser === undefined) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          !firebaseUser
            ? <Login />
            : <Navigate to={role === 'admin' ? '/admin' : '/field'} replace />
        }
      />

      {/* Field User */}
      <Route
        path="/field"
        element={
          firebaseUser
            ? <FieldApp />
            : <Navigate to="/login" replace />
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          firebaseUser && role === 'admin'
            ? <AdminLayout />
            : <Navigate to="/login" replace />
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="trips" element={<AdminTrips />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      <Route
        path="*"
        element={
          <Navigate
            to={firebaseUser ? (role === 'admin' ? '/admin' : '/field') : '/login'}
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <Router>
        <AppRoutes />
      </Router>
    </SessionProvider>
  );
}
