import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import DataEntry from './pages/DataEntry';
import AdminPanel from './pages/AdminPanel';
import Header from './components/Header';
import { CartonProvider } from './context/CartonContext';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("UI Crash:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-10 text-center">
          <h1 className="text-2xl font-bold text-red-600">Something went wrong.</h1>
          <button
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => window.location.href = '/'}
          >
            Reload Application
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [user, setUser] = useState(null);

  // Simple logout handler
  const handleLogout = () => {
    setUser(null);
  };

  return (
    <CartonProvider>
      <ErrorBoundary>
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
                        <AdminPanel user={user} />
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
      </ErrorBoundary>
    </CartonProvider >
  );
}

export default App;
