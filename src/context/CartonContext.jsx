import React, { createContext, useState, useEffect, useContext } from 'react';

const CartonContext = createContext();

export const useCarton = () => useContext(CartonContext);

export const CartonProvider = ({ children }) => {
    // Initialize from LocalStorage or empty array
    const [cartons, setCartons] = useState(() => {
        try {
            const saved = localStorage.getItem('carton_data');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error("Failed to load cartons", e);
            return [];
        }
    });

    // Global Settings (Active Season, etc)
    const [settings, setSettings] = useState(() => {
        try {
            const saved = localStorage.getItem('carton_settings');
            const parsed = saved ? JSON.parse(saved) : null;
            return parsed || { activeSeason: 'WINTER 2025', lockedByAdmin: false };
        } catch (e) {
            return { activeSeason: 'WINTER 2025', lockedByAdmin: false };
        }
    });

    // Save Settings
    useEffect(() => {
        localStorage.setItem('carton_settings', JSON.stringify(settings));
    }, [settings]);

    // Save to LocalStorage whenever cartons change
    useEffect(() => {
        try {
            localStorage.setItem('carton_data', JSON.stringify(cartons));
        } catch (e) {
            console.error("Failed to save cartons", e);
        }
    }, [cartons]);

    const addCarton = (carton) => {
        // Generate client-side ID if missing
        const newCarton = {
            ...carton,
            _id: Date.now().toString(),
            timestamp: new Date().toISOString()
        };
        setCartons(prev => [...prev, newCarton]);
        return newCarton;
    };

    const clearCartons = () => {
        setCartons([]);
        localStorage.removeItem('carton_data');
    };

    const updateSettings = (newSettings) => {
        setSettings(prev => ({ ...prev, ...newSettings }));
    };

    return (
        <CartonContext.Provider value={{ cartons, addCarton, clearCartons, settings, updateSettings }}>
            {children}
        </CartonContext.Provider>
    );
};
