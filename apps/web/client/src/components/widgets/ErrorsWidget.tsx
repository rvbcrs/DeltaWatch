import { AlertTriangle, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface ErrorMonitor {
    id: number;
    name?: string;
    url: string;
    last_check?: string;
    consecutive_failures?: number;
    last_error?: string;
}

interface ErrorsWidgetProps {
    monitors: ErrorMonitor[];
    onViewMonitor?: (monitorId: number) => void;
}

export function ErrorsWidget({ monitors, onViewMonitor }: ErrorsWidgetProps) {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'nl' ? nl : enUS;
    
    if (monitors.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-12 h-12 rounded-full bg-green-900/20 flex items-center justify-center mb-3">
                    <span className="text-2xl">✓</span>
                </div>
                <div className="text-green-400 font-medium">All monitors healthy!</div>
                <div className="text-xs text-gray-500 mt-1">No errors detected</div>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {monitors.slice(0, 5).map((monitor) => (
                <div 
                    key={monitor.id}
                    onClick={() => onViewMonitor?.(monitor.id)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-red-900/10 hover:bg-red-900/20 cursor-pointer transition-colors border border-red-900/30"
                >
                    {/* Error Icon */}
                    <div className="w-8 h-8 rounded-full bg-red-900/30 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-4 h-4 text-red-400" />
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {monitor.name || new URL(monitor.url).hostname}
                        </div>
                        <div className="text-xs text-red-400">
                            {monitor.consecutive_failures} consecutive failures
                        </div>
                    </div>
                    
                    {/* Time & Link */}
                    <div className="flex items-center gap-2">
                        {monitor.last_check && (
                            <span className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(monitor.last_check), { addSuffix: true, locale })}
                            </span>
                        )}
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                    </div>
                </div>
            ))}
            
            {monitors.length > 5 && (
                <div className="text-center text-xs text-gray-500 pt-2">
                    +{monitors.length - 5} more errors
                </div>
            )}
        </div>
    );
}

export default ErrorsWidget;
