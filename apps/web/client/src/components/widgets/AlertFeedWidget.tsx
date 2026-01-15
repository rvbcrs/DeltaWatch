import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { Bell, TrendingDown, Package, AlertTriangle } from 'lucide-react';

interface Alert {
    id: number;
    type: 'price_target' | 'stock_alert' | 'error' | 'change';
    monitor_name: string;
    message: string;
    created_at: string;
}

interface AlertFeedWidgetProps {
    alerts: Alert[];
    onViewMonitor?: (monitorId: number) => void;
}

export function AlertFeedWidget({ alerts }: AlertFeedWidgetProps) {
    const { i18n } = useTranslation();
    const locale = i18n.language === 'nl' ? nl : enUS;

    const getAlertIcon = (type: Alert['type']) => {
        switch (type) {
            case 'price_target':
                return <TrendingDown className="w-4 h-4 text-green-400" />;
            case 'stock_alert':
                return <Package className="w-4 h-4 text-blue-400" />;
            case 'error':
                return <AlertTriangle className="w-4 h-4 text-red-400" />;
            default:
                return <Bell className="w-4 h-4 text-yellow-400" />;
        }
    };

    const getAlertColor = (type: Alert['type']) => {
        switch (type) {
            case 'price_target':
                return 'border-green-900/50 bg-green-900/10';
            case 'stock_alert':
                return 'border-blue-900/50 bg-blue-900/10';
            case 'error':
                return 'border-red-900/50 bg-red-900/10';
            default:
                return 'border-yellow-900/50 bg-yellow-900/10';
        }
    };

    if (alerts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <Bell className="w-8 h-8 text-gray-600 mb-2" />
                <div className="text-gray-500 text-sm">No recent alerts</div>
                <div className="text-xs text-gray-600 mt-1">
                    Alerts will appear here when price targets are reached or stocks become available
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-2 overflow-auto max-h-full">
            {alerts.slice(0, 10).map((alert) => (
                <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border ${getAlertColor(alert.type)} transition-colors`}
                >
                    {/* Icon */}
                    <div className="mt-0.5 flex-shrink-0">
                        {getAlertIcon(alert.type)}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                            {alert.monitor_name}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                            {alert.message}
                        </div>
                    </div>
                    
                    {/* Time */}
                    <div className="text-xs text-gray-500 whitespace-nowrap flex-shrink-0">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale })}
                    </div>
                </div>
            ))}
        </div>
    );
}

export default AlertFeedWidget;
