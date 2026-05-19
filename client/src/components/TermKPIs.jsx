import React, { useState, useMemo } from 'react';
import PropTypes from 'prop-types';

const safeFloat = (v) => {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? 0 : n;
};

const isFull = (item) => item.is_fulfillment === true || item.logistic_type === 'fulfillment';

function fullRisk(pct) {
  if (pct < 30) return { key: 'open', label: 'Mercado aberto', cls: 'bg-emerald-100/80 text-emerald-800 border-emerald-200' };
  if (pct < 60) return { key: 'caution', label: 'Atenção ao Full', cls: 'bg-amber-100/80 text-amber-800 border-amber-200' };
  return { key: 'closed', label: 'Mercado saturado', cls: 'bg-red-100 text-red-700 border-red-200' };
}

function fullInsight(pct) {
  if (pct < 30) return {
    icon: <span className="text-xl">💡</span>,
    cls: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    html: `<strong>Poucos no Full (${pct.toFixed(0)}%) — boa entrada.</strong> A maioria dos concorrentes <strong>usa Drop Off</strong>, o que nivela a competição. Espaço real para entrar com <strong>preço e TTS competitivos</strong>.`
  };
  if (pct < 60) return {
    icon: <span className="text-xl">⚠️</span>,
    cls: 'bg-amber-50 border-amber-200 text-amber-900',
    html: `<strong>Full moderado (${pct.toFixed(0)}%) — atenção.</strong> Parte relevante dos concorrentes <strong>já opera com Full</strong>, o que melhora prazo e visibilidade deles. Avalie se seu <strong>TTS e margem</strong> compensam essa desvantagem.`
  };
  return {
    icon: <span className="text-xl">🚨</span>,
    cls: 'bg-red-50 border-red-200 text-red-900',
    html: `<strong>Maioria no Full (${pct.toFixed(0)}%) — mercado fechado.</strong> Concorrentes <strong>bem consolidados</strong> com logística otimizada e prazo curto. Entrar aqui sem Full é uma <strong>desvantagem estrutural — risco alto</strong>.`
  };
}

function calcMargin(price, cost) {
  if (!cost || cost <= 0) return null;
  return ((price - cost) / price) * 100;
}

function marginClass(m) {
  if (m === null) return 'bg-gray-100 border-gray-200';
  if (m >= 30) return 'bg-green-100 border-[#6ee7b7]';
  if (m >= 15) return 'bg-amber-100 border-[#fcd34d]';
  return 'bg-red-100 border-[#fca5a5]';
}

function marginRec(m) {
  if (m === null) return { text: 'Insira o custo para calcular', color: 'text-gray-400' };
  if (m >= 30) return { text: 'Boa margem', color: 'text-green-600' };
  if (m >= 15) return { text: 'Margem ok', color: 'text-amber-600' };
  return { text: 'Margem baixa', color: 'text-red-600' };
}

function TermKPIs({ results }) {
  const [costs, setCosts] = useState({});
  const [selectedTerms, setSelectedTerms] = useState(['all']);
  const [sellPrices, setSellPrices] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Parse results to calculate term properties and build products list
  const { terms, products } = useMemo(() => {
    if (!results || results.length === 0) return { terms: {}, products: [] };

    const termsMap = {};
    const validProducts = [];

    results.forEach(item => {
      const term = item.search_query || 'Desconhecido';
      // Initialize term if it doesn't exist
      if (!termsMap[term]) {
        termsMap[term] = {
          name: term, short: term,
          total: 0, full: 0,
          ttsLow: 0, totalTts: 0, validTtsCount: 0, minPrice: Infinity, maxPrice: -Infinity, totalPrice: 0, validPriceCount: 0,
          salesOver200: 0, totalSales: 0,
        };
      }

      const t = termsMap[term];
      t.total++;

      const isFulfillment = isFull(item);
      if (isFulfillment) t.full++;

      const tts = safeFloat(item.tts);
      if (tts > 0) {
        if (tts < 2) t.ttsLow++;
        t.totalTts += tts;
        t.validTtsCount++;
      }

      const price = Number.parseFloat(item.price) || 0;
      if (price > 0) {
        if (price < t.minPrice) t.minPrice = price;
        if (price > t.maxPrice) t.maxPrice = price;
        t.totalPrice += price;
        t.validPriceCount++;
      }

      const sales = Number.parseInt(item.sales_quantity) || 0;
      if (sales > 200) t.salesOver200++;
      t.totalSales += sales;

      validProducts.push({
        id: item.id,
        name: item.title,
        term: term,
        tts: tts,
        sales: sales,
        price: price,
        full: isFulfillment,
        link: item.permalink
      });
    });

    // Finalize term calculations
    Object.keys(termsMap).forEach(key => {
      const t = termsMap[key];
      t.fullPct = t.total > 0 ? (t.full / t.total) * 100 : 0;
      t.avgTts = t.validTtsCount > 0 ? t.totalTts / t.validTtsCount : 0;
      t.avgPrice = t.validPriceCount > 0 ? t.totalPrice / t.validPriceCount : 0;
      if (t.minPrice === Infinity) t.minPrice = 0;
      if (t.maxPrice === -Infinity) t.maxPrice = 0;
    });

    return { terms: termsMap, products: validProducts };
  }, [results]);

  const handleCostChange = (term, value) => {
    setCosts(prev => ({ ...prev, [term]: value }));
  };

  const handleSellPriceChange = (term, value) => {
    setSellPrices(prev => ({ ...prev, [term]: value }));
  };

  const handleTermChange = (term) => {
    setSelectedTerms(prev => {
      if (term === 'all') return ['all'];

      const isAllSelected = prev.includes('all');
      const isAlreadySelected = prev.includes(term);

      if (isAllSelected) {
        // Se estava em "Todos", passa a selecionar apenas este termo
        return [term];
      }

      if (isAlreadySelected) {
        // Se já estava selecionado, remove
        const next = prev.filter(t => t !== term);
        return next.length === 0 ? ['all'] : next;
      }

      // Adiciona o novo termo à seleção
      return [...prev, term];
    });
    setCurrentPage(1);
  };


  const uniqueTerms = Object.keys(terms);
  const totalTerms = uniqueTerms.length;

  // useMemo must be declared before any early return to comply with Rules of Hooks
  const allCandidates = useMemo(() => {
    return products.filter(p => {
      const t = terms[p.term];
      const cost = Number.Number.parseFloat(costs[p.term]) || 0;
      const margin = cost > 0 ? calcMargin(p.price, cost) : null;
      const passMargin = margin === null || margin >= 30;
      const termNotSaturated = t.fullPct < 60;
      return p.tts < 2 && p.sales > 200 && passMargin && termNotSaturated && p.price > 0;
    }).sort((a, b) => a.tts - b.tts);
  }, [products, terms, costs, calcMargin]);

  if (totalTerms === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-gray-400">
        <svg className="w-16 h-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="font-semibold">Nenhum dado para analisar.</p>
        <p className="text-sm mt-1">Faça uma busca primeiro.</p>
      </div>
    );
  }

  const termsToDisplay = selectedTerms.includes('all') ? uniqueTerms : selectedTerms;

  const totalPages = Math.ceil(allCandidates.length / pageSize);
  const paginatedCandidates = allCandidates.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="w-full">
      {/* Term Bar */}
      <div className="bg-white border text-sm border-gray-200 rounded-xl px-6 py-3 mb-6 flex gap-3 flex-wrap items-center">
        <span className="text-gray-400 font-medium mr-1 text-xs uppercase tracking-wider">Filtrar por Termo:</span>
        <button
          className={`px-4 py-1.5 rounded-full font-medium text-xs transition-all ${selectedTerms.includes('all') ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          onClick={() => handleTermChange('all')}
        >
          Todos ({uniqueTerms.length})
        </button>
        {uniqueTerms.map(term => (
          <button
            key={term}
            className={`px-4 py-1.5 rounded-full font-medium text-xs transition-all ${selectedTerms.includes(term) ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            onClick={() => handleTermChange(term)}
          >
            {term} ({terms[term].total})
          </button>
        ))}
      </div>

      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">
          Comparativo de KPIs — {selectedTerms.includes('all') ? 'Todos os termos' : selectedTerms.length === 1 ? selectedTerms[0] : `${selectedTerms.length} termos selecionados`}
        </h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Insira seu preço de custo para calcular a margem potencial. Full logística em excesso = mercado mais competitivo e difícil de entrar.</p>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="flex items-center gap-2 text-xs text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-[#10b981]"></div> <strong className="text-[#065f46]">Mercado aberto</strong> — poucos no Full (&lt;30%): Drop ainda competitivo, barreira baixa</div>
          <div className="flex items-center gap-2 text-xs text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-[#f59e0b]"></div> <strong className="text-[#92400e]">Atenção</strong> — Full moderado (30–60%): avalie TTS e preço antes de entrar</div>
          <div className="flex items-center gap-2 text-xs text-gray-600"><div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]"></div> <strong className="text-[#991b1b]">Mercado fechado</strong> — maioria no Full (&gt;60%): concorrentes consolid., entrada arriscada</div>
        </div>
      </div>

      <div className={`grid gap-5 mb-8 ${termsToDisplay.length === 1 ? 'grid-cols-1 max-w-2xl' : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3'}`}>
        {termsToDisplay.map(key => {
          const t = terms[key];
          const cost = Number.parseFloat(costs[key]) || 0;
          const sellVal = Number.parseFloat(sellPrices[key]) || 0;
          const priceToCalc = sellVal > 0 ? sellVal : t.avgPrice;
          const margin = cost > 0 ? calcMargin(priceToCalc, cost) : null;
          const mc = marginClass(margin);
          const rec = marginRec(margin);
          const lucro = cost > 0 ? (priceToCalc - cost).toFixed(2) : null;
          const fr = fullRisk(t.fullPct);
          const fi = fullInsight(t.fullPct);
          const isWinner = t.fullPct < 30;

          return (
            <div key={key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col hover:shadow-md transition-shadow">
              <div className="p-5 border-b border-gray-100 flex flex-col gap-2.5 bg-gray-50/30">
                <div className="text-sm font-black text-gray-900 uppercase tracking-tight truncate" title={t.short}>{t.short}</div>
                <div className="flex gap-2 flex-wrap">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-md border uppercase tracking-wider ${fr.cls}`}>{fr.label}</span>
                  {isWinner && <span className="text-[10px] font-black px-2.5 py-1 rounded-md bg-purple-600 text-white uppercase tracking-wider shadow-sm">Mais acessível</span>}
                </div>
              </div>

              <div className="p-5 flex flex-col gap-6 flex-1">
                {/* Agrupamento: Logística */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Dados de Logística</div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Total de anúncios</span>
                    <span className="text-sm font-black text-gray-900">{t.total}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600 font-medium">Com Full logística</span>
                      <span className={`text-xs font-black ${t.fullPct < 30 ? 'text-emerald-600' : t.fullPct < 60 ? 'text-amber-600' : 'text-red-600'}`}>
                        {t.full} <span className="font-bold opacity-60">({t.fullPct.toFixed(0)}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
                      <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${t.fullPct}%`, backgroundColor: t.fullPct < 30 ? '#10b981' : t.fullPct < 60 ? '#f59e0b' : '#ef4444' }}></div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium whitespace-nowrap">TTS rápido (&lt;2h)</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min((t.ttsLow / t.total) * 100, 100).toFixed(0)}%` }}></div></div>
                      <span className="text-sm font-black text-emerald-600 min-w-[20px] text-right">{t.ttsLow}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Velocidade média (TTS)</span>
                    <span className={`text-sm font-black ${t.avgTts < 2 ? 'text-emerald-600' : t.avgTts < 10 ? 'text-amber-600' : 'text-red-600'}`}>{t.avgTts.toFixed(1)}h</span>
                  </div>
                </div>

                <div className="h-px bg-gray-100"></div>

                {/* Agrupamento: Vendas e Preço */}
                <div className="space-y-3">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Vendas e Preços</div>
                  
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Faixa de mercado</span>
                    <span className="text-xs font-mono text-gray-800 font-bold">R$ {t.minPrice.toFixed(0)} – {t.maxPrice.toFixed(0)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Preço médio</span>
                    <span className="text-sm font-mono font-black text-gray-900">R$ {t.avgPrice.toFixed(2)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Vendas &gt; 200un</span>
                    <div className="flex items-center gap-2 flex-1 justify-end">
                      <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0"><div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.min((t.salesOver200 / t.total) * 100, 100).toFixed(0)}%` }}></div></div>
                      <span className="text-sm font-black text-indigo-600 min-w-[20px] text-right">{t.salesOver200}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-600 font-medium">Vendas totais</span>
                    <span className="text-sm font-black text-gray-900">{t.totalSales.toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              </div>

              {/* Insight Text */}
              <div className="px-5 pb-5">
                <div className={`p-4 rounded-xl border-l-4 text-xs leading-relaxed flex gap-3 items-start shadow-sm ${fi.cls}`}>
                  <div className="shrink-0 mt-0.5">{fi.icon}</div>
                  <div dangerouslySetInnerHTML={{ __html: fi.html }}></div>
                </div>
              </div>

              {/* Calculator Form */}
              <div className="p-5 bg-[#f7f9fa] border-t border-gray-200 mt-auto">
                <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                  Calculadora de Margem
                </h4>
                
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="relative group">
                    <label className="block text-[10px] text-gray-500 font-bold mb-1.5 uppercase ml-1">Custo</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">R$</span>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all placeholder-gray-300 shadow-sm" 
                        placeholder="0.00" 
                        value={costs[key] || ''} 
                        onChange={(e) => handleCostChange(key, e.target.value)} 
                      />
                    </div>
                  </div>
                  <div className="relative group">
                    <label className="block text-[10px] text-gray-500 font-bold mb-1.5 uppercase ml-1">Venda</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold pointer-events-none">R$</span>
                      <input 
                        type="number" 
                        min="0" 
                        step="0.01" 
                        className="w-full pl-9 pr-3 py-2 bg-white border border-gray-300 rounded-xl text-sm font-bold text-gray-800 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 outline-none transition-all placeholder-gray-100 shadow-sm" 
                        placeholder={t.avgPrice.toFixed(2)} 
                        value={sellPrices[key] || ''} 
                        onChange={(e) => handleSellPriceChange(key, e.target.value)} 
                      />
                    </div>
                  </div>
                </div>

                {/* Margem Result */}
                <div className={`group flex items-center justify-between p-4 rounded-xl border-2 transition-all shadow-sm ${mc}`}>
                  <div>
                    <div className={`text-[10px] font-black uppercase tracking-wider ${rec.color}`}>{rec.text}</div>
                    {margin !== null && (
                      <div className="text-[10px] text-gray-500 font-medium mt-1">
                        Lucro Líquido: <span className="font-bold text-gray-700">R$ {lucro}</span>
                      </div>
                    )}
                  </div>
                  <div className={`text-2xl font-black font-mono tracking-tighter ${margin !== null ? rec.color : 'text-gray-300'}`}>
                    {margin !== null ? `${margin.toFixed(1)}%` : '—%'}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-bold text-gray-900 leading-tight">Oportunidades reais <span className="font-normal text-gray-400 text-sm ml-2">— TTS &lt; 2h · Vendas &gt; 200 · Margem &gt; 30% · Full do termo &lt; 60%</span></h2>
        <p className="text-sm text-gray-500 mt-1">Produtos que passam em todos os filtros — incluindo o nível de competitividade logística do termo.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-10">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <h3 className="font-bold text-gray-800 text-sm">Melhores oportunidades encontradas</h3>
          <span className="bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full text-xs font-bold">{allCandidates.length} produtos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Produto</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Risco Full</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">TTS</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Vendas</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Preço</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Margem</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Envio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedCandidates.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-4 py-10 text-center text-gray-400 text-sm">
                    Nenhum produto aprovado nos rígidos critérios. Verifique se os termos têm Full &lt; 60% e insira seu custo nas calculadoras acima.
                  </td>
                </tr>
              ) : (
                paginatedCandidates.map(p => {
                  const t = terms[p.term];
                  const cost = Number.parseFloat(costs[p.term]) || 0;
                  const sellVal = Number.parseFloat(sellPrices[p.term]) || 0;
                  const priceToCalc = sellVal > 0 ? sellVal : p.price;
                  const margin = cost > 0 ? calcMargin(priceToCalc, cost) : null;
                  const fr = fullRisk(t.fullPct);

                  return (
                    <tr key={p.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => window.open(p.link, '_blank')}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800 line-clamp-2 text-xs" title={p.name}>{p.name}</div>
                        <div className="text-[10px] text-gray-400 mt-1 uppercase truncate max-w-[200px]" title={p.term}>
                          {p.term} · Full mercado: <span className={`font-bold ${t.fullPct < 30 ? 'text-[#10b981]' : t.fullPct < 60 ? 'text-[#f59e0b]' : 'text-[#ef4444]'}`}>{t.fullPct.toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${fr.cls}`}>{fr.label}</span></td>
                      <td className="px-4 py-3"><span className={`text-[11px] font-bold px-2 py-0.5 rounded-full font-mono ${p.tts < 1 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{p.tts}h</span></td>
                      <td className="px-4 py-3 font-semibold text-gray-700">{p.sales.toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-3 font-mono font-medium text-gray-800">R$ {p.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-center">
                        {margin !== null ? (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-purple-100 text-purple-700 font-mono">{margin.toFixed(1)}%</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {p.full ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-[#065f46]">✓ Full</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-500">Drop</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">
              Página <span className="text-gray-900 font-bold">{currentPage}</span> de <span className="text-gray-900 font-bold">{totalPages}</span>
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`p-2 rounded-lg border transition-all ${currentPage === 1 ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-500 hover:text-purple-600 shadow-sm cursor-pointer'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`p-2 rounded-lg border transition-all ${currentPage === totalPages ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-500 hover:text-purple-600 shadow-sm cursor-pointer'}`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

TermKPIs.propTypes = {
    results: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default TermKPIs;
