import { useTranslation } from 'react-i18next';
import { TrendingUp, TrendingDown, Activity, AlertTriangle, CheckCircle } from 'lucide-react';

interface StatsWidgetProps {
    stats: {
        totalMonitors: number;
        activeMonitors: number;
        checksToday: number;
        changesDetected: number;
        errorsToday: number;
        successRate: number;
    };
}

export function StatsWidget({ stats }: StatsWidgetProps) {
    const { t } = useTranslation();
    
    const statItems = [
        {
            label: t('stats.deltas'),
            value: stats.activeMonitors,
            subLabel: t('stats.active'),
            icon: <Activity className="w-5 h-5" />,
            color: 'text-blue-400',
            bgColor: 'bg-blue-900/20'
        },
        {
            label: t('stats.checks_24h'),
            value: stats.checksToday,
            icon: <CheckCircle className="w-5 h-5" />,
            color: 'text-green-400',
            bgColor: 'bg-green-900/20'
        },
        {
            label: t('stats.health'),
            value: `${stats.successRate}%`,
            subLabel: t('stats.success_ratio'),
            icon: stats.successRate >= 95 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />,
            color: stats.successRate >= 95 ? 'text-green-400' : 'text-yellow-400',
            bgColor: stats.successRate >= 95 ? 'bg-green-900/20' : 'bg-yellow-900/20'
        },
        {
            label: t('stats.errors_24h'),
            value: stats.errorsToday,
            icon: <AlertTriangle className="w-5 h-5" />,
            color: stats.errorsToday > 0 ? 'text-red-400' : 'text-gray-400',
            bgColor: stats.errorsToday > 0 ? 'bg-red-900/20' : 'bg-gray-900/20'
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {statItems.map((item, index) => (
                <div 
                    key={index}
                    className={`${item.bgColor} rounded-lg p-3 border border-gray-700/50`}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <span className={item.color}>{item.icon}</span>
                        <span className="text-xs text-gray-400 uppercase tracking-wider">{item.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${item.color}`}>
                        {item.value}
                    </div>
                    {item.subLabel && (
                        <div className="text-xs text-gray-500">{item.subLabel}</div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default StatsWidget;
