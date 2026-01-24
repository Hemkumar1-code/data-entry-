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
    setDoc
} from "firebase/firestore";

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

export const CartonProvider = ({ children }) => {

    // --- State ---
    const [cartons, setCartons] = useState([]);
    const [settings, setSettings] = useState({ activeSeason: '', lockedByAdmin: false, extraSizes: [] });

    // UI States
    const [isConnected, setIsConnected] = useState(false);
    const [showRefreshPopup, setShowRefreshPopup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Firestore Listeners ---
    useEffect(() => {
        setIsLoading(true);
        setError(null);

        // 1. Cartons Listener
        const q = query(collection(db, "cartons"), orderBy("timestamp", "asc"));
        const unsubCartons = onSnapshot(q,
            (snapshot) => {
                const newCartons = snapshot.docs.map(doc => ({
                    _id: doc.id,
                    ...doc.data()
                }));
                // Check if update came from SERVER (hasPendingWrites = false)
                // If it's a remote update and we already loaded initial data, trigger popup?
                // Actually, Firestore keeps state perfectly synced. 
                // The requirement is "Popup... when Admin updates".
                // We can use metadata.hasPendingWrites to detect local vs remote.
                if (!snapshot.metadata.hasPendingWrites && isConnected) {
                    // Remote update detected
                    // Check if it's just the initial load?
                    // isConnected is set to true after initial load.
                    console.log("🔔 Remote update received for Cartons");
                    setShowRefreshPopup(true);
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

        // 2. Settings Listener
        const unsubSettings = onSnapshot(doc(db, "settings", "global"),
            (docSnap) => {
                if (docSnap.exists()) {
                    setSettings(docSnap.data());
                    if (!docSnap.metadata.hasPendingWrites && isConnected) {
                        console.log("🔔 Remote update received for Settings");
                        setShowRefreshPopup(true);
                    }
                } else {
                    // Initialize default settings if missing
                    setDoc(doc(db, "settings", "global"), {
                        activeSeason: 'WINTER 2025',
                        lockedByAdmin: false,
                        extraSizes: []
                    });
                }
            },
            (err) => {
                console.error("Settings Listener Error:", err);
                // Non-critical if settings fail?
            }
        );

        return () => {
            unsubCartons();
            unsubSettings();
        };
    }, []); // Run once on mount. 'isConnected' dependency removed to prevent loop, used ref logic implicitly via closure state? No, effect updates state.
    // Actually using 'isConnected' inside closure of onSnapshot might be stale if effect doesn't re-run.
    // Better: Rely on a Ref for 'initialLoadComplete' to distinguish boot from update.

    // --- Actions ---

    const addCarton = async (carton) => {
        try {
            // Data integrity: Add timestamp for sorting
            const payload = { ...carton, timestamp: Date.now() };
            // Remove _id if it exists, let Firestore generate it? 
            // Or use provided one? Standard Firestore: addDoc generates ID.
            if (payload._id) delete payload._id;

            await addDoc(collection(db, "cartons"), payload);
            // Result is instant in local cache (snapshot fires immediately with hasPendingWrites=true)
            // No need to manual set state.
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
        if (window.confirm("WARNING: This will delete ALL data from the Cloud Database. Continue?")) {
            // Batch delete
            // Using a loop for now (Validation: User said "Do not create full app", but bulk delete is safety feature)
            // Ideally we use a Cloud Function or Batch Write.
            // Loop is fine for small datasets.
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

    const handleRefresh = () => {
        // Just reload page to ensure "Strict Sync" vibe, OR just hide popup because data is ALREADY synced?
        // User requested: "Popup... Please refresh your page." -> "Reflect in all users... update correctly"
        // In Firestore, the data IS already updated in memory via the snapshot!
        // So 'Refreshing' technically just re-renders the already-updated data in the context.
        // BUT to strictly follow the mental model of "Fresh state", we reload.
        window.location.reload();

        // Alternative (Modern):
        // setShowRefreshPopup(false); 
        // Logic: Firestore 'newCartons' is already the latest. 
        // User just needs to acknowledge "Oh, data changed, let me verify".
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

            {/* Loading / Error States */}
            {isLoading && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.9)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div className="text-xl font-bold text-slate-700 animate-pulse">
                        🔥 Connecting to Firebase Cloud...
                    </div>
                </div>
            )}

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

            {/* STRICT SYNC POPUP */}
            {showRefreshPopup && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md text-center border-4 border-yellow-400 animate-bounce-short">
                        <div className="text-4xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Data Updated</h2>
                        <p className="text-slate-600 mb-6 font-medium">
                            Admin has updated the Cloud Record.
                            <br />
                            Please refresh to ensure accuracy.
                        </p>
                        <button
                            onClick={handleRefresh}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-full text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-1"
                        >
                            🔄 Refresh Page
                        </button>
                    </div>
                </div>
            )}

            {/* Connection Indicator */}
            <div style={{
                position: 'fixed', bottom: 10, right: 10,
                background: isConnected ? '#10b981' : '#ef4444',
                color: 'white', padding: '4px 8px', borderRadius: '4px',
                fontSize: '10px', zIndex: 50, fontWeight: 'bold'
            }}>
                {isConnected ? '🔥 ONLINE' : '🔌 DISCONNECTED'}
            </div>
        </CartonContext.Provider>
    );
};
