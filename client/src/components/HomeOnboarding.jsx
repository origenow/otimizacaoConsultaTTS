import React from 'react';
import PropTypes from 'prop-types';

const HomeOnboarding = ({ query, setQuery, handleSearch, handleCancelSearch, loading, searchInputRef }) => {
    return (
        <div className="w-full max-w-[1100px] mx-auto space-y-16 pb-20 animate-fade-in-up">

            {/* Hero Section */}
            <section className="text-center space-y-8 py-12 flex flex-col items-center">
                <div className="space-y-4">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-fuchsia-600 tracking-tight leading-tight">
                        Descubra Produtos Vencedores
                    </h1>
                    <p className="text-xl text-[#5A5A66] max-w-2xl mx-auto leading-relaxed font-medium">
                        Encontre os melhores produtos com <span className="font-bold text-violet-600">alta performance</span> e excelente potencial de vendas para indicar aos seus clientes.
                    </p>
                </div>

                {/* Hero Search Bar - Centralized Action */}
                <div className="w-full max-w-[720px] mt-4 transform hover:scale-[1.01] transition-all duration-300">
                    <form onSubmit={handleSearch} className="relative group shadow-2xl shadow-purple-200/50 rounded-full">
                        <div className="absolute top-0 left-0 pl-4 md:pl-6 flex h-[56px] md:h-[80px] items-center pointer-events-none opacity-70">
                            <svg className="w-6 h-6 md:w-7 md:h-7 text-gray-400 group-focus-within:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <textarea
                            ref={searchInputRef}
                            rows={1}
                            className="block w-full pl-12 md:pl-16 pr-28 md:pr-40 py-4 md:py-6 rounded-[28px] md:rounded-[40px] text-sm md:text-xl text-gray-800 bg-white border-2 border-transparent focus:border-purple-500/30 focus:ring-8 focus:ring-purple-500/5 outline-none transition-all duration-300 placeholder-gray-400 shadow-xl resize-none custom-scrollbar"
                            placeholder="Cole os códigos ou digite o termo..."
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value);
                                e.target.style.height = 'auto';
                                e.target.style.height = (e.target.scrollHeight) + 'px';
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSearch(e);
                                }
                            }}
                            style={{ minHeight: '56px', maxHeight: '240px', overflowY: 'auto' }}
                        />
                        <div className="absolute top-1.5 md:top-2 right-1.5 md:right-2 h-[44px] md:h-[64px]">
                            <button
                                type={loading ? "button" : "submit"}
                                onClick={loading ? handleCancelSearch : undefined}
                                className={`h-full px-5 md:px-10 bg-gradient-to-r hover:cursor-pointer ${
                                    loading 
                                      ? "from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 shadow-red-500/20 hover:shadow-red-500/40" 
                                      : "from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 shadow-purple-500/20 hover:shadow-purple-500/40"
                                } text-white text-xs md:text-base font-bold uppercase tracking-wider rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95 transition-all duration-300 flex items-center gap-2 md:gap-3`}
                            >
                                {loading ? (
                                    <>
                                        <span className="w-2 h-2 md:w-3 md:h-3 bg-white rounded-full animate-pulse"></span>
                                        <span className="">Cancelar</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="hidden sm:inline">Buscar</span>
                                        <span className="inline sm:hidden">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                            </svg>
                                        </span>
                                        <svg className="hidden md:block w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                    <p className="text-[10px] md:text-xs text-gray-400 mt-4 font-medium italic">
                        Insira SKUs, ASINs, links de e-Shop ou termos de busca para começar.
                    </p>
                </div>
            </section>

            {/* Quick Start Steps */}
            <section>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {[
                        {
                            num: 1,
                            title: "Cole seus códigos",
                            desc: "Insira SKUs, ASINs, e-Shop ou termos. Um por linha ou separados por vírgula.",
                            icon: (
                                <svg className="w-6 h-6 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            )
                        },
                        {
                            num: 2,
                            title: "Clique em Buscar",
                            desc: "O sistema analisa o mercado, calcula a velocidade de vendas e identifica oportunidades ocultas.",
                            icon: (
                                <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            )
                        },
                        {
                            num: 3,
                            title: "Analise e Recomende",
                            desc: "Compare métricas, veja alertas de oportunidade e selecione produtos de alta performance para recomendar.",
                            icon: (
                                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                                </svg>
                            )
                        }
                    ].map((step) => (
                        <div key={step.num} className="bg-white/80 backdrop-blur-md border border-white/40 shadow-[0_20px_50px_rgba(0,0,0,0.05)] rounded-2xl p-8 relative overflow-hidden group hover:-translate-y-2 transition-all duration-500">
                            <div className="absolute top-0 right-0 p-24 bg-gradient-to-br from-gray-50/50 to-transparent rounded-bl-full -mr-12 -mt-12 group-hover:scale-110 transition-transform duration-500"></div>
                            <div className="relative z-10 flex flex-col items-center text-center">
                                <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:shadow-md transition-all duration-300">
                                    {step.icon}
                                </div>
                                <h3 className="font-bold text-gray-900 text-xl mb-3">{step.num}. {step.title}</h3>
                                <p className="text-base text-[#5A5A66] leading-relaxed font-medium">{step.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Input Examples */}
                <div className="lg:col-span-7 bg-white/70 backdrop-blur-md border border-white/50 shadow-xl rounded-2xl p-8">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-indigo-100 rounded-xl text-indigo-600 shadow-sm">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                            </div>
                            <h3 className="text-xl font-extrabold text-gray-800 tracking-tight">Exemplos de Entrada</h3>
                        </div>
                        <span className="px-3 py-1 bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-widest rounded-full border border-gray-200">Formatos Aceitos</span>
                    </div>
                    
                    <div className="space-y-6">
                        <div className="flex flex-col sm:flex-row gap-6">
                            <div className="flex-1 bg-gray-50/80 rounded-2xl p-5 border border-transparent transition-all relative group/ex overflow-hidden">
                                <div className="absolute top-0 right-0 px-3 py-1 bg-gray-200/50 text-gray-500 text-[9px] font-black uppercase tracking-tighter rounded-bl-xl">SIMULAÇÃO</div>
                                <span className="text-xs font-bold text-indigo-600/70 uppercase tracking-widest block mb-3">Por Linha</span>
                                <code className="text-sm font-mono text-indigo-950 block bg-white/80 p-3 rounded-xl border border-gray-100 shadow-inner">
                                    MLB123456789<br />SKU-ABC-001<br />7891234567890
                                </code>
                            </div>
                            <div className="flex-1 bg-gray-50/80 rounded-2xl p-5 border border-transparent transition-all relative group/ex overflow-hidden">
                                <div className="absolute top-0 right-0 px-3 py-1 bg-gray-200/50 text-gray-500 text-[9px] font-black uppercase tracking-tighter rounded-bl-xl">SIMULAÇÃO</div>
                                <span className="text-xs font-bold text-fuchsia-600/70 uppercase tracking-widest block mb-3">Por Vírgula</span>
                                <code className="text-sm font-mono text-fuchsia-950 block bg-white/80 p-3 rounded-xl border border-gray-100 shadow-inner">
                                    SKU-001, SKU-02,<br />MLB-999, Termo A
                                </code>
                            </div>
                        </div>
                        <p className="text-sm text-center text-[#5A5A66] font-medium flex items-center justify-center gap-2">
                             Insira suas ideias de nicho e descubra rapidamente o que está vendendo mais.
                        </p>
                    </div>
                </div>

                {/* Tips / Rules */}
                <div className="lg:col-span-5 bg-gradient-to-br from-indigo-50/80 to-purple-100/80 border border-purple-200/30 shadow-2xl rounded-2xl p-8 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/20 rounded-full blur-2xl"></div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-8 flex items-center gap-3">
                        <span className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm">🧠</span> Regras de Ouro
                    </h3>
                    <ul className="space-y-6 relative z-10">
                        <li className="flex items-start gap-4">
                            <span className="mt-1.5 w-3 h-3 rounded-full bg-violet-500 shadow-[0_0_10px_rgba(139,92,246,0.5)] shrink-0"></span>
                            <div>
                                <span className="block text-base font-bold text-gray-900">Encontre Oportunidades</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed mt-1">Busque produtos com alto volume de vendas diárias ou que apresentem <span className="text-violet-700 font-bold italic text-xs underline decoration-violet-200">baixa concorrência no mercado</span>.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="mt-1.5 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] shrink-0"></span>
                            <div>
                                <span className="block text-base font-bold text-gray-900">Evite Produtos Estagnados</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed mt-1">Identificamos automaticamente produtos sem giro ou com <span className="bg-amber-100 px-1 rounded block sm:inline mt-1 sm:mt-0 font-bold">concorrência excessiva</span>, focando na performance.</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-4">
                            <span className="mt-1.5 w-3 h-3 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)] shrink-0"></span>
                            <div>
                                <span className="block text-base font-bold text-gray-900">Métricas de Sucesso</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed mt-1">Utilizamos velocidade de venda e volume transacionado para garantir recomendações de <span className="font-bold text-emerald-600">alta performance</span> aos seus clientes.</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>

            <p className="text-center text-sm text-gray-400 font-medium pb-8 border-t border-gray-100 pt-8 mt-12">
                Privacidade: Os dados inseridos não são armazenados. Analytics 100% focado em performance.
            </p>

        </div>
    );
};

HomeOnboarding.propTypes = {
    query: PropTypes.string.isRequired,
    setQuery: PropTypes.func.isRequired,
    handleSearch: PropTypes.func.isRequired,
    handleCancelSearch: PropTypes.func.isRequired,
    loading: PropTypes.bool.isRequired,
    searchInputRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }).isRequired,
};

export default HomeOnboarding;
