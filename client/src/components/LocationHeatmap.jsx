import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { BRAZIL_STATES } from './BrazilMapData';



function LocationHeatmap({ results }) {
    const [hoveredState, setHoveredState] = useState(null);

    const stateCounts = useMemo(() => {
        const counts = {};
        results.forEach(item => {
            let stateCode = 'N/A';

            if (typeof item.state === 'string') {
                stateCode = item.state.replace('BR-', '');
            } else if (item.state?.id) {
                stateCode = item.state.id.replace('BR-', '');
            } else if (item.address?.state_id) {
                stateCode = item.address.state_id.replace('BR-', '');
            } else if (item.address?.state_name) {
                const foundEntry = Object.entries(BRAZIL_STATES).find(([k, v]) => v.name === item.address.state_name);
                if (foundEntry) stateCode = foundEntry[0];
            }

            // Count occurrences (even if not in BRAZIL_STATES)
            if (stateCode && stateCode !== 'N/A') {
                counts[stateCode] = (counts[stateCode] || 0) + 1;
            }
        });
        return counts;
    }, [results]);

    const sortedStates = Object.entries(stateCounts)
        .sort(([, a], [, b]) => b - a);

    const totalCalculated = sortedStates.reduce((acc, [, count]) => acc + count, 0);
    const maxCount = sortedStates.length > 0 ? sortedStates[0][1] : 1;

    // Heatmap Color Helper — 8 relative bands
    const getIntensityColor = (count) => {
        if (!count) return '#f3f4f6'; // gray-100 — sem vendedores
        const intensity = count / maxCount;
        if (intensity < 0.05) return '#f3e8ff'; // purple-100 — traço
        if (intensity < 0.15) return '#e9d5ff'; // purple-200 — muito baixo
        if (intensity < 0.28) return '#d8b4fe'; // purple-300 — baixo
        if (intensity < 0.42) return '#c084fc'; // purple-400 — baixo-médio
        if (intensity < 0.57) return '#a855f7'; // purple-500 — médio
        if (intensity < 0.72) return '#9333ea'; // purple-600 — médio-alto
        if (intensity < 0.88) return '#7c3aed'; // violet-600 — alto
        return '#5b21b6';                         // violet-800 — máximo
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 mt-12 mb-12">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                        <span className="p-2 bg-purple-100 text-origenow-purple rounded-lg">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0121 18.382V7.618a1 1 0 00-.553-.894L15 7m0 13V7" /></svg>
                        </span>{' '}
                        <span>Mapa de Calor de Vendedores</span>
                    </h3>
                    <p className="text-gray-500 mt-1 ml-1 text-sm">Visualização geográfica da localização dos estoques.</p>
                </div>
                <div className="flex gap-4">
                    <div className="text-right">
                        <div className="text-3xl font-black text-origenow-purple">{totalCalculated}</div>
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Total Vendedores</div>
                    </div>
                </div>
            </div>

            {sortedStates.length === 0 ? (
                <div className="text-center py-10 text-gray-400 italic bg-gray-50 rounded-xl">
                    Nenhum vendedor brasileiro identificado nestes resultados.
                </div>
            ) : (
                <div className="grid lg:grid-cols-5 gap-8">
                    {/* SVG Map Section - Takes 3 cols */}
                    <div className="lg:col-span-3 bg-blue-100 rounded-xl p-4 flex items-center justify-center relative min-h-[400px]">
                        {/* Tooltip for Hovered State */}
                        {/* Tooltip for Hovered State */}
                        {hoveredState && (
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-lg shadow-xl text-center z-10 pointer-events-none animate-fade-in">
                                <div className="font-bold text-lg leading-none">{stateCounts[hoveredState] || 0}</div>
                                <div className="text-xs text-gray-400 uppercase font-bold">
                                    {BRAZIL_STATES[hoveredState]?.name || hoveredState}
                                </div>
                            </div>
                        )}

                        <svg viewBox="0 0 613 639" className="w-full h-full max-w-[600px] drop-shadow-xl">
                            <defs>
                                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="3" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>
                            {Object.entries(BRAZIL_STATES).map(([code, { path }]) => {
                                const count = stateCounts[code] || 0;
                                const isHovered = hoveredState === code;

                                return (
                                    <path
                                        key={code}
                                        d={path}
                                        fill={getIntensityColor(count)}
                                        stroke={isHovered ? "#ffffff" : "#fff"}
                                        strokeWidth={isHovered ? "2" : "1"}
                                        className="transition-all duration-300 cursor-pointer hover:brightness-110"
                                        style={{
                                            filter: isHovered ? 'drop-shadow(0px 5px 10px rgba(0,0,0,0.2))' : 'none',
                                            zIndex: isHovered ? 10 : 1
                                        }}
                                        onMouseEnter={() => setHoveredState(code)}
                                        onMouseLeave={() => setHoveredState(null)}
                                    />
                                );
                            })}
                        </svg>

                        {/* Legend */}
                        <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur rounded-lg p-3 shadow-lg border border-gray-100 text-xs">
                            <p className="font-bold text-gray-500 uppercase tracking-wider mb-2" style={{ fontSize: '10px' }}>Densidade</p>
                            {[
                                { color: '#5b21b6', label: 'Máxima' },
                                { color: '#7c3aed', label: 'Alta' },
                                { color: '#9333ea', label: 'Média-alta' },
                                { color: '#a855f7', label: 'Média' },
                                { color: '#c084fc', label: 'Baixa-média' },
                                { color: '#d8b4fe', label: 'Baixa' },
                                { color: '#e9d5ff', label: 'Muito baixa' },
                                { color: '#f3f4f6', label: 'Nenhuma' },
                            ].map(({ color, label }) => (
                                <div key={label} className="flex items-center gap-2 mb-1">
                                    <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: color }}></span>
                                    <span className="text-gray-600">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ranked List Section - Takes 2 cols */}
                    <div className="lg:col-span-2 space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                        {sortedStates.map(([code, count], index) => {
                            const widthPercent = (count / totalCalculated) * 100;
                            const percentageOfTotal = ((count / totalCalculated) * 100).toFixed(1);
                            const stateName = BRAZIL_STATES[code]?.name || code;

                            return (
                                <div
                                    key={code}
                                    tabIndex={0}
                                    role="listitem"
                                    className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-purple-200 hover:bg-purple-50 transition-all cursor-pointer focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
                                    onMouseEnter={() => setHoveredState(code)}
                                    onMouseLeave={() => setHoveredState(null)}
                                    onFocus={() => setHoveredState(code)}
                                    onBlur={() => setHoveredState(null)}
                                >
                                    <div className={`
                                        w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border
                                        ${index < 3
                                            ? 'bg-purple-600 text-white border-purple-700 shadow-md shadow-purple-200'
                                            : 'bg-gray-200 text-gray-700 border-gray-300'}
                                    `}>
                                        {index + 1}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-gray-800 truncate" title={stateName}>{stateName}</span>
                                            <span className="text-xs font-mono text-gray-500">{percentageOfTotal}%</span>
                                        </div>
                                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-500 ${index < 3 ? 'bg-purple-600' : 'bg-purple-300'}`}
                                                style={{ width: `${widthPercent}%` }}
                                            />
                                        </div>
                                    </div>

                                    <div className="shrink-0 font-bold text-gray-900 min-w-[30px] text-right">
                                        {count}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

LocationHeatmap.propTypes = {
    results: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default LocationHeatmap;
