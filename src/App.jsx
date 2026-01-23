import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DataEntry from './pages/DataEntry';
import AdminPanel from './pages/AdminPanel';
import Header from './components/Header';

function App() {
  const [user, setUser] = useState(null);

  // Simple logout handler
  const handleLogout = () => {
    setUser(null);
  };

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 font-sans text-slate-900">

        {/* Helper to redirect if not logged in */}
        {!user ? (
          <Routes>
            <Route path="/login" element={<Login onLogin={setUser} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <>
            <Header user={user} setShowAdminPanel={() => { }} /> {/* using Link in Header */}
            <Routes>
              {/* Default landing page */}
              <Route path="/" element={<Navigate to="/data-entry" replace />} />
              <Route path="/data-entry" element={<DataEntry user={user} />} />

              {/* Admin Route Protection */}
              <Route
                path="/admin"
                element={
                  user.role === 'admin' ? (
                    <AdminPanel />
                  ) : (
                    <Navigate to="/data-entry" replace />
                  )
                }
              />

              <Route path="*" element={<Navigate to="/data-entry" replace />} />
            </Routes>
          </>
        )}
      </div>
    </Router>
  );
}

export default App;
