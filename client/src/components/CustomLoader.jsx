import React, { useState, useEffect } from 'react';
import './CustomLoader.css';

const CustomLoader = ({ message, progress = 0, termsCount = 1 }) => {
    const [seconds, setSeconds] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Estimate: ~15-30 seconds per term depending on the API speed
    const estimatedTotal = termsCount * 25;

    return (
        <div className="flex flex-col items-center justify-center p-10 w-full max-w-md mx-auto">
            <div className="bar">
                <div className="ball"></div>
            </div>
            
            <div className="mt-16 w-full space-y-6">
                <div className="text-center">
                    <p className="text-gray-500 font-bold animate-pulse text-lg">{message || 'Buscando melhores produtos...'}</p>
                </div>

                {/* Timer & Info */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl border border-gray-100 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <svg className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Tempo Decorrido</span>
                            <span className="text-sm font-mono font-bold text-gray-700">{seconds}s</span>
                        </div>
                    </div>
                    
                    <div className="h-8 w-px bg-gray-200"></div>

                    <div className="flex items-center gap-3 text-right">
                        <div className="flex flex-col">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest text-right">Estimativa Total</span>
                            <span className="text-sm font-mono font-bold text-gray-700">~{estimatedTotal}s</span>
                        </div>
                        <div className="p-2 bg-white rounded-lg shadow-sm">
                            <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomLoader;
