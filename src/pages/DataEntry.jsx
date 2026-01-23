import React, { useState, useEffect } from 'react';
import { BUYER_OPTIONS, SIZES, PRINT_OPTIONS, STYLE_OPTIONS } from '../utils/constants';
import { useCarton } from '../context/CartonContext';
// generateExcel removed from here, moved to Admin logic implicitly via API, but we don't need to import it here anymore unless for client side fallback (which isn't requested).

import { sortSizes } from '../utils/sizeSorter';

const DataEntry = ({ user }) => {
    const [buyer, setBuyer] = useState('');
    const [storeName, setStoreName] = useState('');

    const [printOptions, setPrintOptions] = useState(PRINT_OPTIONS);
    const [styleOptions, setStyleOptions] = useState(STYLE_OPTIONS);
    const [storeOptions, setStoreOptions] = useState([]);

    // Dynamic Sizes from Settings
    const [dynamicSizes, setDynamicSizes] = useState(SIZES);

    // Session Cartons Logic
    const { addCarton, clearCartons, cartons } = useCarton();
    const [cartonCount, setCartonCount] = useState(0);

    // Sync count from context
    useEffect(() => {
        setCartonCount(cartons.length);
    }, [cartons]);

    React.useEffect(() => {
        // use constants directly since API is gone
        setPrintOptions(PRINT_OPTIONS);
        setStyleOptions(STYLE_OPTIONS);
        setStoreOptions([]); // Or define constant STORE_OPTIONS if needed
        setDynamicSizes(sortSizes(SIZES));

        // Settings are now handled by CartonContext (global settings)
        if (settings?.extraSizes) {
            const allSizes = [...SIZES, ...settings.extraSizes];
            setDynamicSizes(sortSizes([...new Set(allSizes)]));
        }

    }, [settings]);

    // Fetch carton count (replaced by context sync)
    const fetchCartonCount = async () => {
        // No-op for context
    };

    // Rows for CURRENT carton
    const [rows, setRows] = useState([createEmptyRow()]);

    // Global details for CURRENT carton
    const [cartonDetails, setCartonDetails] = useState({
        cartonNo: '',
        measurement: '',
        netWeight: '',
        grossWeight: ''
    });

    function createEmptyRow() {
        return {
            id: Date.now(),
            print: '',
            style: '',
            sizes: dynamicSizes.reduce((acc, size) => ({ ...acc, [size]: '' }), {}),
            totalPcs: 0
        };
    }

    // Handle Input Changes
    const handleRowChange = (id, field, value) => {
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            return { ...row, [field]: value };
        }));
    };

    const handleSizeChange = (id, size, value) => {
        if (value && !/^\d*$/.test(value)) return;

        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;

            const newSizes = { ...row.sizes, [size]: value };
            const total = Object.values(newSizes).reduce((sum, v) => sum + (parseInt(v) || 0), 0);

            return { ...row, sizes: newSizes, totalPcs: total };
        }));
    };

    const handleDeleteRow = (id) => {
        setRows(prev => prev.filter(r => r.id !== id));
    };

    const handleSaveRow = () => {
        setRows(prev => [...prev, createEmptyRow()]);
    };

    // Helper renderers
    const printDatalist = (
        <datalist id="print-options">
            {printOptions.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>
    );
    const storeDatalist = (
        <datalist id="store-options">
            {storeOptions.map((opt, i) => <option key={i} value={opt} />)}
        </datalist>
    );

    const handleReset = async () => {
        if (window.confirm("Are you sure you want to CLEAR ALL SESSION DATA? This will delete all saved cartons from the Admin Export list.")) {
            clearCartons();
            setBuyer('');
            setStoreName('');
            setRows([createEmptyRow()]);
            setCartonDetails({ cartonNo: '', measurement: '', netWeight: '', grossWeight: '' });
            alert("Session Cleared.");
        }
    };

    const handleSaveCarton = async () => {
        if (!buyer || !storeName) {
            alert("Please fill Buyer and Store Name.");
            return;
        }
        if (!cartonDetails.cartonNo || !cartonDetails.measurement || !cartonDetails.netWeight || !cartonDetails.grossWeight) {
            alert("Please fill all Global Carton Details.");
            return;
        }

        const cleanMeasurement = cartonDetails.measurement.replace(/cm/gi, '').trim();

        const currentCarton = {
            buyer,
            storeName,
            ...cartonDetails,
            season: settings.lockedByAdmin ? settings.activeSeason : userSeason,
            measurement: cleanMeasurement
        };

        try {
            // Save via Context instead of API
            addCarton(currentCarton);

            setRows([createEmptyRow()]);
            // Keep buyer/store/measurement populated
            setCartonDetails({
                cartonNo: '',
                measurement: cleanMeasurement,
                netWeight: '',
                grossWeight: ''
            });
            alert("Carton Saved!");

        } catch (e) {
            console.error(e);
            alert("Error saving carton.");
        }
    };

    return (
        <div className="container mx-auto pb-20">
            {/* Datalists */}
            {printDatalist}
            {storeDatalist}

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-700">Carton Entry</h2>
                <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded font-bold">
                    Session Cartons: {cartonCount}
                </div>
            </div>

            {/* Top Section */}
            <div className="card mb-6 grid grid-cols-1 md:grid-cols-3 gap-6 bg-white">
                <div className="input-group">
                    <label className="input-label">Season {settings.lockedByAdmin && <span className="text-xs text-blue-600">(Admin Locked)</span>}</label>
                    <input
                        className={`form-input font-bold ${settings.lockedByAdmin ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                        value={settings.lockedByAdmin ? settings.activeSeason : userSeason}
                        onChange={e => !settings.lockedByAdmin && setUserSeason(e.target.value)}
                        readOnly={settings.lockedByAdmin}
                    />
                </div>
                <div className="input-group">
                    <label className="input-label">Buyer <span className="text-red-500">*</span></label>
                    <select
                        className="form-select"
                        value={buyer}
                        onChange={e => setBuyer(e.target.value)}
                    >
                        <option value="">Select Buyer...</option>
                        {BUYER_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                </div>
                <div className="input-group">
                    <label className="input-label">Store Name <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        className="form-input"
                        value={storeName}
                        onChange={e => setStoreName(e.target.value)}
                        placeholder="Select or Type..."
                        list="store-options"
                        autoComplete="off"
                    />
                </div>
            </div>

            {/* Main Table */}
            <div className="card mb-6 overflow-x-auto">
                <table className="data-table min-w-max">
                    <thead>
                        <tr>
                            <th className="w-24">Print</th>
                            <th className="w-24">Style</th>
                            {dynamicSizes.map(s => <th key={s} className="w-12 text-center">{s}</th>)}
                            <th className="w-20">Total</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, idx) => (
                            <tr key={row.id}>
                                <td>
                                    <select
                                        className="w-full border-none focus:ring-0 p-1 bg-transparent"
                                        value={row.print}
                                        onChange={e => handleRowChange(row.id, 'print', e.target.value)}
                                    >
                                        <option value="">Select Print...</option>
                                        {printOptions.map((opt, i) => (
                                            <option key={i} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </td>
                                <td>
                                    <select
                                        className="w-full border-none focus:ring-0 p-1 bg-transparent"
                                        value={row.style}
                                        onChange={e => handleRowChange(row.id, 'style', e.target.value)}
                                    >
                                        <option value="">Select Style...</option>
                                        {styleOptions.map((opt, i) => (
                                            <option key={i} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                </td>
                                {dynamicSizes.map(size => (
                                    <td key={size} className="p-1">
                                        <input
                                            className="w-full text-center border-b border-gray-100 focus:border-blue-500 outline-none p-1"
                                            value={row.sizes[size] || ''}
                                            onChange={e => handleSizeChange(row.id, size, e.target.value)}
                                            placeholder=""
                                        />
                                    </td>
                                ))}
                                <td className="text-center font-bold bg-gray-50">{row.totalPcs}</td>
                                <td>
                                    {rows.length > 1 && (
                                        <button
                                            onClick={() => handleDeleteRow(row.id)}
                                            className="text-red-500 hover:text-red-700 font-bold px-2"
                                            title="Delete Row"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="mt-4 flex justify-start">
                    <button onClick={handleSaveRow} className="btn btn-secondary text-sm">
                        + Add Row
                    </button>
                </div>
            </div>

            {/* Global Carton Details */}
            <div className="card mb-6">
                <h3 className="font-bold text-gray-700 mb-4">Global Carton Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div className="input-group">
                        <label className="input-label">Carton No.</label>
                        <input
                            className="form-input"
                            value={cartonDetails.cartonNo}
                            onChange={e => setCartonDetails({ ...cartonDetails, cartonNo: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Net Weight (Kg)</label>
                        <input
                            className="form-input"
                            value={cartonDetails.netWeight}
                            onChange={e => setCartonDetails({ ...cartonDetails, netWeight: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Gross Weight (Kg)</label>
                        <input
                            className="form-input"
                            value={cartonDetails.grossWeight}
                            onChange={e => setCartonDetails({ ...cartonDetails, grossWeight: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Measurement (LxWxH)</label>
                        <input
                            className="form-input"
                            placeholder="e.g. 60x40x30"
                            value={cartonDetails.measurement}
                            onChange={e => setCartonDetails({ ...cartonDetails, measurement: e.target.value })}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Total Pcs</label>
                        <input
                            className="form-input bg-gray-100 text-gray-600 cursor-not-allowed font-bold"
                            value={rows.reduce((sum, r) => sum + (r.totalPcs || 0), 0)}
                            readOnly
                        />
                    </div>
                </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex justify-end gap-4 mt-8">
                <button
                    onClick={handleReset}
                    className="btn bg-gray-300 hover:bg-gray-400 text-gray-800"
                >
                    Reset Session (Clear All)
                </button>
                <div className="flex gap-2">
                    <button
                        onClick={handleSaveCarton}
                        className="btn btn-primary bg-indigo-600 hover:bg-indigo-700"
                    >
                        SAVE CARTON (Commit)
                    </button>
                </div>
            </div>

        </div>
    );
};

export default DataEntry;
