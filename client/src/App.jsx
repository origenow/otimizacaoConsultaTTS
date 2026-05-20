import PropTypes from 'prop-types';
import { useState, useMemo, useRef, useEffect } from 'react';
import XLSX from 'xlsx-js-style';
import MagicBento from './components/MagicBento';
import HomeOnboarding from './components/HomeOnboarding';
import LocationHeatmap from './components/LocationHeatmap';
import CookieUpdaterModal from './components/CookieUpdaterModal';
import CustomLoader from './components/CustomLoader';
import MarketAnalysis from './components/MarketAnalysis';
import TermKPIs from './components/TermKPIs';
import LoginPage from './components/LoginPage';
import { API_URL } from './config';

// Pure helper functions declared in outer scope to satisfy SonarQube major rules (S6478, S7721)
const safeFloat = (val) => {
  if (!val) return 999999;
  const str = String(val).replaceAll(',', '.');
  const num = Number.parseFloat(str);
  return Number.isNaN(num) ? 999999 : num;
};

const isFull = (item) => {
  return item.is_fulfillment === true || item.logistic_type === 'fulfillment';
};

const getProductStatus = (tts) => {
  const val = Number.parseFloat(tts);
  if (val <= 10) return {
    id: 'status-hot',
    label: 'Super Alta Demanda',
    color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
    icon: (
      <svg className="w-5 h-5 animate-[bounce_1s_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7 0 01-2.343 5.657z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
      </svg>
    )
  };
  if (val <= 30) return {
    id: 'status-good',
    label: 'Boa Performance',
    color: 'text-green-600 bg-green-50 hover:bg-green-100',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
      </svg>
    )
  };
  return {
    id: 'status-slow',
    label: 'Baixa Rotatividade',
    color: 'text-gray-600 bg-gray-50 hover:bg-gray-100',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };
};

const getProductBadges = (item) => {
  const status = getProductStatus(item.tts);
  const badges = [];

  // Status Badge
  badges.push({
    type: 'status',
    label: status.label,
    color: status.color,
    icon: status.icon
  });

  // Oportunidade
  if ((item.offers?.length || 0) <= 5 && Number.parseFloat(item.tts) < 3) {
    badges.push({
      type: 'opportunity',
      label: 'Oportunidade',
      color: 'text-green-600 bg-green-50 hover:bg-green-100',
      icon: (
        <svg className="w-4 h-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      )
    });
  }

  // Produto Arriscado
  if (item.catalog_tts_avg) {
    const diff = Math.abs(Number.parseFloat(item.tts) - item.catalog_tts_avg);
    const percentDiff = (diff / item.catalog_tts_avg) * 100;
    if (percentDiff > 50) {
      badges.push({
        type: 'risky',
        label: 'Produto Arriscado',
        color: 'text-red-600 bg-red-50 hover:bg-red-100',
        icon: (
          <svg className="w-4 h-4 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        )
      });
    }
  }

  // Concorrência Excessiva
  if ((item.offers?.length || 0) > 15) {
    badges.push({
      type: 'competition',
      label: 'Concorrência Alta',
      color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
      icon: (
        <svg className="w-4 h-4 animate-[spin_3s_linear_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )
    });
  }

  // Badge 1P (Mercado Livre)
  if (item.nickname && (item.nickname.toUpperCase().includes('MERCADOLIVRE') || item.nickname.toUpperCase().includes('MERCADO LIVRE'))) {
    badges.push({
      type: '1p',
      label: '1P',
      color: 'text-white bg-blue-600 hover:bg-blue-700 border border-yellow-400',
      icon: (
        <svg className="w-4 h-4 text-yellow-300" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      )
    });
  }

  // Full
  if (isFull(item)) {
    badges.push({
      type: 'full',
      label: 'Full',
      color: 'text-white bg-green-500 hover:bg-green-600',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    });
  }

  return badges;
};

const getSpeedWidth = (tts) => {
  const val = Number.parseFloat(tts);
  if (!val) return '0%';
  const percentage = Math.max(0, Math.min(100, ((720 - val) / 720) * 100));
  return `${percentage}%`;
};

const SortArrow = ({ colKey, tableSortBy, tableSortDir }) => {
  if (tableSortBy !== colKey) return <span className="ml-1 text-gray-300 group-hover/th:text-gray-400 transition-colors">↕</span>;
  return tableSortDir === 'asc'
    ? <span className="ml-1 text-origenow-purple">↑</span>
    : <span className="ml-1 text-origenow-purple">↓</span>;
};

SortArrow.propTypes = {
  colKey: PropTypes.string.isRequired,
  tableSortBy: PropTypes.string.isRequired,
  tableSortDir: PropTypes.string.isRequired,
};

const compareByField = (sortBy, a, b) => {
  switch (sortBy) {
    case 'price_asc':  return (a.price || 0) - (b.price || 0);
    case 'price_desc': return (b.price || 0) - (a.price || 0);
    case 'sales_desc': return (b.sales_quantity || 0) - (a.sales_quantity || 0);
    case 'date_desc':  return new Date(b.startTime || 0) - new Date(a.startTime || 0);
    default:           return safeFloat(a.tts) - safeFloat(b.tts);
  }
};

const getTableVal = (item, key) => {
  const map = {
    id: item.id || '',
    title: item.title || '',
    price: item.price || 0,
    nickname: item.nickname || '',
    city: item.city || '',
    state: item.state || '',
    sales_quantity: item.sales_quantity || 0,
    tts: safeFloat(item.tts),
    metodo: item.metodo_calculo || '',
    vendas_dia: item.vendas_1_dia || 0,
    shipping: item.shipping_cost || 0,
    fee: item.sale_fee_amount || 0,
    transactions: item.seller_transactions || 0,
    power_seller: item.power_seller_status || '',
    level: item.level_id || '',
    logistic: item.logistic_type || '',
  };
  return map[key] ?? '';
};

const compareTableRows = (a, b, sortBy, sortDir) => {
  const valA = getTableVal(a, sortBy);
  const valB = getTableVal(b, sortBy);
  const cmp = typeof valA === 'number' && typeof valB === 'number'
    ? valA - valB
    : String(valA).localeCompare(String(valB), 'pt-BR', { numeric: true });
  return sortDir === 'asc' ? cmp : -cmp;
};

const buildExcelWorkbook = ({ allCols, exportColumns, exportSearchTerm, tableSortedResults, selectedExportIds, exportRowLimit, query }) => {
  const selectedCols = allCols.filter(col => exportColumns[col.k]);
  if (!tableSortedResults.length || selectedCols.length === 0) return null;

  const finalCols = exportSearchTerm
    ? [...selectedCols, { k: 'search_query', header: 'TERMO DE BUSCA', width: 25, getValue: item => item.search_query || '' }]
    : selectedCols;

  const exportBase = selectedExportIds.size > 0
    ? tableSortedResults.filter(item => selectedExportIds.has(item.id))
    : tableSortedResults;

  const rowLimit = exportRowLimit && Number(exportRowLimit) > 0 ? Number(exportRowLimit) : exportBase.length;
  const dataToExport = exportBase.slice(0, rowLimit);
  const headers = finalCols.map(col => col.header);
  const data = dataToExport.map(item => finalCols.map(col => col.getValue(item)));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

  const headerStyle = {
    font: { bold: true, color: { rgb: '000000' } },
    fill: { fgColor: { rgb: 'EFEFEF' } },
    border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
  };
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let C = range.s.c; C <= range.e.c; ++C) {
    const address = XLSX.utils.encode_cell({ r: 0, c: C });
    if (ws[address]) ws[address].s = headerStyle;
  }
  ws['!cols'] = selectedCols.map(col => ({ wch: col.width }));

  XLSX.utils.book_append_sheet(wb, ws, 'Dados Origenow');
  const sanitizedQuery = query.replace(/[^a-zA-Z0-9]/g, '_') || 'dados';
  XLSX.writeFile(wb, `origenow_${sanitizedQuery}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  return true;
};

const computeStats = (results) => {
  if (results.length === 0) return null;
  const totalItems = results.length;
  const validTTS = results.filter(r => !Number.isNaN(Number.parseFloat(r.tts)));
  const validPrices = results.filter(r => typeof r.price === 'number' && !Number.isNaN(r.price));
  const avgTTS = validTTS.length
    ? (validTTS.reduce((acc, curr) => acc + Number.parseFloat(curr.tts), 0) / validTTS.length).toFixed(1)
    : 'N/A';
  const bestTTS = validTTS.length
    ? validTTS.reduce((prev, curr) => (Number.parseFloat(prev.tts) < Number.parseFloat(curr.tts) ? prev : curr), validTTS[0])
    : null;
  const minPrice = validPrices.length ? Math.min(...validPrices.map(r => r.price)) : 0;
  const maxPrice = validPrices.length ? Math.max(...validPrices.map(r => r.price)) : 0;
  const avgPrice = validPrices.length
    ? (validPrices.reduce((acc, curr) => acc + curr.price, 0) / validPrices.length).toFixed(2)
    : '0.00';
  const totalSales = results.reduce((acc, curr) => acc + (Number.parseInt(curr.sales_quantity) || 0), 0);
  return { totalItems, avgTTS, bestTTS, minPrice, maxPrice, avgPrice, totalSales };
};

const runSearchTerms = async (searchTerms, signal, setCurrentSearchIndex, setSearchProgress) => {
  const allResults = [];
  const errors = [];
  for (let i = 0; i < searchTerms.length; i++) {
    const term = searchTerms[i];
    setCurrentSearchIndex(i);
    setSearchProgress(`Buscando ${i + 1} de ${searchTerms.length}: "${term}"...`);
    try {
      const res = await fetchTerm(term, signal);
      if (res.requiresAuth) return { requiresAuth: true };
      if (res.success) allResults.push(...res.data);
      else errors.push(res.error);
    } catch (err) {
      if (err.name === 'AbortError') return { aborted: true };
      errors.push(`"${term}": ${err.message || 'Erro desconhecido.'}`);
      console.error(`[Busca] Erro ao buscar "${term}":`, err);
    }
  }
  return { allResults, errors };
};

const parseSearchTerms = (query) => {
  if (!query?.trim()) return [];
  return query.split(',')
    .map(t => t.trim())
    .map(t => t.replace(/[\\/|_\-+=]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};

const fetchTerm = async (term, signal) => {
  try {
    const response = await fetch(`${API_URL}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: term }),
      signal,
    });

    if (response.status === 401) {
      return { success: false, requiresAuth: true };
    }

    if (!response.ok) {
      let serverMessage = '';
      try {
        const errBody = await response.json();
        serverMessage = errBody.error || errBody.message || '';
      } catch { /* response body wasn't JSON, ignore */ }

      const statusMessages = {
        400: `Requisição inválida. ${serverMessage || 'Verifique o termo de busca e tente novamente.'}`,
        403: 'Acesso negado. Você não tem permissão para realizar esta busca.',
        404: 'Serviço de busca não encontrado. A API pode estar temporariamente indisponível.',
        429: 'Muitas requisições em pouco tempo. Aguarde alguns segundos e tente novamente.',
        500: `Erro interno no servidor. ${serverMessage || 'A equipe técnica foi notificada. Tente novamente em alguns minutos.'}`,
        502: 'O servidor está inicializando ou temporariamente fora do ar (502). Aguarde 1-2 minutos e tente novamente.',
        503: 'Serviço indisponível (503). O servidor pode estar em manutenção. Tente novamente em alguns minutos.',
        504: 'A requisição demorou demais para responder (timeout). Tente novamente com um termo de busca mais específico.',
      };

      const userMessage = statusMessages[response.status]
        || `Erro inesperado (código ${response.status}). ${serverMessage || 'Tente novamente mais tarde.'}`;

      return { success: false, error: `"${term}": ${userMessage}` };
    }

    const data = await response.json();
    const taggedData = data.map(item => ({ ...item, search_query: term }));
    return { success: true, data: taggedData };

  } catch (err) {
    if (err.name === 'AbortError') {
      throw err;
    }
    let userMessage = '';
    if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
      userMessage = `"${term}": Não foi possível conectar ao servidor.`;
    } else {
      userMessage = `"${term}": ${err.message || 'Erro desconhecido.'}`;
    }
    return { success: false, error: userMessage };
  }
};

function applyTableSort(tableSortBy, colKey, setTableSortBy, setTableSortDir, setTablePage) {
  if (tableSortBy === colKey) {
    setTableSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
  } else {
    setTableSortBy(colKey);
    setTableSortDir('asc');
  }
  setTablePage(1);
}

function buildStatsCards(stats, setSelectedProduct) {
  if (!stats) return [];

  const cards = [
    {
      id: 'total-items',
      title: stats.totalItems.toString(),
      label: 'Itens Analisados',
      description: 'Total de anúncios processados.',
      icon: (
        <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      colSpan: 1,
    },
    {
      id: 'avg-tts',
      title: `${stats.avgTTS} dias`,
      label: 'Média TTS',
      description: 'Tempo médio de venda.',
      icon: (
        <svg className="w-6 h-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      colSpan: 1,
    },
    {
      id: 'total-sales',
      title: stats.totalSales.toLocaleString('pt-BR'),
      label: 'Volume de Vendas',
      description: 'Total acumulado.',
      icon: (
        <svg className="w-6 h-6 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
      colSpan: 1,
    },
    {
      id: 'price-range',
      title: `R$ ${stats.avgPrice}`,
      label: 'Preço Médio',
      description: `Min: R$${stats.minPrice.toFixed(0)} - Max: R$${stats.maxPrice.toFixed(0)}`,
      icon: (
        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      colSpan: 1,
    },
  ];

  if (stats.bestTTS) {
    cards.push({
      id: 'best-tts',
      colSpan: 4,
      className: 'bg-gradient-to-r from-gray-900 to-gray-800 text-white !p-0',
      textColor: '#ffffff',
      onClick: () => setSelectedProduct(stats.bestTTS),
      customContent: (
        <div className="relative w-full h-full p-6 sm:p-8 flex flex-col md:flex-row gap-8 group overflow-hidden cursor-pointer" title="Clique para ver detalhes">
          <div className="absolute top-0 right-0 p-48 bg-white/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none transition-opacity opacity-50 group-hover:opacity-80"></div>
          <div className="flex-1 flex flex-col justify-center relative z-10 min-w-[40%]">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-origenow-fire/20 text-origenow-fire border border-origenow-fire/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-origenow-fire animate-pulse inline-block"></span>{' '}
                <span>Campeão de Vendas</span>
              </div>
              <span className="text-gray-400 text-xs font-bold tracking-widest uppercase opacity-70">Top #1 Performance</span>
            </div>
            <div className="flex items-start gap-5">
              <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-2xl p-2 shadow-2xl transform group-hover:scale-105 transition-transform duration-500 border border-white/10 flex-shrink-0">
                <img src={stats.bestTTS.thumbnail} alt="" className="w-full h-full object-contain mix-blend-multiply" />
              </div>
              <div className="flex flex-col gap-2 pt-1">
                <h3 className="font-bold text-lg sm:text-xl text-white leading-tight line-clamp-2 drop-shadow-md" title={stats.bestTTS.title}>
                  {stats.bestTTS.title}
                </h3>
                <p className="text-sm font-mono text-gray-400 flex items-center gap-2">
                  <span className="opacity-70">ID:</span> {stats.bestTTS.id}
                </p>
                <button className="mt-2 text-xs font-bold text-white bg-white/10 hover:bg-white/20 hover:cursor-pointer border border-white/20 px-4 py-2 rounded-lg transition-all w-fit flex items-center gap-2 group/btn">
                  Ver Detalhes
                  <svg className="w-3 h-3 transform group-hover/btn:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </button>
              </div>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4 items-center relative z-10">
            <div className="col-span-2 sm:col-span-1 bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors group/stat text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-black text-origenow-fire drop-shadow-sm">{stats.bestTTS.tts}</span>
                <span className="text-base text-white/50 font-medium">h</span>
              </div>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">Tempo por Venda</p>
              <p className="text-[10px] text-gray-500 mt-1 leading-tight">
                Velocidade: <span className="text-white font-bold">{stats.bestTTS.velocity?.toLocaleString('pt-BR')}</span> vendas/dia
              </p>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors text-center">
              <span className="text-3xl font-black text-white block">R$ {stats.bestTTS.price?.toFixed(2)}</span>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">Preço Atual</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-colors text-center">
              <span className="text-3xl font-black text-white block">{stats.bestTTS.sales_quantity?.toLocaleString('pt-BR')}</span>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-2">Vendas Totais</p>
              <p className="text-[10px] text-gray-500 mt-1">{stats.bestTTS.intervalo_dias ? `Em ${stats.bestTTS.intervalo_dias} dias` : 'No total'}</p>
            </div>
          </div>
        </div>
      )
    });
  }

  return cards;
}

function cancelSearch(abortControllerRef, results, setters) {
  const { setLoading, setSearchProgress, setHasSearched } = setters;
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    abortControllerRef.current = null;
  }
  setLoading(false);
  setSearchProgress('');
  if (results.length === 0) {
    setHasSearched(false);
  }
}

async function executeSearch(query, abortControllerRef, setters) {
  const {
    setCurrentSearchIndex, setSearchProgress, setLoading, setError, setResults,
    setShowAuthModal, setSelectedProduct, setSelectedProductFilter,
    setCurrentPage, setTablePage, setHasSearched, setSearchTermsCount,
  } = setters;

  const searchTerms = parseSearchTerms(query);
  if (searchTerms.length === 0) return;

  setSearchTermsCount(searchTerms.length);
  setCurrentSearchIndex(0);
  setLoading(true);
  setError(null);
  setResults([]);
  setSelectedProduct(null);
  setSelectedProductFilter(null);
  setCurrentPage(1);
  setTablePage(1);
  setHasSearched(true);
  setSearchProgress('');

  abortControllerRef.current = new AbortController();
  const outcome = await runSearchTerms(searchTerms, abortControllerRef.current.signal, setCurrentSearchIndex, setSearchProgress);

  if (outcome.requiresAuth) {
    setShowAuthModal(true);
    setLoading(false);
    setSearchProgress('');
    return;
  }
  if (outcome.aborted) {
    console.log('[Busca] Busca cancelada pelo usuário.');
    return;
  }

  const { allResults, errors } = outcome;
  setResults([...allResults]);

  if (errors.length > 0 && allResults.length === 0) {
    setError(errors.join('\n'));
  } else if (errors.length > 0) {
    setError(`Algumas buscas falharam: ${errors.join(' | ')}`);
  }

  setSearchProgress('');
  setLoading(false);
  abortControllerRef.current = null;
}

function filterResultsByTerm(results, selectedProductFilter) {
  if (!selectedProductFilter) return results;
  return results.filter(r => r.search_query === selectedProductFilter);
}

function buildExportLabel(exportRowLimit, effectiveCount) {
  if (exportRowLimit && Number(exportRowLimit) > 0) {
    return `${Math.min(Number(exportRowLimit), effectiveCount)} linhas`;
  }
  return `${effectiveCount} linhas`;
}

function triggerExcelExport(allCols, exportColumns, exportSearchTerm, tableSortedResults, selectedExportIds, exportRowLimit, query, setShowExportModal) {
  const exported = buildExcelWorkbook({ allCols, exportColumns, exportSearchTerm, tableSortedResults, selectedExportIds, exportRowLimit, query });
  if (exported) setShowExportModal(false);
}

async function updateCookie(newSsid, apiUrl, setShowAuthModal, retrySearch) {
  const response = await fetch(`${apiUrl}/api/settings/ssid`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ssid: newSsid }),
  });
  if (!response.ok) throw new Error('Falha ao atualizar config');
  setShowAuthModal(false);
  retrySearch(null);
}

function useEscapeKey(showExportModal, selectedProduct, showAuthModal, setShowExportModal, setSelectedProduct, setShowAuthModal) {
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== 'Escape') return;
      if (showExportModal) { setShowExportModal(false); return; }
      if (selectedProduct) { setSelectedProduct(null); return; }
      if (showAuthModal) setShowAuthModal(false);
    };
    globalThis.addEventListener('keydown', handler);
    return () => globalThis.removeEventListener('keydown', handler);
  }, [showExportModal, selectedProduct, showAuthModal, setShowExportModal, setSelectedProduct, setShowAuthModal]);
}

function App() {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const [results, setResults] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [tablePage, setTablePage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(6);
  const [loading, setLoading] = useState(false);
  const [searchProgress, setSearchProgress] = useState(''); // Ex: "Buscando 2 de 3: smartphone..."
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const abortControllerRef = useRef(null);
  const [showColumnFilter, setShowColumnFilter] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportColumns, setExportColumns] = useState({
    id: true, title: true, price: true, nickname: true, city: true, state: true,
    sales_quantity: true, tts: true, metodo: true, vendas_dia: true, shipping: true,
    fee: true, link: true, transactions: true, power_seller: true, level: true, logistic: true
  });
  const [exportRowLimit, setExportRowLimit] = useState('');
  const [exportSearchTerm, setExportSearchTerm] = useState(false);
  const [selectedProductFilter, setSelectedProductFilter] = useState(null); // null = Todos, or item.id
  const [activeTab, setActiveTab] = useState('resultados'); // 'resultados' | 'analise' | 'kpis'
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [isAdvancedAnalysisActive, setIsAdvancedAnalysisActive] = useState(false);
  const [showAdvancedModal, setShowAdvancedModal] = useState(false);

  // Independent table state
  const [tableSortBy, setTableSortBy] = useState('tts');
  const [tableSortDir, setTableSortDir] = useState('asc');
  const [tableItemsPerPage, setTableItemsPerPage] = useState(12);
  const [tableBadgeFilter, setTableBadgeFilter] = useState('Todos');
  const [selectedExportIds, setSelectedExportIds] = useState(new Set());
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [searchTermsCount, setSearchTermsCount] = useState(0);

  // Column Visibility State
  const [visibleColumns, setVisibleColumns] = useState({
    id: true, title: true, price: true, nickname: false, city: false, state: true,
    sales_quantity: true, tts: true, metodo: false, vendas_dia: false, shipping: false,
    fee: false, link: false, transactions: false, power_seller: false, level: false,
    logistic: true
  });

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!query.trim()) return;
    await executeSearch(query, abortControllerRef, {
      setCurrentSearchIndex, setSearchProgress, setLoading, setError, setResults,
      setShowAuthModal, setSelectedProduct, setSelectedProductFilter,
      setCurrentPage, setTablePage, setHasSearched, setSearchTermsCount,
    });
  };

  const handleCancelSearch = () => cancelSearch(abortControllerRef, results, { setLoading, setSearchProgress, setHasSearched });

  const handleUpdateCookie = (newSsid) => updateCookie(newSsid, API_URL, setShowAuthModal, handleSearch);

  const handleLogin = () => {
    localStorage.setItem('isLoggedIn', 'true');
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    setIsAuthenticated(false);
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setActiveTab('resultados');
    setIsAdvancedAnalysisActive(false);
  };



  // All exportable columns definition
  const allExportColumns = [
    { k: 'id', l: 'ID', header: 'ID', width: 15, getValue: item => item.id },
    { k: 'title', l: 'Título', header: 'TÍTULO', width: 40, getValue: item => item.title || '' },
    { k: 'price', l: 'Preço', header: 'PREÇO (R$)', width: 12, getValue: item => item.price || 0 },
    { k: 'nickname', l: 'Vendedor', header: 'VENDEDOR', width: 20, getValue: item => item.nickname },
    { k: 'city', l: 'Cidade', header: 'CIDADE', width: 15, getValue: item => item.city },
    { k: 'state', l: 'Estado', header: 'ESTADO', width: 10, getValue: item => item.state },
    { k: 'sales_quantity', l: 'Vendas Totais', header: 'VENDAS TOTAIS', width: 15, getValue: item => item.sales_quantity },
    { k: 'tts', l: 'TTS (h/venda)', header: 'TTS (HORAS/VENDA)', width: 20, getValue: item => item.tts || 0 },
    { k: 'metodo', l: 'Método Cálculo', header: 'MÉTODO CÁLCULO', width: 15, getValue: item => item.metodo_calculo },
    { k: 'vendas_dia', l: 'Velocidade (vendas/dia)', header: 'VELOCIDADE (VENDAS/DIA)', width: 20, getValue: item => item.velocity || 0 },
    { k: 'shipping', l: 'Custo Frete', header: 'CUSTO FRETE', width: 15, getValue: item => item.shipping_cost || 0 },
    { k: 'fee', l: 'Taxa Venda', header: 'TAXA VENDA', width: 15, getValue: item => item.sale_fee_amount || 0 },
    { k: 'link', l: 'Link Anúncio', header: 'LINK ANÚNCIO', width: 50, getValue: item => item.permalink },
    { k: 'transactions', l: 'Transações Vendedor', header: 'TRANSAÇÕES VENDEDOR', width: 20, getValue: item => item.seller_transactions },
    { k: 'power_seller', l: 'Status Power Seller', header: 'STATUS POWER SELLER', width: 20, getValue: item => item.power_seller_status },
    { k: 'level', l: 'Nível Reputação', header: 'NÍVEL REPUTAÇÃO', width: 20, getValue: item => item.level_id },
    { k: 'logistic', l: 'Logística', header: 'LOGÍSTICA', width: 20, getValue: item => item.logistic_type || '' },
  ];

  // Open export modal (reset defaults)
  const openExportModal = () => {
    setExportRowLimit('');
    setExportSearchTerm(false);
    setShowExportModal(true);
  };

  // Export to Excel — delegates to pure helper buildExcelWorkbook
  const exportToExcel = () => triggerExcelExport(allExportColumns, exportColumns, exportSearchTerm, tableSortedResults, selectedExportIds, exportRowLimit, query, setShowExportModal);

  // Sorting state
  const [sortBy, setSortBy] = useState('tts_asc');

  // Filtered results based on the search term filter menu
  const filteredResults = useMemo(() => filterResultsByTerm(results, selectedProductFilter), [results, selectedProductFilter]);

  // Unique search terms for the filter menu
  const uniqueSearchTerms = useMemo(() => {
    const terms = [...new Set(results.map(item => item.search_query).filter(Boolean))];
    return terms;
  }, [results]);

  // Sort results based on selected criteria
  const sortedResults = useMemo(
    () => [...filteredResults].sort((a, b) => compareByField(sortBy, a, b)),
    [filteredResults, sortBy]
  );

  // Table-specific sorted results (independent from cards)
  const tableSortedResults = useMemo(() => {
    const baseResults = tableBadgeFilter === 'Todos'
      ? filteredResults
      : filteredResults.filter(item => getProductBadges(item).some(b => b.label === tableBadgeFilter));
    return [...baseResults].sort((a, b) => compareTableRows(a, b, tableSortBy, tableSortDir));
  }, [filteredResults, tableSortBy, tableSortDir, tableBadgeFilter]);

  const uniqueTableResults = useMemo(() => {
    return Array.from(new Map(tableSortedResults.map(item => [item.id, item])).values());
  }, [tableSortedResults]);

  const currentTableItems = useMemo(() => {
    const indexOfLastItem = tablePage * tableItemsPerPage;
    const indexOfFirstItem = indexOfLastItem - tableItemsPerPage;
    return uniqueTableResults.slice(indexOfFirstItem, indexOfLastItem);
  }, [uniqueTableResults, tablePage, tableItemsPerPage]);

  const handleTableSort = (colKey) => applyTableSort(tableSortBy, colKey, setTableSortBy, setTableSortDir, setTablePage);

  // Reset pagination when data changes or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filteredResults, itemsPerPage, sortBy]);

  useEffect(() => {
    setTablePage(1);
  }, [filteredResults, tableItemsPerPage, tableSortBy, tableSortDir]);

  useEscapeKey(showExportModal, selectedProduct, showAuthModal, setShowExportModal, setSelectedProduct, setShowAuthModal);

  // Dashboard calculations delegated to pure helper (S3776)
  const stats = useMemo(() => computeStats(filteredResults), [filteredResults]);

  // Transform stats for MagicBento
  const statsCards = useMemo(() => buildStatsCards(stats, setSelectedProduct), [stats, setSelectedProduct]);

  const effectiveCount = selectedExportIds.size > 0 ? selectedExportIds.size : tableSortedResults.length;
  const exportLabel = buildExportLabel(exportRowLimit, effectiveCount);

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-[#f8f7fc] text-gray-800 pb-20 selection:bg-purple-200 selection:text-purple-900 relative overflow-x-hidden">
      {/* Ambient Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-200/30 rounded-full blur-[120px] mix-blend-multiply filter"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[30%] bg-indigo-200/30 rounded-full blur-[100px] mix-blend-multiply filter"></div>
        <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] bg-pink-100/40 rounded-full blur-[80px] mix-blend-multiply filter"></div>
      </div>

      {/* Professional Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b border-gray-100"
        style={{
          minHeight: '72px',
          height: 'auto',
          backgroundColor: 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)'
        }}
      >
        <div className="max-w-[1200px] mx-auto px-5 h-full flex flex-col sm:flex-row items-center justify-between gap-4 py-3 sm:py-0">
          {/* Left: Brand */}
          <a href="/" className="flex items-center gap-3 cursor-pointer group">
            <img src="/logo-origenow.png" alt="Origenow Logo" className="h-20 w-auto object-contain" />
          </a>

          {/* Center: Search (Pill Shape) — only visible after first search */}
          {hasSearched && (
            <div className="flex-1 w-full sm:w-auto max-w-[520px] block mt-2 sm:mt-0">
              <form onSubmit={handleSearch} className="relative group transition-all duration-300 focus-within:scale-[1.01]">
                <div className="absolute top-0 left-0 pl-4 flex h-[44px] items-center pointer-events-none opacity-70">
                  <svg className="w-5 h-5 text-gray-500 group-focus-within:text-purple-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <textarea
                  ref={hasSearched ? searchInputRef : undefined}
                  rows={1}
                  className="block w-full pl-12 pr-28 py-2.5 rounded-[22px] text-sm text-gray-700 bg-gray-50/55 border border-gray-200/22 focus:bg-white focus:border-purple-500/35 focus:ring-4 focus:ring-purple-500/10 outline-none transition-all duration-300 placeholder-gray-400 shadow-sm resize-none custom-scrollbar"
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
                  style={{ minHeight: '44px', maxHeight: '160px', overflowY: 'auto' }}
                />
                <div className="absolute top-1 right-1 h-[36px]">
                  <button
                    type={loading ? "button" : "submit"}
                    onClick={loading ? handleCancelSearch : undefined}
                    className={`h-full px-6 bg-gradient-to-r hover:cursor-pointer ${loading
                        ? "from-red-600 to-rose-500 hover:from-red-700 hover:to-rose-600 shadow-red-500/20 hover:shadow-red-500/30"
                        : "from-violet-600 to-purple-500 hover:from-violet-700 hover:to-purple-600 shadow-purple-500/20 hover:shadow-purple-500/30"
                      } text-white text-xs font-bold uppercase tracking-wide rounded-full shadow-md hover:shadow-lg hover:-translate-y-px transition-all duration-300 flex items-center gap-2`}
                  >
                    {loading ? (
                      <>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>{' '}
                        <span>Cancelar</span>
                      </>
                    ) : 'Buscar'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Right: Actions & Logout */}
          <div className="flex items-center gap-3">
            {!isAdvancedAnalysisActive && hasSearched && (
              <button
                onClick={() => setShowAdvancedModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl text-xs font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="hidden sm:inline">Análise Avançada</span>
                <span className="sm:hidden">Análise</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-gray-500 hover:text-red-600 transition-colors hover:bg-red-50 rounded-xl cursor-pointer"
              title="Sair da plataforma"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="hidden sm:inline">Sair</span>
            </button>
            <div className="hidden"></div>
          </div>
        </div>
      </nav>

      <div className="w-full px-4 sm:px-6 lg:px-8 pt-28 pb-10 space-y-12">

        {/* Loading State - Full Screen centering */}
        {loading && (
          <div className="flex flex-col justify-center items-center min-h-[calc(100vh-200px)] animate-fade-in transition-all duration-500">
            <CustomLoader 
              message={searchProgress || undefined} 
              progress={currentSearchIndex} 
              termsCount={searchTermsCount} 
            />
          </div>
        )}

        {/* Onboarding / Landing Page (Visible only on first visit / no search) */}
        {!hasSearched && !loading && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] animate-fade-in-up">
            <HomeOnboarding
              query={query}
              setQuery={setQuery}
              handleSearch={handleSearch}
              handleCancelSearch={handleCancelSearch}
              loading={loading}
              searchInputRef={searchInputRef}
            />
          </div>
        )}

        {error && (
          <div className="max-w-4xl mx-auto rounded-xl bg-red-50 p-4 border border-red-100 flex items-center gap-4 text-red-700 shadow-sm animate-shake">
            <div className="p-2 bg-red-100 rounded-full">
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
            </div>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {!loading && hasSearched && results.length === 0 && !error && !showAuthModal && (
          <div className="flex flex-col items-center justify-center py-20 animate-fade-in-up text-center">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-origenow-purple/20 blur-3xl rounded-full"></div>
              <svg className="w-48 h-48 text-gray-300 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={0.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="absolute bottom-4 right-4 bg-white rounded-full p-2 shadow-lg animate-bounce-slow">
                <svg className="w-8 h-8 text-origenow-fire" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
            </div>

            <h3 className="text-3xl font-bold text-gray-900 mb-2">Ops! Nada encontrado.</h3>
            <p className="text-gray-500 text-lg max-w-md mx-auto mb-8">
              Não encontramos nenhum produto para <span className="font-bold text-gray-800">"{query}"</span>.
            </p>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 max-w-lg w-full text-left">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 border-b pb-2">Dicas para melhorar sua busca:</h4>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-0.5">✓</span>{' '}
                  <span>Verifique se há erros de digitação.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-0.5">✓</span>{' '}
                  <span>Tente usar termos mais genéricos (ex: "celular" em vez de "iphone 15 pro max 256gb azul").</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-green-500 mt-0.5">✓</span>{' '}
                  <span>Navegue por categorias diferentes.</span>
                </li>
              </ul>
            </div>
          </div>
        )}



        {results.length > 0 && stats && !loading && (
          <div className="space-y-8 animate-fade-in-up">

            {/* Search Term Filter Menu */}
            {uniqueSearchTerms.length > 1 && (
              <div className="mb-2">
                <div className="flex items-center justify-start gap-2 overflow-x-auto pb-4 px-4 custom-scrollbar">
                  <button
                    onClick={() => setSelectedProductFilter(null)}
                    className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 border cursor-pointer whitespace-nowrap ${selectedProductFilter === null
                      ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-origenow-purple hover:bg-purple-50'
                      }`}
                  >
                    Todos ({results.length})
                  </button>
                  {uniqueSearchTerms.map((term) => {
                    const count = results.filter(r => r.search_query === term).length;
                    return (
                      <button
                        key={term}
                        onClick={() => setSelectedProductFilter(term)}
                        className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 border cursor-pointer whitespace-nowrap ${selectedProductFilter === term
                          ? 'bg-purple-100 text-purple-800 border-purple-300 shadow-sm font-bold'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:text-origenow-purple hover:bg-purple-50'
                          }`}
                      >
                        {term} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Tab Bar ── */}
            <div className="flex items-center justify-between w-full relative mb-4">
              {isAdvancedAnalysisActive ? (
                <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                  {[
                    {
                      id: 'resultados', label: 'Resultados', icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                      )
                    },
                    {
                      id: 'analise', label: 'Análise de Mercado', icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                      )
                    },
                    {
                      id: 'kpis', label: 'Estatísticas', icon: (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>
                      )
                    },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer ${activeTab === tab.id
                          ? 'bg-white text-origenow-purple shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                        }`}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex-1"></div>
              )}
            </div>

            {/* ── Aba Resultados ── */}
            {activeTab === 'resultados' && (<>

              {/* Magic Bento Stats */}
              <MagicBento cards={statsCards} />

              {/* Highlights Section (Cards) */}
              <section>
                <div className="flex flex-wrap items-center justify-between gap-4 mb-8 pl-2 border-l-4 border-origenow-purple">
                  <div className="flex items-center gap-3">
                    <h3 className="text-2xl font-bold text-gray-900 ml-3">Destaques</h3>
                    <span className="text-sm font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">{sortedResults.length} resultados</span>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-4">

                    {/* Sorting Filter */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Ordenar:</span>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 shadow-sm outline-none"
                      >
                        <option value="tts_asc">TTS (Menor p/ Maior)</option>
                        <option value="sales_desc">Volume de Vendas</option>
                        <option value="price_asc">Menor Preço</option>
                        <option value="price_desc">Maior Preço</option>
                        <option value="date_desc">Mais Recentes</option>
                      </select>
                    </div>

                    {/* Items Per Page Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-500">Exibir:</span>
                      <select
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 shadow-sm outline-none"
                      >
                        <option value={3}>3</option>
                        <option value={6}>6</option>
                        <option value={12}>12</option>
                        <option value={24}>24</option>
                        <option value={48}>48</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Pagination Logic */}
                {(() => {
                  const uniqueResults = Array.from(new Map(sortedResults.map(item => [item.id, item])).values());
                  const indexOfLastItem = currentPage * itemsPerPage;
                  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
                  const currentItems = uniqueResults.slice(indexOfFirstItem, indexOfLastItem);
                  const totalPages = Math.ceil(uniqueResults.length / itemsPerPage);

                  return (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
                        {currentItems.map((item, idx) => {
                          const globalIndex = indexOfFirstItem + idx + 1; // 1-based ranking
                          const rulerWidth = getSpeedWidth(item.tts);
                          const badges = getProductBadges(item);

                          const is1P = item.nickname?.toLowerCase().includes('mercadolivre') || item.nickname?.toLowerCase().includes('loja oficial');

                          return (
                            <div key={`card-${item.id}`} className={`group relative bg-white rounded-2xl shadow-sm border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-gray-100 hover:border-purple-200`}>

                              {/* Ranking Badge */}
                              {(() => {
                                if (globalIndex === 1) return (
                                  <div className="absolute -top-4 -left-4 w-12 h-12 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-500 flex items-center justify-center text-yellow-900 font-black text-xl shadow-xl shadow-yellow-500/40 z-30 border-4 border-white animate-bounce-slow">👑</div>
                                );
                                if (globalIndex === 2) return (
                                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-gray-200 via-gray-300 to-gray-400 flex items-center justify-center text-gray-800 font-black text-lg shadow-lg z-30 border-2 border-white">🥈</div>
                                );
                                if (globalIndex === 3) return (
                                  <div className="absolute -top-3 -left-3 w-10 h-10 rounded-full bg-gradient-to-br from-orange-200 via-orange-300 to-orange-400 flex items-center justify-center text-orange-900 font-black text-lg shadow-lg z-30 border-2 border-white">🥉</div>
                                );
                                return (
                                  <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white font-black text-sm shadow-lg z-30 border-2 border-white">#{globalIndex}</div>
                                );
                              })()}

                              {/* Card Header */}
                              <div className="p-5 flex items-start gap-4 border-b border-gray-50 bg-gradient-to-br from-white to-gray-50/50 rounded-t-2xl">
                                <div className="flex-1 min-w-0">
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {badges.map((badge) => (
                                      <div key={badge.type} className={`group/icon relative inline-flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-help ${badge.color}`}>
                                        {badge.icon}
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover/icon:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          {badge.label}
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <h4 className="text-sm font-bold text-gray-900 leading-snug line-clamp-2 group-hover:text-origenow-purple transition-colors" title={item.title}>
                                    {item.title}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-2">
                                    <p className="text-[10px] text-gray-400 font-mono bg-gray-100 inline-block px-1.5 py-0.5 rounded text-gray-500">{item.id}</p>
                                    {is1P && (
                                      <div className="group/tooltip relative">
                                        <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded cursor-help">1P</span>
                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-blue-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover/tooltip:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                          Vendido por Mercado Livre
                                          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-blue-900"></div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Speed Ruler */}
                              {(() => {
                                const ttsNum = Number.parseFloat(item.tts);
                                let speedLabel = 'Normal';
                                if (ttsNum <= 1) speedLabel = '⚡ Instantâneo';
                                else if (ttsNum > 168) speedLabel = '🐢 Lento';
                                const isFast = ttsNum <= 24;
                                return (
                                  <div className="px-5 py-4 bg-white">
                                    <div className="flex justify-between text-[10px] mb-2 uppercase tracking-wide font-bold text-gray-400">
                                      <span>Velocidade</span>
                                      <span className={isFast ? 'text-origenow-fire' : 'text-gray-600'}>
                                        {speedLabel}
                                      </span>
                                    </div>
                                    <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden shadow-inner">
                                      <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden ${isFast ? 'bg-gradient-to-r from-yellow-400 to-origenow-fire' : 'bg-gradient-to-r from-purple-400 to-origenow-purple'}`}
                                        style={{ width: rulerWidth }}
                                      >
                                        <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite]"></div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })()}

                              {/* Card Footer */}
                              <div className="mt-auto p-4 flex items-center justify-between border-t border-gray-50 bg-gray-50/30 group-hover:bg-purple-50/30 transition-colors">
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">Vendas</span>
                                  <span className="font-bold text-gray-700">{item.sales_quantity}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[10px] text-gray-400 block uppercase font-bold tracking-wider">TTS</span>
                                  <span className="font-bold font-mono text-origenow-purple text-xl tracking-tight">{item.tts}<span className="text-sm ml-0.5 opacity-70">h</span></span>
                                </div>
                              </div>

                              {/* Action */}
                              <button onClick={() => setSelectedProduct(item)} className="block w-full py-3 text-center text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-black hover:cursor-pointer hover:bg-origenow-purple transition-all duration-300 rounded-b-2xl">
                                Ver Detalhes
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {/* Pagination Controls */}
                      {uniqueResults.length > itemsPerPage && (
                        <div className="flex justify-center mt-12 gap-2">
                          <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:cursor-pointer text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:text-origenow-purple font-bold transition-colors"
                          >
                            Anterior
                          </button>
                          <span className="flex items-center px-4 font-bold text-gray-500">
                            Página {currentPage} de {totalPages}
                          </span>
                          <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:cursor-pointer text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:text-origenow-purple font-bold transition-colors"
                          >
                            Próxima
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </section>

              {/* Detailed Table Section */}
              <section className="pt-10 border-t border-gray-200">
                <div className="flex flex-col lg:flex-row gap-8">

                  {/* ── Lateral Filter Sidebar ── */}
                  <div className="w-full lg:w-[70px] flex-shrink-0">
                    <div className="bg-white rounded-2xl border border-gray-100 p-2 shadow-sm sticky top-[100px]">
                      <div className="flex justify-center items-center py-2 mb-2 border-b border-gray-100 group/header relative cursor-help" title="Filtros de Performance">
                        <svg className="w-5 h-5 text-gray-400 group-hover/header:text-origenow-purple transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                      </div>

                      <div className="space-y-1 custom-scrollbar overflow-y-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                        {(() => {
                          const counts = { Todos: filteredResults.length };
                          filteredResults.forEach(item => {
                            const badges = getProductBadges(item);
                            badges.forEach(b => {
                              counts[b.label] = (counts[b.label] || 0) + 1;
                            });
                          });

                          const filtersData = [
                            { label: 'Todos', icon: '📋' },
                            { label: 'Super Alta Demanda', icon: '🔥' },
                            { label: 'Boa Performance', icon: '⚡' },
                            { label: 'Baixa Rotatividade', icon: '🐢' },
                            { label: 'Oportunidade', icon: '💎' },
                            { label: 'Produto Arriscado', icon: '⚠️' },
                            { label: 'Concorrência Alta', icon: '⚔️' },
                            { label: '1P', icon: '⭐' },
                            { label: 'Full', icon: '📦' },
                          ];

                          return filtersData.map(fb => {
                            const c = counts[fb.label] || 0;
                            return (
                              <button
                                key={fb.label}
                                title={fb.label}
                                onClick={() => { setTableBadgeFilter(fb.label); setTablePage(1); }}
                                className={`group/btn relative w-full flex flex-col justify-center items-center py-2 px-1 rounded-xl text-sm transition-all focus:outline-none cursor-pointer border ${tableBadgeFilter === fb.label
                                    ? 'bg-purple-100/80 shadow-sm border-purple-200/50'
                                    : 'hover:bg-gray-50 bg-white border-transparent hover:border-gray-100'
                                  }`}
                              >
                                <span className={`text-xl ${tableBadgeFilter === fb.label ? '' : 'grayscale opacity-70 group-hover/btn:grayscale-0 group-hover/btn:opacity-100 transition-all'}`}>
                                  {fb.icon}
                                </span>
                                <span className={`mt-1 text-[10px] px-1.5 py-0.5 rounded font-bold transition-colors ${tableBadgeFilter === fb.label ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-500 group-hover/btn:bg-purple-100 group-hover/btn:text-purple-700'
                                  }`}>
                                  {c}
                                </span>
                              </button>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* ── Table Area ── */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-8 gap-4">
                      <h3 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <div className="p-2 bg-purple-100 text-origenow-purple rounded-lg">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7-4h14M4 6h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2z" /></svg>
                        </div>
                        Dados Detalhados
                      </h3>

                      <div className="flex flex-wrap w-full sm:w-auto justify-between sm:justify-end gap-3 items-center">
                        {/* Items Per Page Selector */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-500">Exibir:</span>
                          <select
                            value={tableItemsPerPage}
                            onChange={(e) => { setTableItemsPerPage(Number(e.target.value)); setTablePage(1); }}
                            className="bg-white border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-purple-500 focus:border-purple-500 block p-2 shadow-sm outline-none"
                          >
                            <option value={6}>6</option>
                            <option value={12}>12</option>
                            <option value={24}>24</option>
                            <option value={48}>48</option>
                            <option value={100}>100</option>
                          </select>
                        </div>

                        {/* Export Excel Button */}
                        <button
                          onClick={openExportModal}
                          disabled={!tableSortedResults.length}
                          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:cursor-pointer text-gray-700 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Configurar e exportar resultados para Excel"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                          {selectedExportIds.size > 0 ? `Exportar (${selectedExportIds.size})` : 'Exportar Excel'}
                        </button>

                        {/* Column Filter */}
                        <div className="relative">
                          <button
                            onClick={() => setShowColumnFilter(!showColumnFilter)}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:cursor-pointer text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" /></svg>
                            Colunas
                          </button>

                          {showColumnFilter && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-50 animate-fade-in-up">
                              <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-gray-900 text-sm">Colunas Visíveis</h4>
                                <button onClick={() => setShowColumnFilter(false)} className="text-gray-400 hover:text-gray-600"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                              </div>
                              <div className="space-y-1 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                {[
                                  { k: 'id', l: 'ID' }, { k: 'title', l: 'Título' }, { k: 'price', l: 'Preço' },
                                  { k: 'nickname', l: 'Vendedor' }, { k: 'city', l: 'Cidade' }, { k: 'state', l: 'Estado' },
                                  { k: 'sales_quantity', l: 'Vendas' }, { k: 'tts', l: 'TTS' }, { k: 'metodo', l: 'Método' },
                                  { k: 'vendas_dia', l: 'Vendas/Dia' }, { k: 'shipping', l: 'Frete' }, { k: 'fee', l: 'Taxa' },
                                  { k: 'logistic', l: 'Logística' },
                                  { k: 'link', l: 'Link' }, { k: 'transactions', l: 'Total Vendas' }, { k: 'power_seller', l: 'Status' }, { k: 'level', l: 'Nível' }
                                ].map(({ k, l }) => (
                                  <label key={k} htmlFor={`vis-col-${k}`} className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer hover:bg-purple-50 p-2 rounded-lg transition-colors select-none">
                                    <input
                                      id={`vis-col-${k}`}
                                      type="checkbox"
                                      checked={visibleColumns[k]}
                                      onChange={() => setVisibleColumns(prev => ({ ...prev, [k]: !prev[k] }))}
                                      className="w-4 h-4 rounded text-origenow-purple focus:ring-origenow-purple border-gray-300"
                                    />
                                    <span className="font-medium">{l}</span>
                                  </label>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="bg-white shadow-xl shadow-gray-200/50 overflow-x-auto rounded-2xl border border-gray-100">
                      <table className="min-w-full divide-y divide-gray-100">
                        <thead className="bg-gray-50/80">
                          <tr>
                            <th scope="col" className="w-10 px-6 py-4 first:rounded-tl-2xl bg-gray-50/50">
                              <input
                                type="checkbox"
                                checked={tableSortedResults.length > 0 && selectedExportIds.size === new Set(tableSortedResults.map(i => i.id)).size}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const newSet = new Set(selectedExportIds);
                                    tableSortedResults.forEach(item => newSet.add(item.id));
                                    setSelectedExportIds(newSet);
                                  } else {
                                    const newSet = new Set(selectedExportIds);
                                    tableSortedResults.forEach(item => newSet.delete(item.id));
                                    setSelectedExportIds(newSet);
                                  }
                                }}
                                className="w-4 h-4 rounded text-origenow-purple focus:ring-origenow-purple border-gray-300 cursor-pointer"
                                title="Selecionar todos visíveis"
                              />
                            </th>
                            {visibleColumns.id && <th scope="col" onClick={() => handleTableSort('id')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">ID<SortArrow colKey="id" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.title && <th scope="col" onClick={() => handleTableSort('title')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Título<SortArrow colKey="title" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.price && <th scope="col" onClick={() => handleTableSort('price')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Preço<SortArrow colKey="price" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.nickname && <th scope="col" onClick={() => handleTableSort('nickname')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Vendedor<SortArrow colKey="nickname" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.city && <th scope="col" onClick={() => handleTableSort('city')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Cidade<SortArrow colKey="city" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.state && <th scope="col" onClick={() => handleTableSort('state')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Estado<SortArrow colKey="state" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.sales_quantity && <th scope="col" onClick={() => handleTableSort('sales_quantity')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Vendas<SortArrow colKey="sales_quantity" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.tts && <th scope="col" onClick={() => handleTableSort('tts')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">TTS<SortArrow colKey="tts" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.metodo && <th scope="col" onClick={() => handleTableSort('metodo')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Método<SortArrow colKey="metodo" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.vendas_dia && <th scope="col" onClick={() => handleTableSort('vendas_dia')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Vendas/Dia<SortArrow colKey="vendas_dia" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.shipping && <th scope="col" onClick={() => handleTableSort('shipping')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Frete<SortArrow colKey="shipping" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.fee && <th scope="col" onClick={() => handleTableSort('fee')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Taxa<SortArrow colKey="fee" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.logistic && <th scope="col" onClick={() => handleTableSort('logistic')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Logística<SortArrow colKey="logistic" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.link && <th scope="col" className="px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap">Link</th>}
                            {visibleColumns.transactions && <th scope="col" onClick={() => handleTableSort('transactions')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Total Vendas<SortArrow colKey="transactions" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.power_seller && <th scope="col" onClick={() => handleTableSort('power_seller')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none">Status<SortArrow colKey="power_seller" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                            {visibleColumns.level && <th scope="col" onClick={() => handleTableSort('level')} className="group/th px-6 py-4 text-left text-xs font-bold text-origenow-purple uppercase tracking-wider whitespace-nowrap cursor-pointer hover:bg-purple-50 transition-colors select-none last:rounded-tr-2xl">Nível<SortArrow colKey="level" tableSortBy={tableSortBy} tableSortDir={tableSortDir} /></th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100 text-sm">
                          {currentTableItems.length === 0 ? (
                            <tr><td colSpan="100%" className="text-center py-8 text-gray-400">Nenhum dado visível</td></tr>
                          ) : (
                            currentTableItems.map((item) => (
                              <tr key={item.id} onClick={() => setSelectedProduct(item)} className={`cursor-pointer transition-colors duration-200 group border-l-4 ${selectedProduct?.id === item.id ? 'bg-purple-50 border-origenow-purple shadow-inner' : 'hover:bg-purple-50/40 border-transparent hover:border-origenow-purple'}`}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={selectedExportIds.has(item.id)}
                                    onChange={(e) => {
                                      const newSet = new Set(selectedExportIds);
                                      if (e.target.checked) newSet.add(item.id);
                                      else newSet.delete(item.id);
                                      setSelectedExportIds(newSet);
                                    }}
                                    className="w-4 h-4 rounded text-origenow-purple focus:ring-origenow-purple border-gray-300 cursor-pointer"
                                  />
                                </td>
                                {visibleColumns.id && <td className="px-6 py-4 whitespace-nowrap font-mono text-gray-400 text-xs font-medium group-hover:text-origenow-purple transition-colors">{item.id}</td>}

                                {visibleColumns.title && <td className="px-6 py-4 text-gray-900 min-w-[300px]">
                                  <div className="flex items-center gap-3">
                                    {item.thumbnail && (
                                      <div className="w-12 h-12 flex-shrink-0 bg-white border border-gray-100 rounded-lg p-1">
                                        <img src={item.thumbnail} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                                      </div>
                                    )}
                                    <div className="line-clamp-2 font-semibold group-hover:text-origenow-purple transition-colors" title={item.title}>{item.title}</div>
                                  </div>
                                </td>}

                                {visibleColumns.price && <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-bold">R$ {item.price?.toFixed(2)}</td>}

                                {visibleColumns.nickname && <td className="px-6 py-4 whitespace-nowrap text-gray-600 flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase">
                                    {item.nickname ? item.nickname.substring(0, 2) : 'NA'}
                                  </div>
                                  {item.nickname || 'N/A'}
                                </td>}

                                {visibleColumns.city && <td className="px-6 py-4 whitespace-nowrap text-gray-500">{item.city || 'N/A'}</td>}
                                {visibleColumns.state && <td className="px-6 py-4 whitespace-nowrap text-gray-500">{item.state || 'N/A'}</td>}
                                {visibleColumns.sales_quantity && <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold">{item.sales_quantity}</td>}

                                {visibleColumns.tts && <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`font-mono font-bold px-2 py-1 rounded ${Number.parseFloat(item.tts) <= 24 ? 'bg-orange-100 text-origenow-fire' : 'bg-purple-100 text-origenow-purple'}`}>
                                    {item.tts}h
                                  </span>
                                </td>}

                                {visibleColumns.metodo && <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">{item.metodo_calculo}</td>}
                                {visibleColumns.vendas_dia && <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-medium">{item.vendas_1_dia}</td>}

                                {visibleColumns.shipping && <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                  {item.free_shipping
                                    ? <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-800">Grátis</span>
                                    : <span>{item.shipping_cost === 999 ? '?' : `R$ ${item.shipping_cost?.toFixed(2)}`}</span>}
                                </td>}

                                {visibleColumns.fee && <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                                  {item.sale_fee_amount ? `R$ ${item.sale_fee_amount.toFixed(2)}` : 'N/A'}
                                </td>}

                                {visibleColumns.logistic && <td className="px-6 py-4 whitespace-nowrap">
                                  {isFull(item) ? (
                                    <div className="group/logistic relative inline-flex">
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700">
                                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                        Full
                                      </span>
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover/logistic:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                        Fulfillment (Full)
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400 capitalize">{item.logistic_type || '-'}</span>
                                  )}
                                </td>}

                                {visibleColumns.link && <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                  <button onClick={(e) => { e.stopPropagation(); window.open(item.permalink, '_blank'); }} className="text-gray-400 hover:text-origenow-purple transition-colors flex items-center justify-center w-8 h-8 rounded-full hover:bg-purple-100">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                  </button>
                                </td>}

                                {visibleColumns.transactions && <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">{item.seller_transactions || 'N/A'}</td>}

                                {visibleColumns.power_seller && <td className="px-6 py-4 whitespace-nowrap">
                                  {item.power_seller_status ? (
                                    <div className="group/status relative inline-flex">
                                      {(() => {
                                        const imgMap = {
                                          platinum: { src: '/mercadolider_platinum.png', alt: 'MercadoLíder Platinum' },
                                          gold: { src: '/mercadolider_gold.png', alt: 'MercadoLíder Gold' },
                                        };
                                        const { src, alt } = imgMap[item.power_seller_status] || { src: '/mercadolider.png', alt: 'MercadoLíder' };
                                        return <img src={src} alt={alt} className="w-8 h-8 object-contain" />;
                                      })()}

                                      {/* Tooltip */}
                                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-gray-900 text-white text-xs font-bold rounded-lg shadow-xl opacity-0 group-hover/status:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 capitalize">
                                        MercadoLíder {item.power_seller_status}
                                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900"></div>
                                      </div>
                                    </div>
                                  ) : <span className="text-gray-300">-</span>}
                                </td>}

                                {visibleColumns.level && <td className="px-6 py-4 whitespace-nowrap text-gray-500 text-xs">{item.level_id || '-'}</td>}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    {/* Table Pagination Controls */}
                    {(() => {
                      const uniqueResultsCount = uniqueTableResults.length;
                      const totalTablePages = Math.ceil(uniqueResultsCount / tableItemsPerPage);

                      if (uniqueResultsCount <= tableItemsPerPage) return <></> ;

                      return (
                        <div className="mt-8 flex justify-center gap-2">
                          <button
                            onClick={() => setTablePage(prev => Math.max(prev - 1, 1))}
                            disabled={tablePage === 1}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white hover:cursor-pointer text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:text-origenow-purple font-bold transition-colors"
                          >
                            Anterior
                          </button>
                          <span className="flex items-center px-4 font-bold text-gray-500">
                            Página {tablePage} de {totalTablePages}
                          </span>
                          <button
                            onClick={() => setTablePage(prev => Math.min(prev + 1, totalTablePages))}
                            disabled={tablePage === totalTablePages}
                            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-50 hover:text-origenow-purple font-bold transition-colors"
                          >
                            Próxima
                          </button>
                        </div>
                      );
                    })()}

                    {/* Methodology Legend */}
                    <div className="mt-8 bg-gray-50 rounded-xl p-6 border border-gray-100">
                      <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-origenow-purple" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Entenda o Método de Cálculo
                      </h3>
                      <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700 whitespace-nowrap">Individual</span>
                          <p className="text-gray-600 leading-relaxed">
                            Cálculo baseado exclusivamente nos dados deste anúncio único (data de criação vs. vendas totais). Usado quando o produto não possui variações ou outros vendedores no mesmo catálogo.
                          </p>
                        </div>
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700 whitespace-nowrap">Média de Catálogo</span>
                          <p className="text-gray-600 leading-relaxed">
                            Cálculo baseado na performance média das 3 melhores ofertas deste produto no catálogo (Buybox). Representa o potencial real de vendas do produto, não apenas de um vendedor específico.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Location Heatmap Section */}
              <LocationHeatmap results={filteredResults} />
            </>)}

            {/* ── Aba Análise de Mercado ── */}
            {activeTab === 'analise' && (
              <MarketAnalysis results={filteredResults} />
            )}

            {/* ── Aba KPIs por Termo ── */}
            {activeTab === 'kpis' && (
              <TermKPIs results={filteredResults} />
            )}

          </div>
        )
        }

        {/* Side Panel Drawer */}
        <div className={`fixed inset-y-0 right-0 w-full md:w-[600px] h-screen bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 overflow-y-auto ${selectedProduct ? 'translate-x-0' : 'translate-x-full'}`}>
          {selectedProduct && (
            <div className="flex flex-col h-full bg-gray-50">
              {/* Header */}
              <div className="bg-white p-6 border-b border-gray-100 sticky top-0 z-10">
                <div className="flex items-start justify-between mb-4">
                  <button onClick={() => setSelectedProduct(null)} className="ml-auto p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 hover:cursor-pointer rounded-full transition-colors absolute top-4 right-4 z-20 bg-white shadow-sm">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>

                <div className="flex gap-4">
                  {/* Product Image */}
                  <div className="w-24 h-24 bg-white border border-gray-100 rounded-lg p-2 flex-shrink-0">
                    {selectedProduct.thumbnail ? (
                      <img src={selectedProduct.thumbnail} alt="" className="w-full h-full object-contain mix-blend-multiply" />
                    ) : (
                      <div className="w-full h-full bg-gray-50 flex items-center justify-center text-gray-300">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="text-xs font-mono text-gray-400 mb-1">{selectedProduct.id}</div>
                    <h2 className="text-lg font-bold text-gray-900 leading-snug line-clamp-3 mb-2">{selectedProduct.title}</h2>
                    <div className="flex flex-wrap gap-2">
                      {getProductBadges(selectedProduct).map((badge) => (
                        <span key={badge.type} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${badge.color}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-8 flex-1 overflow-y-auto">

                {/* Price & Primary Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold text-gray-400 uppercase">Preço</span>
                    <div className="text-3xl font-black text-origenow-purple">R$ {selectedProduct.price?.toFixed(2)}</div>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                    <span className="text-xs font-bold text-gray-400 uppercase">Vendas Totais</span>
                    <div className="text-3xl font-black text-gray-800">{selectedProduct.sales_quantity}</div>
                  </div>
                </div>

                {/* Detailed Metrics */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">Métricas de Venda</div>
                  <div className="divide-y divide-gray-100">
                    <div className="px-6 py-3 flex justify-between items-center"><span className="text-gray-500">TTS (Tempo para Vender)</span><span className="font-bold text-gray-900">{selectedProduct.tts} h</span></div>
                    {selectedProduct.reviews && (
                      <div className="px-6 py-3 flex justify-between items-center">
                        <span className="text-gray-500">Avaliações</span>
                        <div className="flex items-center gap-1 font-bold text-gray-900">
                          <span className="text-yellow-500">★</span>
                          <span>{selectedProduct.reviews.rating || '-'}</span>
                          <span className="text-xs text-gray-400 ml-1">({selectedProduct.reviews.total || 0})</span>
                        </div>
                      </div>
                    )}
                    <div className="px-6 py-3 flex justify-between items-center">
                      <span className="text-gray-500">Estoque Estimado</span>
                      <span className="font-bold text-gray-900">{selectedProduct.quantity == null ? 'Indefinido' : selectedProduct.quantity}</span>
                    </div>
                    <div className="px-6 py-3 flex justify-between items-center"><span className="text-gray-500">Vendas (Últimos 30 dias)</span><span className="font-bold text-gray-900">{selectedProduct.vendas_30_dias}</span></div>
                    <div className="px-6 py-3 flex justify-between items-center"><span className="text-gray-500">Vendas (7 dias)</span><span className="font-bold text-gray-900">{selectedProduct.vendas_7_dias}</span></div>
                    {selectedProduct.startTime && (
                      <div className="px-6 py-3 flex justify-between items-center">
                        <span className="text-gray-500">Data de Criação</span>
                        <span className="font-bold text-gray-900">
                          {new Date(selectedProduct.startTime).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {(selectedProduct.intervalo_dias || selectedProduct.startTime) && (
                      <div className="px-6 py-3 flex justify-between items-center">
                        <span className="text-gray-500">Dias em Catálogo</span>
                        <span className="font-bold text-gray-900">
                          {selectedProduct.intervalo_dias || Math.max(1, Math.ceil((Date.now() - new Date(selectedProduct.startTime).getTime()) / (1000 * 60 * 60 * 24)))} dias
                        </span>
                      </div>
                    )}
                  </div>
                </div>



                {/* Badge Explanations Block */}
                {(() => {
                  const activeBadges = getProductBadges(selectedProduct);
                  if (activeBadges.length === 0) return <></> ;

                  const badgeExplanations = {
                    'Super Alta Demanda': 'Produto vendendo a cada 10 horas ou menos.',
                    'Boa Performance': 'Produto vendendo a cada 30 horas ou menos.',
                    'Baixa Rotatividade': 'Produto demorando mais de 30 horas para vender.',
                    'Oportunidade': 'Pouca concorrência (≤5 ofertas) e venda rápida (<3h).',
                    'Produto Arriscado': 'Preço ou velocidade varia muito (+50%) da média do catálogo.',
                    'Concorrência Alta': 'Muitos vendedores (>15) oferecendo este item.',
                    'Full': 'Produto armazenado e enviado pelo centro de distribuição do Mercado Livre (Logística Full).',
                    '1P': 'Vendido diretamente pelo Mercado Livre (Loja Oficial).',
                    'Power Seller': 'Vendedor reconhecido como MercadoLíder.'
                  };

                  return (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700 flex items-center gap-2">
                        <span className="text-xl">🏷️</span> Entenda as Badges
                      </div>
                      <div className="divide-y divide-gray-100">
                        {activeBadges.map((badge) => {
                          const explanation = badgeExplanations[badge.label] || Object.keys(badgeExplanations).find(k => badge.label.includes(k) && badgeExplanations[k]) || 'Indicador de performance do produto.';
                          return (
                            <div key={badge.type} className="p-4 flex gap-4 items-start">
                              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${badge.color}`}>
                                {badge.icon}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900 text-sm">{badge.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5">{explanation}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* Seller Info */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">Informações do Vendedor</div>
                  <div className="p-6">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center font-bold text-gray-500 text-lg uppercase">{selectedProduct.nickname?.substring(0, 2) || 'NA'}</div>
                      <div>
                        <div className="font-bold text-gray-900">{selectedProduct.nickname || 'Desconhecido'}</div>
                        <div className="text-sm text-gray-500">{selectedProduct.city} - {selectedProduct.state}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div><span className="block text-gray-400 text-xs">Reputação</span><span className="font-bold text-gray-800">{selectedProduct.reputation_level || '-'}</span></div>
                      <div><span className="block text-gray-400 text-xs">Power Seller</span><span className="font-bold text-gray-800 capitalize">{selectedProduct.power_seller_status?.replaceAll('_', ' ') || '-'}</span></div>
                    </div>
                  </div>
                </div>

                {/* Logistics */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-3 bg-gray-50 border-b border-gray-100 font-bold text-gray-700">Logística</div>
                  <div className="divide-y divide-gray-100 px-6 py-4">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-500">Frete Grátis</span>
                      {selectedProduct.free_shipping ? (
                        <span className="font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded text-xs">Sim</span>
                      ) : (
                        <span className="font-bold text-gray-500">Não</span>
                      )}
                    </div>
                    <div className="flex justify-between py-2"><span className="text-gray-500">Custo de Envio (Est.)</span><span className="font-bold text-gray-900">{selectedProduct.shipping_cost && selectedProduct.shipping_cost !== 999 ? `R$ ${selectedProduct.shipping_cost.toFixed(2)}` : 'A calcular'}</span></div>
                    <div className="flex justify-between py-2"><span className="text-gray-500">Modo de Envio</span><span className="font-bold text-gray-900 capitalize">{selectedProduct.shipping_mode || '-'}</span></div>
                    <div className="flex justify-between py-2"><span className="text-gray-500">Tipo Logístico</span><span className="font-bold text-gray-900 capitalize">{selectedProduct.logistic_type || '-'}</span></div>
                  </div>
                </div>

              </div>

              {/* Footer Actions */}
              <div className="p-6 bg-white border-t border-gray-100 sticky bottom-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                <a
                  href={selectedProduct.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative block w-full py-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white font-bold rounded-full shadow-lg shadow-violet-500/30 hover:shadow-violet-600/40 hover:-translate-y-1 transition-all duration-300 text-lg flex items-center justify-center gap-3 overflow-hidden visited:text-white"
                >
                  <span className="relative z-10">Ver Anúncio no Mercado Livre</span>
                  <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 ease-in-out skew-x-12"></div>
                </a>
              </div>
            </div>
          )}
        </div>
        {/* Overlay */}
        {
          selectedProduct && (
            <button
              type="button"
              aria-label="Fechar detalhes do produto"
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity border-none w-full h-full cursor-default outline-none"
              onClick={() => setSelectedProduct(null)}
            />
          )
        }
      </div>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 w-full text-center py-4 text-gray-500 text-sm border-t border-purple-100/50 bg-white/80 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-[1200px] mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
          <p>&copy; {new Date().getFullYear()} <span className="font-bold text-gray-700">OrigeNow</span> Analytics.</p>
          <div className="flex items-center gap-2">
            <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">&copy; Direitos reservados Origenow</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal - Specific Portal Location */}
      <CookieUpdaterModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onUpdate={handleUpdateCookie}
      />

      {/* Export Excel Configuration Modal */}
      {showExportModal && (
        <>
          <button
            type="button"
            aria-label="Fechar modal de exportação"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] transition-opacity border-none w-full h-full cursor-default outline-none"
            onClick={() => setShowExportModal(false)}
          />
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4">
            <div
              className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-lg animate-fade-in-up overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-gradient-to-r from-green-50 to-emerald-50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Exportar para Excel</h3>
                    <p className="text-xs text-gray-500">Configure quais dados exportar</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
                {/* Row Limit */}
                <div>
                  <label htmlFor="export-row-limit" className="block text-sm font-bold text-gray-700 mb-2">Quantidade de linhas</label>
                  <div className="flex items-center gap-3">
                    <input
                      id="export-row-limit"
                      type="number"
                      min={1}
                      max={sortedResults.length}
                      value={exportRowLimit}
                      onChange={(e) => setExportRowLimit(e.target.value)}
                      placeholder={`Todas (${sortedResults.length} disponíveis)`}
                      className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 bg-gray-50 focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all placeholder-gray-400"
                    />
                    <span className="text-xs text-gray-400 whitespace-nowrap">de {sortedResults.length}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">Deixe vazio para exportar todas as linhas.</p>
                </div>

                {/* Include Search Term Option — only visible with multiple terms */}
                {uniqueSearchTerms.length > 1 && (
                  <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-100 rounded-xl">
                    <input
                      id="export-search-term-toggle"
                      type="checkbox"
                      checked={exportSearchTerm}
                      onChange={() => setExportSearchTerm(prev => !prev)}
                      className="mt-0.5 w-4 h-4 rounded text-origenow-purple focus:ring-origenow-purple border-gray-300 cursor-pointer"
                    />
                    <label htmlFor="export-search-term-toggle" className="cursor-pointer">
                      <span className="block text-sm font-bold text-gray-800">Incluir termo de busca</span>
                      <span className="text-xs text-gray-500">Adiciona uma coluna "Termo de Busca" no final da planilha, indicando qual termo gerou cada produto.</span>
                    </label>
                  </div>
                )}

                {/* Column Selection */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold text-gray-700">Colunas para exportar</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setExportColumns(Object.fromEntries(allExportColumns.map(c => [c.k, true])))}
                        className="text-xs text-purple-600 hover:text-purple-800 font-medium hover:underline cursor-pointer"
                      >
                        Selecionar todas
                      </button>
                      <span className="text-gray-300">|</span>
                      <button
                        onClick={() => setExportColumns(Object.fromEntries(allExportColumns.map(c => [c.k, false])))}
                        className="text-xs text-gray-500 hover:text-gray-700 font-medium hover:underline cursor-pointer"
                      >
                        Desmarcar todas
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {allExportColumns.map(({ k, l }) => (
                      <label
                        key={k}
                        htmlFor={`exp-col-${k}`}
                        className="flex items-center gap-3 text-sm text-gray-600 cursor-pointer hover:bg-purple-50 p-2.5 rounded-lg transition-colors select-none"
                      >
                        <input
                          id={`exp-col-${k}`}
                          type="checkbox"
                          checked={!!exportColumns[k]}
                          onChange={() => setExportColumns(prev => ({ ...prev, [k]: !prev[k] }))}
                          className="w-4 h-4 rounded text-green-500 focus:ring-green-500 border-gray-300 cursor-pointer"
                        />
                        <span className="font-medium">{l}</span>
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {Object.values(exportColumns).filter(Boolean).length} de {allExportColumns.length} colunas selecionadas
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-800 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={exportToExcel}
                  disabled={Object.values(exportColumns).filter(Boolean).length === 0}
                  className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 rounded-xl shadow-md shadow-green-500/20 hover:shadow-lg hover:shadow-green-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Exportar {exportLabel}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Advanced Analysis Modal */}
      {showAdvancedModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 backdrop-blur-sm animate-fade-in px-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border border-white/20 relative">
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-100 rounded-full blur-3xl -mr-32 -mt-32 opacity-50"></div>

            <div className="p-8 relative z-10 text-center flex flex-col items-center">
              <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6 shadow-inner border border-purple-200">
                <svg className="w-8 h-8 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>

              <h2 className="text-2xl font-black text-gray-900 mb-3 tracking-tight">Ativar Análise Avançada?</h2>

              <p className="text-gray-500 mb-8 max-w-sm font-medium">
                Desbloqueie <span className="font-bold text-gray-800">Análise de Mercado</span> e <span className="font-bold text-gray-800">Estatísticas</span> para visualizar os dados de forma aprofundada.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 w-full">
                <button
                  onClick={() => setShowAdvancedModal(false)}
                  className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setIsAdvancedAnalysisActive(true);
                    setShowAdvancedModal(false);
                  }}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-200/50 hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  Ativar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div >
  );
}

export default App;
