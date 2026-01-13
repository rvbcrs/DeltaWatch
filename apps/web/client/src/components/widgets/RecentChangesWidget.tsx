import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface HistoryItem {
    id: number;
    monitor_id: number;
    monitor_name: string;
    status: 'changed' | 'unchanged' | 'error';
    value?: string;
    created_at: string;
    type?: string;
}

interface RecentChangesWidgetProps {
    changes: HistoryItem[];
    onViewMonitor?: (monitorId: number) => void;
}

export function RecentChangesWidget({ changes, onViewMonitor }: RecentChangesWidgetProps) {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'nl' ? nl : enUS;
    
    if (changes.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No recent changes
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {changes.slice(0, 8).map((change) => (
                <div 
                    key={change.id}
                    onClick={() => onViewMonitor?.(change.monitor_id)}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[#0d1117] hover:bg-gray-800/50 cursor-pointer transition-colors border border-gray-800"
                >
                    {/* Status Icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        change.status === 'changed' ? 'bg-yellow-900/30' :
                        change.status === 'error' ? 'bg-red-900/30' : 'bg-green-900/30'
                    }`}>
                        {change.status === 'changed' ? (
                            <ArrowUpRight className="w-4 h-4 text-yellow-400" />
                        ) : change.status === 'error' ? (
                            <ArrowDownRight className="w-4 h-4 text-red-400" />
                        ) : (
                            <Minus className="w-4 h-4 text-green-400" />
                        )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {change.monitor_name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                            {change.value ? change.value.substring(0, 50) + (change.value.length > 50 ? '...' : '') : 'Visual change'}
                        </div>
                    </div>
                    
                    {/* Time */}
                    <div className="text-xs text-gray-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(change.created_at), { addSuffix: true, locale })}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default RecentChangesWidget;
