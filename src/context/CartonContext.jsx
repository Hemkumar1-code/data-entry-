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
    const [isConnected, setIsConnected] = useState(false);
    const [notification, setNotification] = useState(null); // { message, type }
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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

                // NOTIFICATION LOGIC
                // If remote update (not local latency compensation)
                if (!snapshot.metadata.hasPendingWrites && isConnected) {
                    // Check if strictly an update (size changed or content changed)
                    // For now, simple "Live Update" toast
                    console.log("🔔 Remote update received for Cartons");
                    showNotification("Live Update: Session data updated by Admin/System.");
                }

                setCartons(newCartons);
                setIsConnected(true);
                setIsLoading(false);
            },
            (err) => {
                console.error("Cartons Listener Error:", err);
                setError("Failed to connect to Firebase Cartons. " + err.message);
                setIsConnected(false);
            }
        );

        // 2. Settings Listener (Global for everyone)
        const unsubSettings = onSnapshot(doc(db, "settings", "global"),
            (docSnap) => {
                if (docSnap.exists()) {
                    setSettings(docSnap.data());
                    if (!docSnap.metadata.hasPendingWrites && isConnected) {
                        showNotification("Live Update: Global Settings changed.");
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
            (err) => {
                console.error("Settings Listener Error:", err);
            }
        );

        return () => {
            unsubCartons();
            unsubSettings();
        };
    }, [user]); // Re-subscribe if user changes

    // --- Actions ---

    const showNotification = (msg) => {
        setNotification({ message: msg, type: 'info' });
        // Auto-hide after 3 seconds
        setTimeout(() => setNotification(null), 3000);
    };

    const addCarton = async (carton) => {
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
        try {
            await deleteDoc(doc(db, "cartons", id));
        } catch (e) {
            console.error("Error deleting carton:", e);
        }
    };

    const clearCartons = async () => {
        if (window.confirm("WARNING: Will delete ALL displayed data from Cloud. Continue?")) {
            cartons.forEach(async (c) => {
                await deleteDoc(doc(db, "cartons", c._id));
            });
        }
    };

    const updateSettings = async (newSettings) => {
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
            isConnected
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

            {/* LIVE UPDATE TOAST (Non-blocking) */}
            {notification && (
                <div className="fixed bottom-4 right-4 bg-gray-900 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 z-[9999] animate-bounce-short border-l-4 border-green-500">
                    <span className="text-2xl">⚡</span>
                    <div>
                        <h4 className="font-bold text-sm uppercase text-green-400">Real-time Update</h4>
                        <p className="text-sm font-medium">{notification.message}</p>
                    </div>
                </div>
            )}

            {/* Connection Indicator */}
            <div style={{
                position: 'fixed', bottom: 10, left: 10,
                background: isConnected ? '#10b981' : '#ef4444',
                color: 'white', padding: '4px 8px', borderRadius: '4px',
                fontSize: '10px', zIndex: 50, fontWeight: 'bold'
            }}>
                {isConnected ? '🔥 ONLINE' : '🔌 DISCONNECTED'}
            </div>
        </CartonContext.Provider>
    );
};
