import React, { createContext, useState, useEffect, useContext, useRef } from 'react';
import { GOOGLE_SCRIPT_URL } from '../utils/constants';

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

const POLL_INTERVAL_MS = 10000; // Poll every 10 seconds

export const CartonProvider = ({ children }) => {

    // --- State ---
    const [cartons, setCartons] = useState([]);
    const [settings, setSettings] = useState({ activeSeason: '', lockedByAdmin: false, extraSizes: [] });

    // UI States
    const [isConnected, setIsConnected] = useState(false); // Connected to Google Cloud
    const [showRefreshPopup, setShowRefreshPopup] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    // Refs for Polling
    const lastSyncTimeRef = useRef(0);
    const pollingIntervalRef = useRef(null);

    // --- API Helpers ---

    // Generic POST to Google Script
    const apiCall = async (action, payload = null) => {
        if (!GOOGLE_SCRIPT_URL || GOOGLE_SCRIPT_URL.includes("YOUR_DEPLOYMENT_ID")) {
            throw new Error("Please configure GOOGLE_SCRIPT_URL in constants.js");
        }

        const url = payload ? GOOGLE_SCRIPT_URL : `${GOOGLE_SCRIPT_URL}?action=${action}`;

        // Google Apps Script Web App requires distinct handling for POST
        // For GET, we append action to query string.
        // For POST, we use 'no-cors' sometimes or 'text/plain' to avoid CORS preflight issues with GAS.
        // Standard Fetch with GAS often follows redirects.

        const options = payload ? {
            method: 'POST',
            body: JSON.stringify(payload)
        } : {
            method: 'GET'
        };

        // Append action to POST body/query if needed, but GAS 'doPost' reads e.parameter.action too
        // It's safer to put action in URL even for POST in some GAS patterns, 
        // OR put it in the body. My GoogleScript.gs reads `e.parameter.action`.
        const fetchUrl = payload ? `${GOOGLE_SCRIPT_URL}?action=${action}` : url;

        const res = await fetch(fetchUrl, options);
        if (!res.ok) throw new Error(`API Error: ${res.statusText}`);
        return await res.json();
    };

    // --- Initial Load & Polling ---
    useEffect(() => {
        let mounted = true;

        const initData = async () => {
            setIsLoading(true);
            try {
                // Fetch All Data (doGet)
                const data = await apiCall('getData'); // doGet doesn't need action really but consistency
                // My doGet returns {cartons, settings}

                if (mounted) {
                    setCartons(data.cartons || []);
                    setSettings(data.settings || { activeSeason: '', lockedByAdmin: false, extraSizes: [] });
                    setIsConnected(true);
                    setError(null);
                    lastSyncTimeRef.current = Date.now(); // Mark our sync time
                }
            } catch (e) {
                console.error("Critical Load Error:", e);
                if (mounted) {
                    setError(`FAILED TO LOAD FROM GOOGLE SHEET. ${e.message}`);
                    setIsConnected(false);
                }
            } finally {
                if (mounted) setIsLoading(false);
            }
        };

        const checkUpdates = async () => {
            if (showRefreshPopup) return; // Stop polling if already waiting for refresh

            try {
                // Poll for Metadata
                const meta = await apiCall('getMetadata');
                // Check if server was updated AFTER our last sync
                // Note: server time vs local time skew is a risk. 
                // Better: Store the "lastUpdated" timestamp from server when we fetched data.
                // But my doGet currently doesn't return metadata timestamp.
                // Simplified: If meta.lastUpdated > lastSyncTimeRef.current? 
                // Yes, assuming we update lastSyncTimeRef when we refresh.

                if (meta && meta.lastUpdated > lastSyncTimeRef.current) {
                    // Update detected!
                    console.log("🔔 Cloud requires refresh. Server:", meta.lastUpdated, "Local:", lastSyncTimeRef.current);
                    setShowRefreshPopup(true);
                }
                setIsConnected(true);
            } catch (e) {
                console.warn("Polling failed:", e);
                // Don't show full error screen on poll fail, just set offline status
                setIsConnected(false);
            }
        };

        initData();

        // Start Polling
        pollingIntervalRef.current = setInterval(checkUpdates, POLL_INTERVAL_MS);

        return () => {
            mounted = false;
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
        };
    }, []); // Run once on mount

    // --- Actions ---

    const addCarton = async (carton) => {
        try {
            // Optimistic update? No, strict source of truth.
            // But waiting for Google Sheet (1-2s) might feel slow. 
            // We'll show loading or wait.
            const res = await apiCall('addCarton', carton);
            if (res.error) throw new Error(res.error);

            // Succcess.
            // UPDATE LOCAL STATE manually to reflect change immediately?
            // Users requested "Excel is ONLY source".
            // Ideally we re-fetch everything. But that's heavy.
            // Compromise: Add to locked local state if successful, AND update lastSyncTimeRef
            // so we don't trigger our own popup.
            lastSyncTimeRef.current = Date.now() + 5000; // Buffer for clock skew
            setCartons(prev => [...prev, res.carton]);
            return res.carton;
        } catch (e) {
            console.error("Error adding carton:", e);
            alert("Failed to save to Google Sheet: " + e.message);
            throw e;
        }
    };

    const clearCartons = async () => {
        if (window.confirm("WARNING: This will delete ALL data from the Google Sheet. Continue?")) {
            // Loop delete is too slow for GAS. Needs bulk API.
            // Using loop for now as per previous logic, but really slow.
            // Ideally Add 'deleteAll' to GAS.
            // I'll stick to loop for safety with existing script 'deleteCarton'.
            for (const c of cartons) {
                await apiCall('deleteCarton', { id: c._id });
            }
            setCartons([]);
            lastSyncTimeRef.current = Date.now() + 5000;
        }
    };

    const updateSettings = async (newSettings) => {
        try {
            const res = await apiCall('updateSettings', newSettings);
            if (res.error) throw new Error(res.error);
            setSettings(prev => ({ ...prev, ...newSettings }));
            lastSyncTimeRef.current = Date.now() + 5000;
        } catch (e) {
            console.error("Failed to update settings", e);
            alert("Failed to update settings: " + e.message);
        }
    };

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
                        ☁️ Connecting to Google Cloud Database...
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
                    <div className="text-sm text-slate-500 max-w-md text-center">
                        Ensure you have deployed the Google Apps Script and updated
                        <code>src/utils/constants.js</code> with the correct URL.
                    </div>
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
                {isConnected ? '☁️ GOOGLE CLOUD' : '🔌 DISCONNECTED'}
            </div>
        </CartonContext.Provider>
    );
};
