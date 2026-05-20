import { useState } from 'react';
import PropTypes from 'prop-types';

const CookieUpdaterModal = ({ isOpen, onClose, onUpdate }) => {
    const [ssid, setSsid] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!ssid.trim()) return;

        setLoading(true);
        setError(null);

        try {
            await onUpdate(ssid);
            setSsid('');
        } catch {
            setError('Falha ao atualizar o cookie. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-fade-in-up">

                {/* Header */}
                <div className="bg-red-50 p-6 border-b border-red-100 flex items-center gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0 text-red-600">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Sessão Expirada</h2>
                        <p className="text-sm text-red-600 font-medium">O Mercado Livre desconectou sua sessão.</p>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <p className="text-gray-600 text-sm leading-relaxed">
                        Para continuar buscando produtos, precisamos atualizar sua chave de acesso (Cookie SSID). Isso acontece periodicamente por segurança do ML.
                    </p>

                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 text-sm space-y-3">
                        <h3 className="font-bold text-gray-700 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Como pegar o novo cookie:
                        </h3>
                        <ol className="list-decimal pl-4 space-y-2 text-gray-600 marker:font-bold marker:text-gray-400">
                            <li>Acesse o <strong>Mercado Livre</strong> no seu navegador e faça login.</li>
                            <li>Aperte <strong>F12</strong> para abrir o DevTools.</li>
                            <li>Vá na aba <strong>Application</strong> (ou Armazenamento) &gt; <strong>Cookies</strong>.</li>
                            <li>Procure pelo cookie chamado <code className="bg-gray-200 px-1 py-0.5 rounded font-mono text-gray-800">ssid</code>.</li>
                            <li>Copie o valor dele e cole abaixo.</li>
                        </ol>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="cookie-ssid" className="block text-xs font-bold text-gray-500 uppercase mb-1">Novo Cookie SSID</label>
                            <input
                                id="cookie-ssid"
                                type="text"
                                value={ssid}
                                onChange={(e) => setSsid(e.target.value)}
                                placeholder="Cole o valor do cookie aqui..."
                                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl focus:ring-4 focus:ring-origenow-purple/20 focus:border-origenow-purple outline-none transition-all font-mono text-sm"
                                required
                            />
                        </div>

                        {error && (
                            <div className="text-sm text-red-600 bg-red-50 px-4 py-2 rounded-lg border border-red-100 flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                {error}
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors outline-none focus:ring-4 focus:ring-gray-100"
                            >
                                Cancelar
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] hover:cursor-pointer px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold text-base rounded-xl shadow-lg shadow-purple-500/30 transition-all transform hover:scale-[1.02] active:scale-[0.98] outline-none focus:ring-4 focus:ring-purple-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-transparent"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Atualizando...
                                    </>
                                ) : (
                                    <>
                                        Salvar e Tentar Novamente
                                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

CookieUpdaterModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onUpdate: PropTypes.func.isRequired,
};

export default CookieUpdaterModal;
