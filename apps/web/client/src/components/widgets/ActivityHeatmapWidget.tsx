import { useMemo } from 'react';

interface ActivityData {
    date: string;
    count: number;
}

interface ActivityHeatmapWidgetProps {
    data: ActivityData[];
}

export function ActivityHeatmapWidget({ data }: ActivityHeatmapWidgetProps) {
    const { weeks, maxCount } = useMemo(() => {
        // Generate last 12 weeks of data
        const weeksData: { date: Date; count: number }[][] = [];
        const dataMap = new Map(data.map(d => [d.date, d.count]));
        
        const today = new Date();
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - 83); // ~12 weeks
        
        // Align to start of week (Monday)
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
        
        let currentWeek: { date: Date; count: number }[] = [];
        let maxVal = 0;
        
        for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const count = dataMap.get(dateStr) || 0;
            maxVal = Math.max(maxVal, count);
            
            currentWeek.push({ date: new Date(d), count });
            
            if (d.getDay() === 0) { // Sunday
                weeksData.push(currentWeek);
                currentWeek = [];
            }
        }
        
        if (currentWeek.length > 0) {
            weeksData.push(currentWeek);
        }
        
        return { weeks: weeksData, maxCount: maxVal };
    }, [data]);

    const getIntensity = (count: number): string => {
        if (count === 0) return 'bg-gray-800';
        if (maxCount === 0) return 'bg-gray-800';
        const ratio = count / maxCount;
        if (ratio < 0.25) return 'bg-green-900';
        if (ratio < 0.5) return 'bg-green-700';
        if (ratio < 0.75) return 'bg-green-500';
        return 'bg-green-400';
    };

    const months = useMemo(() => {
        const monthLabels: { label: string; col: number }[] = [];
        let lastMonth = -1;
        
        weeks.forEach((week, weekIndex) => {
            if (week.length > 0) {
                const month = week[0].date.getMonth();
                if (month !== lastMonth) {
                    monthLabels.push({
                        label: week[0].date.toLocaleDateString('nl-NL', { month: 'short' }),
                        col: weekIndex
                    });
                    lastMonth = month;
                }
            }
        });
        
        return monthLabels;
    }, [weeks]);

    const totalChanges = data.reduce((sum, d) => sum + d.count, 0);

    return (
        <div className="h-full flex flex-col">
            {/* Month labels */}
            <div className="flex gap-[2px] mb-1 ml-6 text-[10px] text-gray-500">
                {months.map((m, i) => (
                    <div 
                        key={i} 
                        style={{ 
                            position: 'absolute',
                            left: `${24 + m.col * 12}px`
                        }}
                    >
                        {m.label}
                    </div>
                ))}
            </div>
            
            {/* Heatmap grid */}
            <div className="flex-1 flex gap-[2px] mt-4">
                {/* Day labels */}
                <div className="flex flex-col gap-[2px] text-[10px] text-gray-500 mr-1">
                    <div className="h-[10px]"></div>
                    <div className="h-[10px] flex items-center">Ma</div>
                    <div className="h-[10px]"></div>
                    <div className="h-[10px] flex items-center">Wo</div>
                    <div className="h-[10px]"></div>
                    <div className="h-[10px] flex items-center">Vr</div>
                    <div className="h-[10px]"></div>
                </div>
                
                {/* Weeks */}
                <div className="flex gap-[2px] flex-1 overflow-hidden">
                    {weeks.map((week, weekIndex) => (
                        <div key={weekIndex} className="flex flex-col gap-[2px]">
                            {week.map((day, dayIndex) => (
                                <div
                                    key={dayIndex}
                                    className={`w-[10px] h-[10px] rounded-sm ${getIntensity(day.count)} hover:ring-1 hover:ring-white/30 transition-all cursor-default`}
                                    title={`${day.date.toLocaleDateString('nl-NL')}: ${day.count} changes`}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Summary */}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-gray-800">
                <span className="text-xs text-gray-400">
                    {totalChanges} changes in last 12 weeks
                </span>
                <div className="flex items-center gap-1 text-[10px] text-gray-500">
                    <span>Less</span>
                    <div className="w-2 h-2 bg-gray-800 rounded-sm" />
                    <div className="w-2 h-2 bg-green-900 rounded-sm" />
                    <div className="w-2 h-2 bg-green-700 rounded-sm" />
                    <div className="w-2 h-2 bg-green-500 rounded-sm" />
                    <div className="w-2 h-2 bg-green-400 rounded-sm" />
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}

export default ActivityHeatmapWidget;
