import { useEffect, useRef, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import XLSX from 'xlsx-js-style';
import {
  Chart,
  BubbleController, ScatterController, BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler
} from 'chart.js';

Chart.register(
  BubbleController, ScatterController, BarController, LineController, DoughnutController,
  CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, BarElement, ArcElement,
  Tooltip, Legend, Filler
);

// ─── helpers ────────────────────────────────────────────────────────────────

const safeFloat = (v) => {
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};

const isFull = (item) =>
  item.is_fulfillment === true || item.logistic_type === 'fulfillment';

const scoreItem = (item) => {
  const tts = safeFloat(item.tts);
  const sales = Number.parseInt(item.sales_quantity) || 0;
  if (tts === null) return 0;
  let s = 0;
  if (tts <= 10) s += 50;
  else if (tts <= 30) s += 30;
  else if (tts <= 72) s += 10;
  if (sales > 1000) s += 30;
  else if (sales > 500) s += 20;
  else if (sales > 100) s += 10;
  if (isFull(item)) s += 10;
  if ((item.offers?.length || 0) <= 5) s += 10;
  return s;
};

const COLORS = {
  hot: 'rgba(99,153,34,0.82)',
  warn: 'rgba(186,117,23,0.82)',
  cold: 'rgba(226,75,74,0.82)',
  blue: 'rgba(55,138,221,0.72)',
  purple: 'rgba(124,58,237,0.75)',
};

const tc = '#9ca3af'; // gray-400
const gc = 'rgba(0,0,0,0.05)';

const getScoreColor = (score) => {
  if (score >= 60) return COLORS.hot;
  if (score >= 30) return COLORS.warn;
  return COLORS.cold;
};

const getHhiColor = (pct) => {
  if (pct < 25) return '#639922';
  if (pct < 60) return '#BA7517';
  return '#E24B4A';
};

const getHhiLabel = (pct) => {
  if (pct < 25) return 'Disperso';
  if (pct < 60) return 'Moderado';
  return 'Concentrado';
};

const getSellerShareClass = (i) => {
  if (i === 0) return 'bg-red-100 text-red-600';
  if (i < 3) return 'bg-amber-100 text-amber-600';
  return 'bg-green-50 text-green-600';
};

const getBarrierColor = (pct) => {
  if (pct >= 60) return '#E24B4A';
  if (pct >= 30) return '#BA7517';
  return '#639922';
};

const getBarrierLabel = (pct) => {
  if (pct >= 60) return 'alta';
  if (pct >= 30) return 'moderada';
  return 'baixa';
};

const getTtsCurveColor = (v) => {
  if (v < 10) return '#639922';
  if (v < 30) return '#BA7517';
  return '#E24B4A';
};

const CHART_DEFAULTS = {
  responsive: true,
  maintainAspectRatio: false,
  animation: { duration: 600 },
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
    y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
  },
};

// ─── hook: create / destroy chart ───────────────────────────────────────────

function useChart(ref, buildFn, deps) {
  useEffect(() => {
    if (!ref.current) return;
    const ctx = ref.current.getContext('2d');
    const { type, data, options, plugins } = buildFn();
    const chart = new Chart(ctx, { type, data, options, plugins });
    return () => chart.destroy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// ─── section wrapper ────────────────────────────────────────────────────────

function Card({ title, sub, children, wide, action }) {
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-6 ${wide ? 'col-span-2' : ''}`}>
      <div className="flex justify-between items-start mb-0.5">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
        {action}
      </div>
      {sub && <p className="text-xs text-gray-400 mb-4 leading-relaxed">{sub}</p>}
      {!sub && <div className="mb-4" />}
      {children}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 1. MATRIZ QUADRANTE — TTS × Vendas
// ════════════════════════════════════════════════════════════════════════════
function QuadrantChart({ results }) {
  const ref = useRef(null);

  const data = useMemo(() => results.map(item => {
    const tts = safeFloat(item.tts);
    const sales = Number.parseInt(item.sales_quantity) || 0;
    const price = Number.parseFloat(item.price) || 10;
    const score = scoreItem(item);
    const color = getScoreColor(score);
    const r = Math.max(4, Math.min(18, Math.sqrt(price) * 1.2));
    return { x: tts, y: sales, r, color, label: item.title?.slice(0, 28) || item.id };
  }).filter(d => d.x !== null && d.y > 0), [results]);

  const medians = useMemo(() => {
    if (!data.length) return { x: 0, y: 0 };
    const xs = [...data].map(d => d.x).sort((a,b) => a-b);
    const ys = [...data].map(d => d.y).sort((a,b) => a-b);
    const mid = Math.floor(data.length / 2);
    const medianX = data.length % 2 === 0 ? (xs[mid-1] + xs[mid]) / 2 : xs[mid];
    const medianY = data.length % 2 === 0 ? (ys[mid-1] + ys[mid]) / 2 : ys[mid];
    return { x: medianX, y: medianY };
  }, [data]);

  const medianPlugin = useMemo(() => ({
    id: 'medianLines',
    beforeDraw(chart) {
      const { ctx, chartArea: { top, bottom, left, right }, scales: { x, y } } = chart;
      if (!medians.x || !medians.y) return;
      ctx.save();
      ctx.beginPath();
      // Line: Median TTS (Vertical)
      const xPos = x.getPixelForValue(medians.x);
      ctx.moveTo(xPos, top);
      ctx.lineTo(xPos, bottom);
      // Line: Median Sales (Horizontal)
      const yPos = y.getPixelForValue(medians.y);
      ctx.moveTo(left, yPos);
      ctx.lineTo(right, yPos);
      
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(156, 163, 175, 0.8)'; // gray-400
      ctx.setLineDash([4, 4]);
      ctx.stroke();

      // Labels
      ctx.fillStyle = 'rgba(107, 114, 128, 1)'; // gray-500
      ctx.font = '10px sans-serif';
      ctx.fillText(`Mediana TTS: ${medians.x.toFixed(1)}h`, xPos + 6, top + 12);
      ctx.fillText(`Mediana Vendas: ${Math.round(medians.y)}`, right - 110, yPos - 6);
      
      ctx.restore();
    }
  }), [medians]);

  useChart(ref, () => ({
    type: 'bubble',
    data: {
      datasets: [{
        data: data.map(d => ({ x: d.x, y: d.y, r: d.r })),
        backgroundColor: data.map(d => d.color),
        borderWidth: 0,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => {
              const d = data[ctx.dataIndex];
              return d ? `${d.label} | TTS: ${d.x}h | Vendas: ${d.y.toLocaleString('pt-BR')}` : '';
            },
          },
        },
      },
      scales: {
        x: {
          type: 'logarithmic', min: 0.05, max: 500,
          title: { display: true, text: 'TTS (h) — escala log', color: tc, font: { size: 10 } },
          grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => v + 'h' },
        },
        y: {
          title: { display: true, text: 'Vendas totais', color: tc, font: { size: 10 } },
          grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v },
        },
      },
    },
    plugins: [medianPlugin],
  }), [data, medianPlugin]);

  return (
    <Card
      title="Matriz de decisão — TTS × Volume de vendas"
      sub="Cada ponto é um produto. Superior esq. = nicho rápido. Superior dir. = oportunidade de ouro. Tamanho = preço."
      wide
    >
      <div className="relative" style={{ height: 280 }}>
        {/* Quadrant labels */}
        <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 z-10 pointer-events-none">Nicho rápido</span>
        <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 z-10 pointer-events-none">Oportunidade</span>
        <span className="absolute bottom-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded bg-red-50 text-red-700 z-10 pointer-events-none">Evitar</span>
        <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-700 z-10 pointer-events-none">Volume, mas lento</span>
        <canvas ref={ref} />
      </div>
      <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.hot }} />Score alto</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.warn }} />Cautela</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: COLORS.cold }} />Evitar</span>
        <span className="text-gray-400">· Tamanho da bolha = preço</span>
        <span className="text-gray-400">· Linhas = Medianas</span>
      </div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 2. HISTOGRAMA DE TTS
// ════════════════════════════════════════════════════════════════════════════
function TtsHistogram({ results }) {
  const ref = useRef(null);

  const buckets = useMemo(() => {
    const b = [0, 0, 0, 0, 0, 0, 0];
    results.forEach(item => {
      const t = safeFloat(item.tts);
      if (t === null) return;
      if (t < 1) b[0]++;
      else if (t < 5) b[1]++;
      else if (t < 24) b[2]++;
      else if (t < 72) b[3]++;
      else if (t < 168) b[4]++;
      else if (t < 720) b[5]++;
      else b[6]++;
    });
    return b;
  }, [results]);

  useChart(ref, () => ({
    type: 'bar',
    data: {
      labels: ['<1h', '1–5h', '5–24h', '1–3d', '3–7d', '7–30d', '>30d'],
      datasets: [{
        data: buckets,
        backgroundColor: [
          'rgba(99,153,34,0.85)', 'rgba(99,153,34,0.7)', 'rgba(99,153,34,0.55)',
          'rgba(186,117,23,0.7)', 'rgba(186,117,23,0.55)',
          'rgba(226,75,74,0.6)', 'rgba(226,75,74,0.85)',
        ],
        borderRadius: 4, borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw} produtos` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } },
        y: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 } }, title: { display: true, text: 'Qtd produtos', color: tc, font: { size: 10 } } },
      },
    },
  }), [buckets]);

  return (
    <Card title="Distribuição de TTS" sub="Quantos produtos vendem em cada faixa de tempo. Mostra se o mercado é rápido ou travado.">
      <div style={{ height: 200 }}><canvas ref={ref} /></div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 3. DISPERSÃO PREÇO × TTS
// ════════════════════════════════════════════════════════════════════════════
function PriceVsTts({ results }) {
  const ref = useRef(null);

  const pts = useMemo(() =>
    results.map(item => ({ x: Number.parseFloat(item.price) || 0, y: safeFloat(item.tts) }))
      .filter(p => p.x > 0 && p.y !== null),
    [results]);

  useChart(ref, () => ({
    type: 'scatter',
    data: {
      datasets: [{
        data: pts,
        backgroundColor: COLORS.blue,
        pointRadius: 4, pointHoverRadius: 6,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => `R$ ${ctx.raw.x.toFixed(2)} — ${ctx.raw.y}h` } },
      },
      scales: {
        x: { title: { display: true, text: 'Preço (R$)', color: tc, font: { size: 10 } }, grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
        y: { title: { display: true, text: 'TTS (h)', color: tc, font: { size: 10 } }, grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
      },
    },
  }), [pts]);

  return (
    <Card title="Preço × TTS" sub="Produtos caros vendem mais devagar? Ou há outliers valiosos? Ajuda a precificar melhor.">
      <div style={{ height: 200 }}><canvas ref={ref} /></div>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 4. CONCENTRAÇÃO DE MERCADO (TOP 10 vendedores)
// ════════════════════════════════════════════════════════════════════════════
function MarketConcentration({ results }) {
  const [showModal, setShowModal] = useState(false);
  const [exportLimit, setExportLimit] = useState(10);
  const [showExportOptions, setShowExportOptions] = useState(false);
  const ref = useRef(null);

  const { labels, shares, hhi, fullRanking } = useMemo(() => {
    const totals = {};
    const sellerStates = {};
    const sellerCounts = {};
    let grandTotal = 0;

    results.forEach(item => {
      const seller = item.nickname || 'Desconhecido';
      const qty = Number.parseInt(item.sales_quantity) || 0;
      totals[seller] = (totals[seller] || 0) + qty;
      sellerCounts[seller] = (sellerCounts[seller] || 0) + 1;
      grandTotal += qty;

      if (!sellerStates[seller] && item.state) {
        sellerStates[seller] = item.state;
      }
    });

    if (grandTotal === 0) return { labels: [], shares: [], hhi: 0, fullRanking: [], grandTotal: 0 };

    const sorted = Object.entries(totals).sort(([, a], [, b]) => b - a);

    const fullRankingData = sorted.map(([name, v]) => ({
      name,
      sales: v,
      count: sellerCounts[name] || 0,
      state: sellerStates[name] || '--',
      share: Number.parseFloat(((v / grandTotal) * 100).toFixed(1))
    }));

    const top10Items = sorted.slice(0, 9);
    const othersTotal = sorted.slice(9).reduce((s, [, v]) => s + v, 0);
    if (othersTotal > 0) top10Items.push(['Outros', othersTotal]);

    const sharesPct = top10Items.map(([, v]) => Number.parseFloat(((v / grandTotal) * 100).toFixed(1)));
    const hhiValue = sharesPct.reduce((s, p) => s + (p / 100) ** 2, 0) * 10000;

    return { 
      labels: top10Items.map(([n]) => n), 
      shares: sharesPct, 
      hhi: hhiValue, 
      fullRanking: fullRankingData, 
      grandTotal 
    };
  }, [results]);

  const exportSellersToExcel = () => {
    const limit = Number(exportLimit) || fullRanking.length;
    const dataToExport = fullRanking.slice(0, limit);

    const headers = ["POSIÇÃO", "VENDEDOR", "ANÚNCIOS", "ESTADO", "VOLUME DE VENDAS", "SHARE (%)"];
    const rows = dataToExport.map((s, i) => [
      i + 1,
      s.name,
      s.count,
      s.state,
      s.sales,
      s.share
    ]);

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    const headerStyle = {
      font: { bold: true, color: { rgb: "000000" } },
      fill: { fgColor: { rgb: "EFEFEF" } },
      border: {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      }
    };

    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (ws[address]) ws[address].s = headerStyle;
    }

    ws['!cols'] = [
      { wch: 10 }, { wch: 30 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 12 }
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Ranking Vendedores");
    XLSX.writeFile(wb, `ranking_vendedores_${new Date().toISOString().slice(0, 10)}.xlsx`);
    setShowExportOptions(false);
  };

  useChart(ref, () => ({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: shares,
        backgroundColor: shares.map((p, i) => {
          if (i === 0) return 'rgba(226,75,74,0.85)';
          if (i <= 2) return 'rgba(186,117,23,0.75)';
          if (i <= 5) return 'rgba(99,153,34,0.7)';
          return 'rgba(136,135,128,0.5)';
        }),
        borderRadius: 4, borderSkipped: false,
      }],
    },
    options: {
      ...CHART_DEFAULTS,
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.raw}% das vendas` } },
      },
      scales: {
        x: { grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, callback: v => v + '%' } },
        y: { grid: { display: false }, ticks: { color: tc, font: { size: 10 } } },
      },
    },
  }), [labels, shares]);

  const hhiPct = Math.min(100, Math.round((hhi / 10000) * 100));
  const hhiColor = getHhiColor(hhiPct);
  const hhiLabel = getHhiLabel(hhiPct);

  return (
    <Card
      title="Concentração de mercado por vendedor (top 10)"
      sub="Se um vendedor domina >40% das vendas, entrar nesse mercado é arriscado."
      wide
      action={
        <button
          onClick={() => setShowModal(true)}
          className="text-[10px] font-bold text-purple-600 hover:text-purple-800 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 rounded transition-colors uppercase tracking-tight cursor-pointer"
        >
          Ver vendedores
        </button>
      }
    >
      <div style={{ height: 200 }}><canvas ref={ref} /></div>
      <div className="mt-4 p-3 bg-gray-50 rounded-xl flex items-center gap-4">
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-2">Índice de concentração (HHI)</p>
          <div className="h-4 rounded-full relative" style={{ background: 'linear-gradient(to right,#639922,#BA7517,#E24B4A)' }}>
            <div className="absolute top-1/2 -translate-y-1/2 w-0.5 h-6 bg-gray-900 rounded" style={{ left: `${hhiPct}%`, transform: 'translateX(-50%) translateY(-50%)' }} />
          </div>
          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>Disperso</span><span>Moderado</span><span>Concentrado</span>
          </div>
        </div>
        <div className="text-center flex-shrink-0">
          <div className="text-2xl font-black" style={{ color: hhiColor }}>{hhiPct}%</div>
          <div className="text-[10px] text-gray-400">{hhiLabel}</div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm border-none"
            aria-label="Fechar"
            onClick={() => setShowModal(false)}
          />
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 w-full max-w-2xl max-h-[85vh] flex flex-col relative z-50 overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50/50">
              <div>
                <h3 className="font-bold text-gray-900">Ranking Completo de Vendedores</h3>
                <p className="text-xs text-gray-500">Listagem de todos os {fullRanking.length} vendedores identificados</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <button
                    onClick={() => setShowExportOptions(!showExportOptions)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 border border-green-100 rounded-lg text-xs font-bold hover:bg-green-100 transition-all cursor-pointer shadow-sm"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Exportar
                  </button>
                  {showExportOptions && (
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 p-4 z-[110] animate-fade-in-up">
                      <p className="text-[10px] font-bold text-gray-400 uppercase mb-3">Linhas para exportar</p>
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="number"
                          value={exportLimit}
                          onChange={(e) => setExportLimit(e.target.value)}
                          className="w-full px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg text-xs outline-none focus:border-green-300 transition-all"
                          placeholder="Qtd (Ex: 10)"
                          min="1"
                        />
                      </div>
                      <button
                        onClick={exportSellersToExcel}
                        className="w-full py-2 bg-green-600 text-white rounded-lg text-xs font-bold hover:bg-green-700 transition-all shadow-md shadow-green-100 cursor-pointer"
                      >
                        Baixar Excel
                      </button>
                    </div>
                  )}
                </div>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-white rounded-full transition-all cursor-pointer">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-0 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr className="bg-gray-50">
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">#</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Vendedor</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Anúncios</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Estado</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Volume</th>
                    <th className="px-6 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">M. Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fullRanking.map((s, i) => (
                    <tr key={s.name} className="hover:bg-purple-50/40 transition-colors group cursor-pointer">
                      <td className="px-6 py-4 text-[10px] text-gray-400 font-mono text-center shrink-0">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase border border-white group-hover:border-purple-200 transition-colors shrink-0">
                            {s.name.substring(0, 2)}
                          </div>
                          <span className="text-sm font-bold text-gray-800 uppercase tracking-tight truncate max-w-[140px] md:max-w-[200px]" title={s.name}>{s.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                          {s.count}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-[10px] font-black text-gray-400 bg-gray-50 px-2 py-1 rounded border border-gray-100 uppercase font-mono">
                          {s.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 text-right font-mono font-medium">{s.sales.toLocaleString('pt-BR')}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black tracking-widest ${getSellerShareClass(i)}`}>
                          {s.share.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
              <button onClick={() => setShowModal(false)} className="px-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:text-purple-600 hover:border-purple-200 hover:shadow-lg transition-all active:scale-95 cursor-pointer">
                Fechar Listagem
              </button>
            </div>
          </div>
        </div>
      )}
    </Card>

    );
  }

// ════════════════════════════════════════════════════════════════════════════
// 5. FUNIL DE QUALIDADE
// ════════════════════════════════════════════════════════════════════════════
function QualityFunnel({ results }) {
      const steps = useMemo(() => {
        const total = results.length;
        const withFull = results.filter(isFull).length;
        const ttsOk = results.filter(r => { const t = safeFloat(r.tts); return t !== null && t < 72; }).length;
        const highSales = results.filter(r => (Number.parseInt(r.sales_quantity) || 0) > 500).length;
        const highScore = results.filter(r => scoreItem(r) >= 60).length;
        return [
          { label: 'Total analisados', count: total, pct: 100, bg: '#e6f1fb', fg: '#185fa5' },
          { label: 'Com Full logística', count: withFull, pct: total ? (withFull / total) * 100 : 0, bg: '#b5d4f4', fg: '#185fa5' },
          { label: 'TTS < 72h', count: ttsOk, pct: total ? (ttsOk / total) * 100 : 0, bg: '#eaf3de', fg: '#3b6d11' },
          { label: 'Vendas > 500', count: highSales, pct: total ? (highSales / total) * 100 : 0, bg: '#c0dd97', fg: '#3b6d11' },
          { label: 'Score alto (≥60)', count: highScore, pct: total ? (highScore / total) * 100 : 0, bg: '#639922', fg: '#fff' },
        ];
      }, [results]);

      return (
        <Card title="Funil de qualidade dos anúncios" sub={`Dos ${results.length} anúncios, quantos realmente valem atenção.`}>
          <div className="space-y-2 mt-1">
            {steps.map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className="flex-1 bg-gray-100 rounded overflow-hidden relative" style={{ height: 32 }}>
                  {/* Progress Bar Layer */}
                  <div
                    className="h-full rounded transition-all duration-700 ease-out absolute top-0 left-0"
                    style={{ width: `${s.pct}%`, background: s.bg }}
                  />
                  {/* Label Layer */}
                  <div
                    className={`h-full flex items-center px-3 text-xs font-bold relative z-10 whitespace-nowrap transition-colors duration-500 ${s.pct > 40 ? '' : 'text-gray-700'}`}
                    style={{ color: s.pct > 40 ? s.fg : undefined }}
                  >
                    {s.label}
                  </div>
                </div>
                <span className="text-xs font-bold text-gray-700 w-8 text-right shrink-0">{s.count}</span>
              </div>
            ))}
          </div>
        </Card>
      );
    }

// ════════════════════════════════════════════════════════════════════════════
// 6. DISTRIBUIÇÃO DE PREÇO (faixas dinâmicas)
// ════════════════════════════════════════════════════════════════════════════
function PriceDistribution({ results }) {
      const { bands, hotBand } = useMemo(() => {
        const prices = results.map(r => Number.parseFloat(r.price)).filter(p => !Number.isNaN(p) && p > 0);
        if (prices.length === 0) return { bands: [], hotBand: null };

        const min = Math.floor(Math.min(...prices));
        const max = Math.ceil(Math.max(...prices));
        const range = max - min;

        // Build 5 dynamic bands
        const step = range / 5 || 1;
        const rawBands = Array.from({ length: 5 }, (_, i) => ({
          lo: min + i * step,
          hi: min + (i + 1) * step,
        }));

        const bands = rawBands.map(({ lo, hi }) => {
          const count = prices.filter(p => p >= lo && (p < hi || (hi === max && p <= hi))).length;
          const pct = prices.length ? Math.round((count / prices.length) * 100) : 0;
          return {
            label: `R$ ${lo < 1000 ? Math.round(lo) : (lo / 1000).toFixed(1) + 'k'}–${hi < 1000 ? Math.round(hi) : (hi / 1000).toFixed(1) + 'k'}`,
            pct, count,
          };
        });

        const hotBand = bands.reduce((a, b) => (b.pct > a.pct ? b : a), bands[0]);
        return { bands, hotBand };
      }, [results]);

      const bgColors = ['#b5d4f4', '#378add', '#185fa5', '#0c447c', '#042c53'];
      const fgColors = ['#185fa5', '#fff', '#fff', '#fff', '#fff'];

      return (
        <Card title="Faixas de preço dos concorrentes" sub="Onde está o grosso dos anúncios. Útil para saber em qual faixa entrar.">
          <div className="space-y-2 mt-1">
            {bands.map((b, i) => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-24 text-right flex-shrink-0">{b.label}</span>
                <div className="flex-1 bg-gray-100 rounded overflow-hidden" style={{ height: 20 }}>
                  <div
                    className="h-full rounded flex items-center justify-end pr-2 text-[10px] font-bold transition-all duration-500"
                    style={{ width: `${Math.max(b.pct, 4)}%`, background: bgColors[i], color: fgColors[i] }}
                  >
                    {b.pct}%
                  </div>
                </div>
              </div>
            ))}
          </div>
          {hotBand && (
            <p className="text-xs text-gray-500 mt-3">
              Zona mais competitiva: <strong className="text-gray-800">{hotBand.label}</strong> ({hotBand.pct}% dos anúncios)
            </p>
          )}
        </Card>
      );
    }

// ════════════════════════════════════════════════════════════════════════════
// 7. SAÚDE DOS VENDEDORES (doughnut)
// ════════════════════════════════════════════════════════════════════════════
function SellerHealth({ results }) {
      const ref = useRef(null);

      const { labels, counts, totalSellers, strongPct } = useMemo(() => {
        const bins = { platinum: 0, gold: 0, mercadolider: 0, bom: 0, medio: 0, novo: 0 };
        results.forEach(item => {
          const ps = (item.power_seller_status || '').toLowerCase();
          const lvl = (item.reputation_level || item.level_id || '').toLowerCase();
          if (ps === 'platinum') bins.platinum++;
          else if (ps === 'gold') bins.gold++;
          else if (ps) bins.mercadolider++;
          else if (lvl.includes('5') || lvl.includes('platinum')) bins.bom++;
          else if (lvl.includes('4') || lvl.includes('gold')) bins.medio++;
          else bins.novo++;
        });

        const entries = [
          ['MercadoLíder Platinum', bins.platinum, '#185fa5'],
          ['MercadoLíder Gold', bins.gold, '#378add'],
          ['MercadoLíder', bins.mercadolider, '#85b7eb'],
          ['Bom', bins.bom, '#639922'],
          ['Médio', bins.medio, '#BA7517'],
          ['Novo/Desconhecido', bins.novo, '#888780'],
        ].filter(([, c]) => c > 0);

        const totalSellers = entries.reduce((s, [, c]) => s + c, 0);
        const strong = bins.platinum + bins.gold + bins.mercadolider;
        const strongPct = totalSellers ? Math.round((strong / totalSellers) * 100) : 0;

        return { labels: entries.map(e => e[0]), counts: entries.map(e => e[1]), colors: entries.map(e => e[2]), totalSellers, strongPct };
      }, [results]);

      useChart(ref, () => ({
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: counts,
            backgroundColor: ['#185fa5', '#378add', '#85b7eb', '#639922', '#BA7517', '#888780'].slice(0, labels.length),
            borderWidth: 2, borderColor: '#fff',
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, cutout: '62%',
          plugins: {
            legend: { position: 'right', labels: { color: tc, font: { size: 10 }, boxWidth: 10, padding: 8 } },
            tooltip: { callbacks: { label: ctx => ` ${ctx.raw} vendedores` } },
          },
        },
      }), [labels, counts]);

      const barrierColor = getBarrierColor(strongPct);
      const barrierLabel = getBarrierLabel(strongPct);

      return (
        <Card
          title="Perfil de saúde dos vendedores concorrentes"
          sub={`${totalSellers} vendedores ativos. Mercado com muitos MercadoLíder = difícil de entrar.`}
          wide
        >
          <div style={{ height: 200 }}><canvas ref={ref} /></div>
          <div className="mt-3 p-3 bg-gray-50 rounded-xl text-xs text-gray-500">
            <strong className="text-gray-800">Leitura rápida: </strong>
            {strongPct}% dos vendedores são MercadoLíder ou superior — barreira de entrada{' '}
            <span className="font-semibold" style={{ color: barrierColor }}>{barrierLabel}</span>.
          </div>
        </Card>
      );
    }

// ════════════════════════════════════════════════════════════════════════════
// 8. CURVA TTS POR RANKING
// ════════════════════════════════════════════════════════════════════════════
function TtsRankCurve({ results }) {
      const ref = useRef(null);

      const { ranks, ttsCurve } = useMemo(() => {
        const sorted = [...results]
          .map(r => safeFloat(r.tts))
          .filter(t => t !== null)
          .sort((a, b) => a - b)
          .slice(0, 30);
        return {
          ranks: sorted.map((_, i) => `#${i + 1}`),
          ttsCurve: sorted,
        };
      }, [results]);

      useChart(ref, () => ({
        type: 'line',
        data: {
          labels: ranks,
          datasets: [{
            label: 'TTS',
            data: ttsCurve,
            borderColor: '#7c3aed',
            borderWidth: 2,
            backgroundColor: 'rgba(124,58,237,0.08)',
            fill: true,
            pointBackgroundColor: ttsCurve.map(getTtsCurveColor),
            pointRadius: 3,
            tension: 0.35,
          }],
        },
        options: {
          ...CHART_DEFAULTS,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: ctx => ` ${ctx.raw}h por venda` } },
          },
          scales: {
            x: { title: { display: true, text: 'Posição no ranking', color: tc, font: { size: 10 } }, grid: { color: gc }, ticks: { color: tc, font: { size: 10 }, maxTicksLimit: 10 } },
            y: { title: { display: true, text: 'TTS (horas)', color: tc, font: { size: 10 } }, grid: { color: gc }, ticks: { color: tc, font: { size: 10 } } },
          },
        },
      }), [ranks, ttsCurve]);

      return (
        <Card
          title="Curva de TTS pelo ranking de posição"
          sub='Como o TTS cresce conforme você desce no ranking. O "joelho da curva" indica onde os produtos ficam lentos demais.'
          wide
        >
          <div style={{ height: 200 }}><canvas ref={ref} /></div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#639922]" />TTS &lt; 10h</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#BA7517]" />10–30h</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#E24B4A]" />&gt; 30h</span>
          </div>
        </Card>
      );
    }

// ════════════════════════════════════════════════════════════════════════════
// ROOT EXPORT
// ════════════════════════════════════════════════════════════════════════════
function MarketAnalysis({ results }) {
    if (!results || results.length === 0) {
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

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuadrantChart results={results} />
        <TtsHistogram results={results} />
        <PriceVsTts results={results} />
        <MarketConcentration results={results} />
        <QualityFunnel results={results} />
        <PriceDistribution results={results} />
        <SellerHealth results={results} />
        <TtsRankCurve results={results} />
      </div>
    );
}

Card.propTypes = {
  title: PropTypes.string.isRequired,
  sub: PropTypes.string,
  children: PropTypes.node,
  wide: PropTypes.bool,
  action: PropTypes.node,
};

QuadrantChart.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
TtsHistogram.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
PriceVsTts.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
MarketConcentration.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
QualityFunnel.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
PriceDistribution.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
SellerHealth.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };
TtsRankCurve.propTypes = { results: PropTypes.arrayOf(PropTypes.object).isRequired };

MarketAnalysis.propTypes = {
    results: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default MarketAnalysis;
