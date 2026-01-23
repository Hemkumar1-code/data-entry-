import React from 'react';
import { useNavigate } from 'react-router-dom';

const Header = ({ user, setShowAdminPanel }) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        // In a real app, clear tokens. Here just reload or clear state in parent.
        // For simplicity, we'll let App handle it via a passed function, but we can just reload for now
        window.location.href = '/';
    };

    return (
        <header className="header-bar bg-white p-4 shadow-sm border-b border-gray-200">
            <div className="flex items-center gap-4">
                <h1 className="text-xl font-bold text-slate-800">ERP System</h1>
                <span className="text-sm text-slate-500">Logged in as: {user?.email}</span>
            </div>

            <div className="flex gap-3">
                {user?.role === 'admin' && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="btn btn-primary bg-slate-900 text-white px-4 py-2 rounded-md hover:bg-slate-800 transition"
                    >
                        Admin Panel
                    </button>
                )}
                <button
                    onClick={handleLogout}
                    className="btn btn-secondary text-slate-600 border border-slate-300 px-4 py-2 rounded-md hover:bg-slate-50 transition"
                >
                    Logout
                </button>
            </div>
        </header>
    );
};

export default Header;
