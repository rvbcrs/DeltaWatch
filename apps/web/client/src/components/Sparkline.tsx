import { useMemo, useState } from 'react';

interface SparklineProps {
    data: { value: string | null | undefined; status: string }[];
    width?: number;
    height?: number;
    className?: string;
}

/**
 * Mini sparkline chart component for displaying value trends.
 * Extracts numeric values from history and renders as SVG path.
 * Hover shows enlarged popup with details.
 */
export function Sparkline({ data, width = 60, height = 20, className = '' }: SparklineProps) {
    const [isHovered, setIsHovered] = useState(false);
    
    const { points, numericData, min, max } = useMemo(() => {
        // Extract numeric values from the data (newest first in input, we reverse for left-to-right display)
        const numericData = data
            .filter(d => d.status !== 'error' && d.value)
            .map(d => {
                const val = (d.value || '').trim();
                
                // STRICT CHECK: The string must ONLY contain:
                // - Digits, Currency symbols (€, $, £, ¥, ₹), Punctuation (., - +)
                // - White space, Percentage sign (%), Optional k/K/m/M suffix
                // Any other letter (A-Z) immediately disqualifies it.
                
                const strictAllowRegex = /^([A-Z]{3}\s?)?[€$£¥₹\s\d.,+\-%]*(\s?[A-Z]{3})?[kKmM]?$/;
                if (!strictAllowRegex.test(val)) return null;
                
                // Must contain at least one digit
                if (!/\d/.test(val)) return null;
                
                // Parse price-like values: remove currency symbols, handle comma as decimal
                let cleaned = val.replace(/[€$£¥₹%\s]/g, '').trim();
                // Remove currency codes
                cleaned = cleaned.replace(/^[A-Z]{3}/i, '').replace(/[A-Z]{3}$/i, '').trim();
                
                // Handle European format (1.234,56) vs US format (1,234.56)
                if (cleaned.includes(',') && cleaned.includes('.')) {
                    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
                        cleaned = cleaned.replace(/\./g, '').replace(',', '.');
                    } else {
                        cleaned = cleaned.replace(/,/g, '');
                    }
                } else if (cleaned.includes(',') && !cleaned.includes('.')) {
                    const parts = cleaned.split(',');
                    if (parts.length === 2 && parts[1].length <= 2) {
                        cleaned = cleaned.replace(',', '.');
                    } else {
                        cleaned = cleaned.replace(/,/g, '');
                    }
                }
                
                // Handle k/K/m/M suffixes (1.5k = 1500)
                let multiplier = 1;
                if (/[kK]$/.test(cleaned)) {
                    multiplier = 1000;
                    cleaned = cleaned.replace(/[kK]$/, '');
                } else if (/[mM]$/.test(cleaned)) {
                    multiplier = 1000000;
                    cleaned = cleaned.replace(/[mM]$/, '');
                }
                
                const num = parseFloat(cleaned.replace(/[^0-9.-]/g, ''));
                return isNaN(num) ? null : num * multiplier;
            })
            .filter((n): n is number => n !== null)
            .slice(0, 20)
            .reverse();

        if (numericData.length < 2) return { points: null, numericData: [], min: 0, max: 0 };

        const min = Math.min(...numericData);
        const max = Math.max(...numericData);
        const range = max - min || 1;

        const padding = 2;
        const effectiveWidth = width - padding * 2;
        const effectiveHeight = height - padding * 2;

        const points = numericData.map((val, i) => ({
            x: padding + (i / (numericData.length - 1)) * effectiveWidth,
            y: padding + effectiveHeight - ((val - min) / range) * effectiveHeight,
            value: val
        }));
        
        return { points, numericData, min, max };
    }, [data, width, height]);

    if (!points || points.length < 2) {
        return null;
    }

    // Create SVG path for small version
    const pathD = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

    // Create SVG path for large popup version
    const popupWidth = 300;
    const popupHeight = 100;
    const popupPadding = 10;
    const range = max - min || 1;
    const largePoints = numericData.map((val, i) => ({
        x: popupPadding + (i / (numericData.length - 1)) * (popupWidth - popupPadding * 2),
        y: popupPadding + (popupHeight - popupPadding * 2) - ((val - min) / range) * (popupHeight - popupPadding * 2),
        value: val
    }));
    const largePathD = largePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
        .join(' ');

    // Determine trend color
    const firstVal = points[0].value;
    const lastVal = points[points.length - 1].value;
    const trendUp = lastVal > firstVal;
    const trendDown = lastVal < firstVal;
    const strokeColor = trendUp ? '#22c55e' : trendDown ? '#ef4444' : '#6b7280';
    const trendPercent = firstVal !== 0 ? ((lastVal - firstVal) / firstVal * 100).toFixed(1) : '0';

    const formatVal = (val: number) => {
        if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
        return val.toFixed(2);
    };

    return (
        <div 
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            {/* Small sparkline */}
            <svg 
                width={width} 
                height={height} 
                className={`flex-shrink-0 cursor-pointer ${className}`}
                viewBox={`0 0 ${width} ${height}`}
            >
                <defs>
                    <linearGradient id={`sparkGrad-${trendUp ? 'up' : trendDown ? 'down' : 'flat'}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
                    </linearGradient>
                </defs>
                
                <path
                    d={`${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height} L ${points[0].x.toFixed(1)} ${height} Z`}
                    fill={`url(#sparkGrad-${trendUp ? 'up' : trendDown ? 'down' : 'flat'})`}
                />
                
                <path
                    d={pathD}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                
                <circle
                    cx={points[points.length - 1].x}
                    cy={points[points.length - 1].y}
                    r="2"
                    fill={strokeColor}
                />
            </svg>

            {/* Hover Popup */}
            {isHovered && (
                <div className="absolute bottom-full right-0 mb-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="bg-[#1c2128] border border-gray-700 rounded-xl shadow-2xl p-4 min-w-[320px]">
                        {/* Header with trend */}
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-gray-400 text-sm font-medium">Price Trend</span>
                            <span className={`text-sm font-bold flex items-center gap-1 ${trendUp ? 'text-green-400' : trendDown ? 'text-red-400' : 'text-gray-400'}`}>
                                {trendUp ? '↑' : trendDown ? '↓' : '→'} {trendPercent}%
                            </span>
                        </div>
                        
                        {/* Large sparkline */}
                        <svg 
                            width={popupWidth} 
                            height={popupHeight} 
                            className="w-full"
                            viewBox={`0 0 ${popupWidth} ${popupHeight}`}
                        >
                            <defs>
                                <linearGradient id="popupGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                                    <stop offset="100%" stopColor={strokeColor} stopOpacity="0.05" />
                                </linearGradient>
                            </defs>
                            
                            {/* Grid lines */}
                            <line x1={popupPadding} y1={popupPadding} x2={popupWidth - popupPadding} y2={popupPadding} stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
                            <line x1={popupPadding} y1={popupHeight / 2} x2={popupWidth - popupPadding} y2={popupHeight / 2} stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
                            <line x1={popupPadding} y1={popupHeight - popupPadding} x2={popupWidth - popupPadding} y2={popupHeight - popupPadding} stroke="#374151" strokeWidth="0.5" strokeDasharray="2,2" />
                            
                            {/* Area fill */}
                            <path
                                d={`${largePathD} L ${largePoints[largePoints.length - 1].x.toFixed(1)} ${popupHeight - popupPadding} L ${largePoints[0].x.toFixed(1)} ${popupHeight - popupPadding} Z`}
                                fill="url(#popupGrad)"
                            />
                            
                            {/* Line */}
                            <path
                                d={largePathD}
                                fill="none"
                                stroke={strokeColor}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                            
                            {/* Data points */}
                            {largePoints.map((p, i) => (
                                <circle
                                    key={i}
                                    cx={p.x}
                                    cy={p.y}
                                    r={i === largePoints.length - 1 ? 5 : 3}
                                    fill={i === largePoints.length - 1 ? strokeColor : '#1c2128'}
                                    stroke={strokeColor}
                                    strokeWidth="2"
                                />
                            ))}
                        </svg>
                        
                        {/* Stats */}
                        <div className="flex justify-between mt-3 text-xs">
                            <div className="text-gray-500">
                                <span className="text-gray-400">Min:</span> {formatVal(min)}
                            </div>
                            <div className="text-gray-500">
                                <span className="text-gray-400">Current:</span> <span className="text-white font-medium">{formatVal(lastVal)}</span>
                            </div>
                            <div className="text-gray-500">
                                <span className="text-gray-400">Max:</span> {formatVal(max)}
                            </div>
                        </div>
                        
                        {/* Data points indicator */}
                        <div className="text-center mt-2 text-[10px] text-gray-600">
                            {numericData.length} data points
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Sparkline;
