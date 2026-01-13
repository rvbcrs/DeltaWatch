import { Sparkline } from '../Sparkline';

interface PriceMonitor {
    id: number;
    name?: string;
    url: string;
    detected_price?: number;
    detected_currency?: string;
    price_target?: number;
    history?: { value: string | null; status: string }[];
}

interface PriceTrackersWidgetProps {
    monitors: PriceMonitor[];
    onViewMonitor?: (monitorId: number) => void;
}

export function PriceTrackersWidget({ monitors, onViewMonitor }: PriceTrackersWidgetProps) {
    if (monitors.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No price monitors configured
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {monitors.slice(0, 6).map((monitor) => (
                <div 
                    key={monitor.id}
                    onClick={() => onViewMonitor?.(monitor.id)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-[#0d1117] hover:bg-gray-800/50 cursor-pointer transition-colors border border-gray-800"
                >
                    {/* Sparkline */}
                    <div className="flex-shrink-0">
                        {monitor.history && monitor.history.length >= 2 ? (
                            <Sparkline data={monitor.history} width={60} height={24} />
                        ) : (
                            <div className="w-[60px] h-[24px] bg-gray-800 rounded flex items-center justify-center">
                                <span className="text-[8px] text-gray-600">No data</span>
                            </div>
                        )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {monitor.name || new URL(monitor.url).hostname}
                        </div>
                        {monitor.price_target && monitor.detected_price && (
                            <div className="flex items-center gap-2 mt-0.5">
                                <div className="text-xs text-gray-500">
                                    Target: {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: monitor.detected_currency || 'EUR' }).format(monitor.price_target)}
                                </div>
                                <div className={`text-xs font-bold ${monitor.detected_price <= monitor.price_target ? 'text-green-400' : 'text-yellow-400'}`}>
                                    {monitor.detected_price <= monitor.price_target 
                                        ? '✓ Reached!' 
                                        : `${Math.round((monitor.price_target / monitor.detected_price) * 100)}%`}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Current Price */}
                    <div className="text-right">
                        {monitor.detected_price ? (
                            <div className="text-lg font-bold text-emerald-400">
                                {new Intl.NumberFormat('nl-NL', { style: 'currency', currency: monitor.detected_currency || 'EUR' }).format(monitor.detected_price)}
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">-</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default PriceTrackersWidget;
