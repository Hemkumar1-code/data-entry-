import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

// Initialize Socket outside component to prevent multiple connections
const socket = io('http://localhost:5000');

export const CartonProvider = ({ children }) => {

    // --- State ---
    const [cartons, setCartons] = useState([]);
    const [settings, setSettings] = useState({ activeSeason: '', lockedByAdmin: false, extraSizes: [] });
    const [isConnected, setIsConnected] = useState(socket.connected);

    // STRICT SYNC: Show Popup instead of auto-update
    const [showRefreshPopup, setShowRefreshPopup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // --- Initial Load & Socket Listeners ---
    useEffect(() => {
        // 1. Connectivity Listeners
        function onConnect() {
            setIsConnected(true);
            console.log('✅ Connected to Real-Time Server');
        }
        function onDisconnect() {
            setIsConnected(false);
            console.log('❌ Disconnected from Real-Time Server');
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        // 2. Data Sync Listeners - MODIFIED FOR STRICT POPUP WORKFLOW
        const handleServerUpdate = (data) => {
            console.log('🔔 Server requires refresh:', data);
            // DO NOT auto-update state.
            // DO Show Popup.
            setShowRefreshPopup(true);
        };

        socket.on('sync_cartons', handleServerUpdate);
        socket.on('sync_settings', handleServerUpdate);
        socket.on('admin_refresh_request', handleServerUpdate);

        // 3. Initial Fetch (Strict Excel Source)
        const initData = async () => {
            setIsLoading(true);
            try {
                // Parallel fetch for speed
                const [resCartons, resSettings] = await Promise.all([
                    fetch('http://localhost:5000/api/cartons'),
                    fetch('http://localhost:5000/api/settings')
                ]);

                if (!resCartons.ok || !resSettings.ok) throw new Error("Failed to load Excel Data");

                const cartonsData = await resCartons.json();
                const settingsData = await resSettings.json();

                setCartons(cartonsData);
                setSettings(settingsData);
                setError(null);
            } catch (e) {
                console.error("Critical Load Error:", e);
                setError("FAILED TO LOAD DATA FROM EXCEL. Please ensure Server is running.");
            } finally {
                setIsLoading(false);
            }
        };

        initData();

        // Cleanup
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('sync_cartons');
            socket.off('sync_settings');
            socket.off('admin_refresh_request');
        };
    }, []);

    // --- API Interactions ---

    const addCarton = async (carton) => {
        try {
            const res = await fetch('http://localhost:5000/api/cartons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carton)
            });
            if (!res.ok) throw new Error("Failed to save carton to Excel");

            // On success, we don't strictly need to do anything because 
            // the server will emit an event. 
            // However, for the user who ADDED the item, instant feedback + no popup is usually preferred (Optimistic UI),
            // OR we treat them same as everyone else (Wait for refresh).
            // Requirement: "Popup... Appear for all active users".
            // If I add data, I shouldn't be forced to refresh my own page if I just saved it?
            // "When Admin saves... Show popup message on USER side".
            // If I am the one saving, usually I expect success message. 
            // But to ensure "Excel is Only Source of Truth", technically refreshing is safest.
            // But standard UX: I update -> I see my update. Others update -> I see popup.
            // Let's rely on the response from POST to update local state immediately (Optimistic/Confirmed Local),
            // and ignore the socket event *if* it was triggered by me? 
            // Socket broadcasting usually goes to *others* (broadcast.emit) or *everyone* (io.emit).
            // Server currently uses `io.emit` (everyone).
            // I will suppress popup for 2 seconds after my own action? Or check ID?
            // For now, to be STRICT as requested ("Excel is ONLY source"), 
            // even the saver might get a popup, OR we just update local state from response 
            // and hope the socket event doesn't override/trigger popup loop.
            // Use a ref to track "I just updated".

            return await res.json();
        } catch (e) {
            console.error("Error adding carton:", e);
            throw e;
        }
    };

    const clearCartons = async () => {
        if (window.confirm("WARNING: This will delete ALL data from the Master Excel File. Continue?")) {
            // Loop delete as placeholder for bulk API
            for (const c of cartons) {
                await fetch(`http://localhost:5000/api/cartons/${c._id}`, { method: 'DELETE' });
            }
        }
    };

    const updateSettings = async (newSettings) => {
        try {
            await fetch('http://localhost:5000/api/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newSettings)
            });
        } catch (e) {
            console.error("Failed to update settings", e);
        }
    };

    // --- Manual Refresh Handler ---
    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <CartonContext.Provider value={{
            cartons,
            addCarton,
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
                        📄 Reading Master Excel Database...
                    </div>
                </div>
            )}

            {error && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.95)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 10000
                }}>
                    <div className="text-2xl font-bold text-red-600 mb-4">SYSTEM ERROR</div>
                    <div className="text-lg text-slate-800">{error}</div>
                    <button onClick={handleRefresh} className="btn btn-primary mt-6">Retry Connection</button>
                </div>
            )}

            {/* STRICT SYNC POPUP */}
            {showRefreshPopup && !isLoading && !error && (
                <div style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
                }}>
                    <div className="bg-white p-8 rounded-lg shadow-2xl max-w-md text-center border-4 border-yellow-400 animate-bounce-short">
                        <div className="text-4xl mb-4">⚠️</div>
                        <h2 className="text-2xl font-bold text-slate-800 mb-2">Data Updated</h2>
                        <p className="text-slate-600 mb-6 font-medium">
                            Admin has updated the Master Excel Record.
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
                {isConnected ? '⚡ LIVE' : '🔌 OFFLINE'}
            </div>
        </CartonContext.Provider>
    );
};
