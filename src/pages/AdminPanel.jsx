
import React, { useState, useEffect } from 'react';
import { generateExcel } from '../utils/excelGenerator';

const AdminPanel = () => {
    const [season, setSeason] = useState('WINTER 2025');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [viewingFile, setViewingFile] = useState(null);
    const [uploadError, setUploadError] = useState(null);

    // Load files from Server on mount
    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        try {
            const res = await fetch('/api/files');
            if (res.ok) {
                const data = await res.json();
                setUploadedFiles(data);
            }
        } catch (e) {
            console.error("Failed to load files", e);
        }
    };

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

    const handleDownloadExcel = async () => {
        try {
            const res = await fetch('/api/cartons');
            if (res.ok) {
                const cartons = await res.json();
                if (cartons.length === 0) {
                    alert("No saved cartons found. Please complete Data Entry first.");
                    return;
                }
                generateExcel(cartons, season);
            }
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
                <button
                    onClick={handleDownloadExcel}
                    className="group bg-green-700 hover:bg-green-800 text-white shadow-2xl flex items-center gap-3 px-8 py-4 rounded-full font-bold text-xl transition-all transform hover:-translate-y-1 active:scale-95 border-4 border-green-600/30"
                >
                    <span className="text-3xl group-hover:rotate-12 transition-transform">📄</span>
                    <span>Download Shipping Manifest</span>
                </button>
            </div>

            {/* Dashboard Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="card text-center">
                    <h3 className="text-slate-500 font-semibold mb-2">Total Uploaded Files</h3>
                    <p className="text-3xl font-bold text-slate-800">{uploadedFiles.length}</p>
                </div>
                <div className="card text-center col-span-2">
                    <h3 className="text-slate-500 font-semibold mb-2">Active Season</h3>
                    <input
                        className="form-input text-center font-bold text-lg"
                        value={season}
                        onChange={(e) => setSeason(e.target.value)}
                    />
                </div>
            </div>

            {/* Upload Module Removed as per request */}

            {/* File List */}
            {uploadedFiles.length > 0 && (
                <div className="card mb-6">
                    <h3 className="font-bold text-lg mb-4">Uploaded Files ({uploadedFiles.length})</h3>
                    <div className="overflow-x-auto border border-gray-200 rounded-md">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>File Name</th>
                                    <th>Status</th>
                                    <th>Stores</th>
                                    <th>Rows</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uploadedFiles.map((file, idx) => (
                                    <tr key={file._id} className={file.status === 'FAILED' ? 'bg-red-50' : file.status === 'PARTIAL' ? 'bg-yellow-50' : ''}>
                                        <td>{idx + 1}</td>
                                        <td>
                                            <div className="font-bold text-slate-700">{file.fileName}</div>
                                            {file.errorReason && (
                                                <div className="text-red-500 text-xs mt-1 max-w-[200px]">{file.errorReason}</div>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${file.status === 'SUCCESS' ? 'bg-green-100 text-green-700' :
                                                file.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                {file.status || 'SUCCESS'}
                                            </span>
                                        </td>
                                        <td>
                                            {file.stores && file.stores.length > 0
                                                ? <span title={file.stores.join(', ')}>{file.stores.length} Found</span>
                                                : <span className="text-gray-400 italic text-xs">None</span>
                                            }
                                        </td>
                                        <td>{file.rowCount}</td>
                                        <td>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleViewFile(file)}
                                                    className="btn btn-secondary text-xs px-2 py-1"
                                                >
                                                    View
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFile(file._id)}
                                                    className="btn btn-danger text-xs px-2 py-1"
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* File View Modal */}
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
