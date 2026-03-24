import { useState } from 'react';
import { SessionContext } from './sessionCtx';

export function SessionProvider({ children }) {
  const [session, setSession] = useState({ firebaseUser: null, role: null, profile: null });

  const setUser = (firebaseUser) => setSession((s) => ({ ...s, firebaseUser }));
  const setRole = (role) => setSession((s) => ({ ...s, role }));
  const setProfile = (profile) => setSession((s) => ({ ...s, profile }));
  const clearSession = () => setSession({ firebaseUser: null, role: null, profile: null });

  return (
    <SessionContext.Provider value={{ ...session, setUser, setRole, setProfile, clearSession }}>
      {children}
    </SessionContext.Provider>
  );
}
