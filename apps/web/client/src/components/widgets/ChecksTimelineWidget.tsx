import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

interface CheckData {
    date: string;
    total: number;
    changed: number;
    errors: number;
}

interface ChecksTimelineWidgetProps {
    data: CheckData[];
}

export function ChecksTimelineWidget({ data }: ChecksTimelineWidgetProps) {
    const { t } = useTranslation();
    
    const { chartData, maxValue } = useMemo(() => {
        // Get last 7 days
        const days: CheckData[] = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const existing = data.find(d => d.date === dateStr);
            days.push(existing || { date: dateStr, total: 0, changed: 0, errors: 0 });
        }
        const max = Math.max(...days.map(d => d.total), 1);
        return { chartData: days, maxValue: max };
    }, [data]);

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('nl-NL', { weekday: 'short' });
    };

    if (data.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No check data available
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Chart */}
            <div className="flex-1 flex items-end gap-2 px-2 pb-2">
                {chartData.map((day, index) => {
                    const heightPercent = (day.total / maxValue) * 100;
                    const changedPercent = day.total > 0 ? (day.changed / day.total) * heightPercent : 0;
                    const errorPercent = day.total > 0 ? (day.errors / day.total) * heightPercent : 0;
                    
                    return (
                        <div key={index} className="flex-1 flex flex-col items-center gap-1">
                            {/* Bar */}
                            <div 
                                className="w-full relative bg-gray-800 rounded-t overflow-hidden"
                                style={{ height: `${Math.max(heightPercent, 5)}%`, minHeight: '4px' }}
                                title={`${day.total} checks, ${day.changed} changes, ${day.errors} errors`}
                            >
                                {/* Success portion */}
                                <div 
                                    className="absolute bottom-0 left-0 right-0 bg-green-600"
                                    style={{ height: `${100 - changedPercent - errorPercent}%` }}
                                />
                                {/* Changed portion */}
                                <div 
                                    className="absolute left-0 right-0 bg-yellow-500"
                                    style={{ 
                                        bottom: `${100 - changedPercent - errorPercent}%`,
                                        height: `${changedPercent}%` 
                                    }}
                                />
                                {/* Error portion */}
                                <div 
                                    className="absolute top-0 left-0 right-0 bg-red-500"
                                    style={{ height: `${errorPercent}%` }}
                                />
                            </div>
                            {/* Day label */}
                            <span className="text-[10px] text-gray-500 uppercase">
                                {formatDate(day.date)}
                            </span>
                        </div>
                    );
                })}
            </div>
            
            {/* Legend */}
            <div className="flex items-center justify-center gap-4 pt-2 border-t border-gray-800">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-600 rounded-sm" />
                    <span className="text-xs text-gray-400">OK</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-sm" />
                    <span className="text-xs text-gray-400">Changed</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-sm" />
                    <span className="text-xs text-gray-400">Error</span>
                </div>
            </div>
        </div>
    );
}

export default ChecksTimelineWidget;
