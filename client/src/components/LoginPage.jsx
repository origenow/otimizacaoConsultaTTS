import React, { useState } from 'react';
import PropTypes from 'prop-types';

const LoginPage = ({ onLogin }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e) => {
        e.preventDefault();
        setLoading(true);
        
        // Mocking a delay
        setTimeout(() => {
            onLogin();
            setLoading(false);
        }, 800);
    };

    return (
        <div className="min-h-screen bg-[#f8f7fc] text-gray-800 flex flex-col items-center justify-center relative overflow-hidden selection:bg-purple-200 selection:text-purple-900">
            {/* Ambient Background Glows */}
            <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[120px] mix-blend-multiply filter"></div>
                <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-indigo-200/30 rounded-full blur-[100px] mix-blend-multiply filter"></div>
                <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-pink-100/40 rounded-full blur-[80px] mix-blend-multiply filter"></div>
            </div>

            <div className="relative z-10 w-full max-w-md px-4 animate-fade-in-up">
                {/* Logo Area */}
                <div className="flex flex-col items-center mb-8">
                    <img src="/logo-origenow.png" alt="Origenow Logo" className="h-24 w-auto object-contain mb-4" />
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 tracking-tight text-center">
                        Acesse a Plataforma
                    </h1>
                </div>

                {/* Login Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-3xl p-8 md:p-10">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="login-username" className="text-sm font-bold text-gray-700 ml-1">Usuário</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </div>
                                <input
                                    id="login-username"
                                    type="text"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-800 bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-purple-500/30 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all duration-300 placeholder-gray-400 shadow-sm"
                                    placeholder="Seu nome de usuário"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="login-password" className="text-sm font-bold text-gray-700 ml-1">Senha</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-purple-500 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                    </svg>
                                </div>
                                <input
                                    id="login-password"
                                    type="password"
                                    required
                                    className="block w-full pl-11 pr-4 py-3.5 rounded-2xl text-gray-800 bg-gray-50/50 border border-gray-100 focus:bg-white focus:border-purple-500/30 focus:ring-4 focus:ring-purple-500/5 outline-none transition-all duration-300 placeholder-gray-400 shadow-sm"
                                    placeholder="Digite sua senha"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-4 bg-gradient-to-r from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 text-white font-bold rounded-2xl shadow-lg shadow-purple-200/50 hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center justify-center gap-3 ${loading ? 'opacity-80 cursor-not-allowed' : 'hover:cursor-pointer'}`}
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Entrando...</span>
                                </>
                            ) : (
                                <>
                                    <span>Entrar na Plataforma</span>
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-gray-400 mt-12 font-medium">
                    © {new Date().getFullYear()} Origenow Analytics. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

LoginPage.propTypes = {
    onLogin: PropTypes.func.isRequired,
};

export default LoginPage;
