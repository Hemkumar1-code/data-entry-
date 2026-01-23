import React, { useState } from 'react';
import { loginUser } from '../utils/auth';

const Login = ({ onLogin }) => {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        const user = loginUser(email.trim());
        if (user) {
            onLogin(user);
        } else {
            setError('Access Denied. Invalid email address.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
            <div className="card w-full max-w-md p-8 bg-white shadow-lg rounded-xl border border-gray-100">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-slate-900">Sign In</h2>
                    <p className="text-slate-500 mt-2">Enter your authorized email to continue</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group mb-6">
                        <label className="input-label block text-sm font-medium text-slate-700 mb-2">Email Address</label>
                        <input
                            type="email"
                            className="form-input w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                            placeholder="name@company.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md border border-red-100">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        className="w-full btn btn-primary py-3 text-base font-semibold shadow-md hover:shadow-lg transform transition-all active:scale-95"
                    >
                        Access Dashboard
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
