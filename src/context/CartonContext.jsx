import React, { createContext, useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

// Initialize Socket outside component to prevent multiple connections
const socket = io('http://localhost:5000');

export const CartonProvider = ({ children }) => {

    // --- State ---
    const [cartons, setCartons] = useState([]);
    const [settings, setSettings] = useState({ activeSeason: 'WINTER 2025', lockedByAdmin: false, extraSizes: [] });
    const [isConnected, setIsConnected] = useState(socket.connected);

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

        // 2. Data Sync Listeners
        socket.on('sync_cartons', (data) => {
            console.log('🔄 Sync Event:', data);

            if (data.type === 'UPDATE' && data.carton) {
                setCartons(prev => {
                    const idx = prev.findIndex(c => c._id === data.carton._id);
                    if (idx > -1) {
                        const newArr = [...prev];
                        newArr[idx] = data.carton;
                        return newArr;
                    } else {
                        return [...prev, data.carton];
                    }
                });
            } else if (data.type === 'DELETE' && data.id) {
                setCartons(prev => prev.filter(c => c._id !== data.id));
            } else {
                // Refresh All
                fetchCartons();
            }
        });

        socket.on('sync_settings', (newSettings) => {
            console.log('⚙ Settings Updated:', newSettings);
            setSettings(prev => ({ ...prev, ...newSettings }));
        });

        // 3. Initial Fetch
        fetchCartons();
        fetchSettings();

        // Cleanup
        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('sync_cartons');
            socket.off('sync_settings');
        };
    }, []);

    // --- API Interactions ---

    const fetchCartons = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/cartons');
            if (res.ok) {
                const data = await res.json();
                setCartons(data);
            }
        } catch (e) {
            console.error("Failed to fetch cartons", e);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/settings');
            if (res.ok) {
                const data = await res.json();
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (e) {
            console.error("Failed to fetch settings", e);
        }
    };

    const addCarton = async (carton) => {
        try {
            const res = await fetch('http://localhost:5000/api/cartons', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(carton)
            });
            if (!res.ok) throw new Error("Failed to save carton");
            // State update handled by Socket 'sync_cartons' event
            return await res.json();
        } catch (e) {
            console.error("Error adding carton:", e);
            throw e;
        }
    };

    const clearCartons = async () => {
        // In real-time sync, "clearing session" might mean deleting ALL or just local view?
        // User requirements say "Real-time sync... No duplicate or stale data".
        // Admin's "New Sheet" feature clears ALL data.
        // We should implement a bulk delete API ideally, but for now we iterate or ask backend.
        // Let's assume Admin clears EVERYONE's view.
        // Currently Server doesn't have "Delete All". 
        // I'll implementation a loop for safety or just reset local if 'session' concept exists.
        // BUT user said "Single source of truth (database)".
        // So "New Sheet" = Drop Collection / Delete All.
        // I will add a special endpoint or just warn it's not implemented fully server-side yet?
        // Let's implement client-side iteration for now to be safe with existing APIs.
        // OR better: Just do nothing and warn, because 'clearCartons' was for LocalStorage.
        // Wait, Admin 'New Sheet' calls clearCartons.

        // Let's assume we want to clear the DB.
        if (window.confirm("WARNING: This will delete ALL data from the Real-Time Database for EVERYONE. Continue?")) {
            // For now, since we lack a bulk delete endpoint in the quick server setup:
            // We'll just reset local viewing state? No, data entry users need to clear too.
            // I'll implement a 'reset' socket event if I can, or loop delete.
            // Loop delete for now.
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
            {/* Sync Indicator */}
            <div style={{
                position: 'fixed',
                bottom: 10,
                right: 10,
                background: isConnected ? '#10b981' : '#ef4444',
                color: 'white',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                zIndex: 9999,
                fontWeight: 'bold',
                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
            }}>
                {isConnected ? '⚡ LIVE SYNC' : '🔌 DISCONNECTED'}
            </div>
        </CartonContext.Provider>
    );
};
