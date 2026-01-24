import React, { createContext, useState, useEffect, useContext } from 'react';
import { db } from '../firebase';
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    setDoc,
    where
} from "firebase/firestore";

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

export const CartonProvider = ({ children, user }) => {

    // --- State ---
    const [cartons, setCartons] = useState([]);
    const [settings, setSettings] = useState({ activeSeason: '', lockedByAdmin: false, extraSizes: [] });

    // UI States
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [notification, setNotification] = useState(null); // { message, type }
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Connection Detection (Robust) ---
    useEffect(() => {
        const handleStatusChange = () => {
            const online = navigator.onLine;
            setIsOnline(online);
            if (!online) {
                showNotification("Connection Lost. You are offline.", "error");
            } else {
                showNotification("Connection Restored. Back online!", "success");
            }
        };

        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

    // --- Firestore Listeners ---
    useEffect(() => {
        if (!user) {
            setCartons([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        setError(null);

        // 1. Cartons Listener
        let q;
        if (user.role === 'admin') {
            // Admin sees ALL, sorted by time
            q = query(collection(db, "cartons"), orderBy("timestamp", "asc"));
        } else {
            // Users see ONLY their own data
            // Note: Client-side sort is safer to avoid missing index errors for compound queries
            q = query(collection(db, "cartons"), where("createdBy", "==", user.email));
        }

        let isInitialLoad = true; // Local mutable flag for this listener

        const unsubCartons = onSnapshot(q,
            (snapshot) => {
                const newCartons = snapshot.docs.map(doc => ({
                    _id: doc.id,
                    ...doc.data()
                }));

                // Client-side sort for users (since we removed orderBy to avoid index issues)
                if (user.role !== 'admin') {
                    newCartons.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
                }

                // NOTIFICATION LOGIC - Remote Updates
                // Only show if we are ONLINE and it's not a local write
                // Use isInitialLoad to prevent notification on first fetch
                if (!snapshot.metadata.hasPendingWrites && navigator.onLine && !isInitialLoad) {
                    console.log("🔔 Remote update received for Cartons");
                    showNotification("Admin updated the session/cartons", "info");
                }

                setCartons(newCartons);
                setIsLoading(false);
                isInitialLoad = false; // Mark initial load as complete
            },
            (err) => {
                console.error("Cartons Listener Error:", err);
                // Only set error if we are supposed to be online
                if (navigator.onLine) {
                    setError("Sync Error: " + err.message);
                }
            }
        );

        // 2. Settings Listener (Global for everyone)
        const unsubSettings = onSnapshot(doc(db, "settings", "global"),
            (docSnap) => {
                if (docSnap.exists()) {
                    setSettings(docSnap.data());
                    if (!docSnap.metadata.hasPendingWrites && navigator.onLine && !isLoading) {
                        showNotification("Live Update: Global Settings changed.", "info");
                    }
                } else {
                    // Initialize default settings if missing (Only Admin should strictly do this, but safe fallback)
                    if (user.role === 'admin') {
                        setDoc(doc(db, "settings", "global"), {
                            activeSeason: 'WINTER 2025',
                            lockedByAdmin: false,
                            extraSizes: []
                        });
                    }
                }
            },
            (err) => console.error("Settings Listener Error:", err)
        );

        return () => {
            unsubCartons();
            unsubSettings();
        };
    }, [user]); // Re-subscribe if user changes

    // --- Actions ---

    const showNotification = (msg, type = 'info') => {
        setNotification({ message: msg, type });
        // Auto-hide after 3 seconds
        setTimeout(() => setNotification(null), 3000);
    };

    const addCarton = async (carton) => {
        if (!isOnline) {
            alert("You are OFFLINE. Please check your internet connection.");
            return;
        }
        try {
            // Data integrity: Add timestamp and Creator
            const payload = {
                ...carton,
                timestamp: Date.now(),
                createdBy: user?.email || 'anonymous' // Tag with user email
            };

            if (payload._id) delete payload._id;

            await addDoc(collection(db, "cartons"), payload);
        } catch (e) {
            console.error("Error adding carton:", e);
            alert("Failed to save to Cloud: " + e.message);
            throw e;
        }
    };

    const deleteCarton = async (id) => {
        if (!isOnline) return;
        try {
            await deleteDoc(doc(db, "cartons", id));
        } catch (e) {
            console.error("Error deleting carton:", e);
        }
    };

    const clearCartons = async () => {
        if (!isOnline) return;
        if (window.confirm("WARNING: Will delete ALL displayed data from Cloud. Continue?")) {
            cartons.forEach(async (c) => {
                await deleteDoc(doc(db, "cartons", c._id));
            });
        }
    };

    const updateSettings = async (newSettings) => {
        if (!isOnline) {
            alert("Offline: Cannot update settings.");
            return;
        }
        try {
            await setDoc(doc(db, "settings", "global"), newSettings, { merge: true });
        } catch (e) {
            console.error("Failed to update settings", e);
            alert("Failed to update settings: " + e.message);
        }
    };

    return (
        <CartonContext.Provider value={{
            cartons,
            addCarton,
            deleteCarton,
            clearCartons,
            settings,
            updateSettings,
            isOnline
        }}>
            {children}

            {/* Loading Overlay (Initial Only) */}
            {isLoading && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div className="text-xl font-bold text-slate-700 animate-pulse">
                        🔥 Syncing with Firebase...
                    </div>
                </div>
            )}

            {/* Error Overlay */}
            {error && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div className="text-2xl font-bold text-red-600 mb-4">CONNECTION ERROR</div>
                    <div className="text-lg text-slate-800 mb-2">{error}</div>
                    <button onClick={() => window.location.reload()} className="btn btn-primary mt-6">Retry Connection</button>
                </div>
            )}

            {/* NOTIFICATIONS (Toast) */}
            {notification && (
                <div className={`fixed bottom-4 right-4 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 z-[9999] animate-bounce-short border-l-4 ${notification.type === 'error' ? 'bg-red-900 border-red-500' :
                    notification.type === 'success' ? 'bg-green-900 border-green-500' :
                        'bg-gray-900 border-blue-500'
                    }`}>
                    <span className="text-2xl">
                        {notification.type === 'error' ? '🔌' : notification.type === 'success' ? '⚡' : 'ℹ️'}
                    </span>
                    <div>
                        <h4 className={`font-bold text-sm uppercase ${notification.type === 'error' ? 'text-red-400' :
                            notification.type === 'success' ? 'text-green-400' :
                                'text-blue-400'
                            }`}>
                            {notification.type === 'error' ? 'Offline' : notification.type === 'success' ? 'Online' : 'Update'}
                        </h4>
                        <p className="text-sm font-medium">{notification.message}</p>
                    </div>
                </div>
            )}

            {/* Connection Indicator */}
            <div style={{
                position: 'fixed', bottom: 10, left: 10,
                background: isOnline ? '#10b981' : '#ef4444',
                color: 'white', padding: '4px 8px', borderRadius: '4px',
                fontSize: '10px', zIndex: 50, fontWeight: 'bold'
            }}>
                {isOnline ? '🔥 ONLINE' : '🔌 DISCONNECTED'}
            </div>
        </CartonContext.Provider>
    );
};
