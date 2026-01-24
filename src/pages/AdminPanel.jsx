import React, { useState, useEffect } from 'react';
import { generateExcel } from '../utils/excelGenerator';
import { useCarton } from '../context/CartonContext';
import { sortSizes } from '../utils/sizeSorter';
import { generatePackingList } from '../utils/packingListGenerator';

const AdminPanel = ({ user }) => {
    const { cartons, clearCartons, settings = {}, updateSettings } = useCarton();
    const [localSeason, setLocalSeason] = useState(settings?.activeSeason || 'WINTER 2025');

    // Sync local input with global settings on mount/change
    useEffect(() => {
        if (settings?.activeSeason) setLocalSeason(settings.activeSeason);
    }, [settings?.activeSeason]);

    const [extraSizes, setExtraSizes] = useState([]);
    const [newSize, setNewSize] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewingFile, setViewingFile] = useState(null);
    const [uploadError, setUploadError] = useState(null);

    const handleGeneratePackingList = () => {
        if (cartons.length === 0) {
            alert("No data available to generate packing list.");
            return;
        }
        // Auto-generate using existing carton data
        generatePackingList(cartons);
    };

    // ... (existing load settings useEffect)
    useEffect(() => {
        setUploadedFiles([]);
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await fetch('/api/settings');
            if (res.ok) {
                const data = await res.json();
                if (data.activeSeason) setLocalSeason(data.activeSeason);
                if (data.extraSizes) setExtraSizes(data.extraSizes);
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    const handleUpdateSeason = async () => {
        updateSettings({ activeSeason: localSeason, lockedByAdmin: true });
        alert("Active Season Updated (Locked for Data Entry Users)!");
    };

    const handleAddSize = async () => {
        if (!newSize) return;
        // Check for duplicates (case-insensitive)
        if (extraSizes.some(s => s.toLowerCase() === newSize.trim().toLowerCase())) {
            alert("Size already exists!");
            setNewSize('');
            return;
        }

        const updatedSizes = [...extraSizes, newSize.trim()];
        setExtraSizes(updatedSizes);
        setNewSize('');

        // Save global settings via Context
        updateSettings({ extraSizes: updatedSizes });
        alert(`Size ${newSize} added!`);
    };

    // Removed fetchFiles and handleFileUpload as backend is gone
    const fetchFiles = () => { };

    const handleFileUpload = async (e) => {
        setIsProcessing(true);
        setUploadError(null);
        const files = Array.from(e.target.files);

        if (files.length === 0) {
            setIsProcessing(false);
            return;
        }

        const formData = new FormData();
        files.forEach(file => {
            formData.append('files', file);
        });

        try {
            const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await res.json();

            if (!res.ok) {
                setUploadError(result.error || 'Upload failed');
            } else {
                if (result.errors && result.errors.length > 0) {
                    setUploadError(`Some files failed: ${result.errors.map(e => e.file).join(', ')}`);
                }
                // Refresh list
                fetchFiles();
            }
        } catch (err) {
            console.error(err);
            setUploadError("Network error during upload.");
        } finally {
            setIsProcessing(false);
            // Reset input
            e.target.value = null;
        }
    };

    const handleDeleteFile = async (id) => {
        if (window.confirm("Delete this file? This will remove associated store/style/print data.")) {
            try {
                const res = await fetch(`/api/files/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    setUploadedFiles(prev => prev.filter(f => f._id !== id));
                } else {
                    alert("Failed to delete file");
                }
            } catch (e) {
                console.error(e);
                alert("Error deleting file");
            }
        }
    };

    const handleViewFile = async (file) => {
        // Fetch full details including rows
        try {
            const res = await fetch(`/api/files/${file._id}`);
            if (res.ok) {
                const data = await res.json();
                setViewingFile(data);
            }
        } catch (e) {
            console.error(e);
        }
    };

    const handleNewSheet = () => {
        if (window.confirm("Start a New Sheet? This will clear all current carton data to start fresh.")) {
            clearCartons();
            alert("New Sheet Created (Data Cleared). Ready for new entries.");
        }
    };

    const handleDownloadExcel = async () => {
        try {
            if (cartons.length === 0) {
                alert("No saved cartons found. Please complete Data Entry first.");
                return;
            }
            // Pass global settings to generator
            generateExcel(cartons, settings);
        } catch (e) {
            console.error(e);
            alert("Failed to export.");
        }
    };

    return (
        <div className="container mx-auto pb-20">
            {/* Header / Export Section */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-slate-800">Admin Dashboard</h1>
                <div className="flex gap-4">
                    {user?.role === 'admin' && (
                        <button
                            onClick={handleNewSheet}
                            className="group bg-black hover:bg-gray-900 text-white shadow-xl flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl transition-all transform hover:-translate-y-1 active:scale-95 border-2 border-gray-800"
                        >
                            <span className="text-3xl group-hover:rotate-12 transition-transform">📄</span>
                            <span>New Sheet</span>
                        </button>
                    )}

                    <button
                        onClick={handleGeneratePackingList}
                        className="group bg-blue-600 hover:bg-blue-700 text-white shadow-xl flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl transition-all transform hover:-translate-y-1 active:scale-95 border-2 border-blue-800"
                    >
                        <span className="text-3xl group-hover:rotate-12 transition-transform">📦</span>
                        <span>Download Packing List</span>
                    </button>

                    <button
                        onClick={handleDownloadExcel}
                        className="group bg-black hover:bg-gray-900 text-white shadow-xl flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl transition-all transform hover:-translate-y-1 active:scale-95 border-2 border-gray-800"
                    >
                        <span className="text-3xl group-hover:rotate-12 transition-transform">📄</span>
                        <span>Download Shipping Manifest</span>
                    </button>
                </div>
            </div>

            {/* Dashboard Stats & Settings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {user?.role === 'admin' && (
                    <div className="card space-y-4">
                        <div>
                            <h3 className="text-slate-500 font-semibold mb-2">Active Season</h3>
                            <div className="flex gap-2">
                                <input
                                    className="form-input font-bold text-lg"
                                    value={localSeason}
                                    onChange={(e) => setLocalSeason(e.target.value)}
                                />
                                <button onClick={handleUpdateSeason} className="btn btn-primary whitespace-nowrap">
                                    Update Active Season
                                </button>
                            </div>
                        </div>

                        <div>
                            <h3 className="text-slate-500 font-semibold mb-2">Extra Sizes</h3>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {sortSizes(extraSizes).map(s => (
                                    <span key={s} className="bg-gray-200 px-2 py-1 rounded text-sm font-bold">{s}</span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    className="form-input w-24"
                                    placeholder="Size"
                                    value={newSize}
                                    onChange={(e) => setNewSize(e.target.value)}
                                />
                                <button onClick={handleAddSize} className="btn btn-secondary whitespace-nowrap">
                                    Add Extra Size
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* View File Modal */}
            {viewingFile && (
                <div className="modal-overlay" onClick={() => setViewingFile(null)}>
                    <div className="modal-content" style={{ maxWidth: '900px', width: '90%' }} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="font-bold text-lg">Viewing: {viewingFile.fileName}</h3>
                                <div className="text-xs text-slate-500 mt-1">
                                    Detected Columns: {JSON.stringify(viewingFile.detectedColumns)}
                                </div>
                            </div>
                            <button onClick={() => setViewingFile(null)} className="text-slate-500 hover:text-red-500 text-xl font-bold">✕</button>
                        </div>
                        <div className="overflow-auto max-h-[60vh] border border-gray-200 rounded bg-gray-50 p-2">
                            <table className="data-table text-xs">
                                <tbody>
                                    {viewingFile.rows && viewingFile.rows.length > 0 ? (
                                        viewingFile.rows.slice(0, 100).map((row, rIdx) => (
                                            <tr key={rIdx}>
                                                {row.map((cell, cIdx) => (
                                                    <td key={cIdx}>{cell}</td>
                                                ))}
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td className="text-center p-4">No rows data available</td></tr>
                                    )}
                                    {viewingFile.rows && viewingFile.rows.length > 100 && (
                                        <tr><td colSpan="100" className="text-center text-slate-500">... {viewingFile.rows.length - 100} more rows ...</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;
