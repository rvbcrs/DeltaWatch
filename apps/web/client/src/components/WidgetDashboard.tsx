import { useState, useEffect } from 'react';
import { Settings, Plus, X, Check, RotateCcw } from 'lucide-react';

import {
    DashboardWidget,
    StatsWidget,
    RecentChangesWidget,
    PriceTrackersWidget,
    ErrorsWidget,
    QuickActionsWidget,
    ChecksTimelineWidget,
    ActivityHeatmapWidget,
    AlertFeedWidget,
    WidgetConfig,
    WidgetType,
    DEFAULT_WIDGETS,
    AVAILABLE_WIDGETS
} from './widgets';

interface Monitor {
    id: number;
    name?: string;
    url: string;
    detected_price?: number;
    detected_currency?: string;
    price_target?: number;
    price_detection_enabled?: boolean;
    consecutive_failures?: number;
    last_check?: string;
    history?: { value: string | null; status: string }[];
}

interface HistoryItem {
    id: number;
    monitor_id: number;
    monitor_name: string;
    status: 'changed' | 'unchanged' | 'error';
    value?: string;
    created_at: string;
}

interface Stats {
    totalMonitors: number;
    activeMonitors: number;
    checksToday: number;
    changesDetected: number;
    errorsToday: number;
    successRate: number;
}

interface CheckData {
    date: string;
    total: number;
    changed: number;
    errors: number;
}

interface ActivityData {
    date: string;
    count: number;
}

interface Alert {
    id: number;
    type: 'price_target' | 'stock_alert' | 'error' | 'change';
    monitor_name: string;
    message: string;
    created_at: string;
}

interface WidgetDashboardProps {
    stats: Stats;
    monitors: Monitor[];
    recentChanges: HistoryItem[];
    checksTimeline?: CheckData[];
    activityData?: ActivityData[];
    alerts?: Alert[];
    onViewMonitor: (monitorId: number) => void;
    onRunAllChecks: () => void;
    onRefreshData: () => void;
    isRunningChecks?: boolean;
}

const STORAGE_KEY = 'deltawatch_widget_layout_v2';

export function WidgetDashboard({
    stats,
    monitors,
    recentChanges,
    checksTimeline = [],
    activityData = [],
    alerts = [],
    onViewMonitor,
    onRunAllChecks,
    onRefreshData,
    isRunningChecks = false
}: WidgetDashboardProps) {
    const [widgets, setWidgets] = useState<WidgetConfig[]>(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Merge with defaults to get new widgets
                const existingTypes = new Set(parsed.map((w: WidgetConfig) => w.type));
                const newWidgets = DEFAULT_WIDGETS.filter(w => !existingTypes.has(w.type));
                return [...parsed, ...newWidgets.map(w => ({ ...w, visible: false }))];
            } catch {
                return DEFAULT_WIDGETS;
            }
        }
        return DEFAULT_WIDGETS;
    });
    
    const [isEditMode, setIsEditMode] = useState(false);
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [collapsedWidgets, setCollapsedWidgets] = useState<Set<string>>(new Set());

    // Save layout to localStorage
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    }, [widgets]);

    // Remove widget
    const handleRemoveWidget = (widgetId: string) => {
        setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { ...w, visible: false } : w
        ));
    };

    // Add widget
    const handleAddWidget = (type: WidgetType) => {
        const existingConfig = AVAILABLE_WIDGETS.find(w => w.type === type);
        if (!existingConfig) return;

        // Check if already visible
        const existing = widgets.find(w => w.type === type);
        if (existing?.visible) {
            setShowAddPanel(false);
            return;
        }

        if (existing) {
            // Re-enable existing widget
            setWidgets(prev => prev.map(w => 
                w.type === type ? { ...w, visible: true } : w
            ));
        } else {
            // Add new widget
            const newWidget: WidgetConfig = {
                id: `${type}-${Date.now()}`,
                type,
                title: existingConfig.title,
                icon: existingConfig.icon,
                visible: true,
                position: { x: 0, y: 99, w: 1, h: 1 }
            };
            setWidgets(prev => [...prev, newWidget]);
        }
        setShowAddPanel(false);
    };

    // Move widget up in order
    const moveWidgetUp = (widgetId: string) => {
        setWidgets(prev => {
            const visibleList = prev.filter(w => w.visible);
            const hiddenList = prev.filter(w => !w.visible);
            const index = visibleList.findIndex(w => w.id === widgetId);
            if (index <= 0) return prev;
            [visibleList[index - 1], visibleList[index]] = [visibleList[index], visibleList[index - 1]];
            return [...visibleList, ...hiddenList];
        });
    };

    // Move widget down in order
    const moveWidgetDown = (widgetId: string) => {
        setWidgets(prev => {
            const visibleList = prev.filter(w => w.visible);
            const hiddenList = prev.filter(w => !w.visible);
            const index = visibleList.findIndex(w => w.id === widgetId);
            if (index < 0 || index >= visibleList.length - 1) return prev;
            [visibleList[index], visibleList[index + 1]] = [visibleList[index + 1], visibleList[index]];
            return [...visibleList, ...hiddenList];
        });
    };

    // Reset to default layout
    const handleResetLayout = () => {
        setWidgets(DEFAULT_WIDGETS);
        setCollapsedWidgets(new Set());
        localStorage.removeItem(STORAGE_KEY);
    };

    // Toggle widget collapse
    const toggleCollapse = (widgetId: string) => {
        setCollapsedWidgets(prev => {
            const newSet = new Set(prev);
            if (newSet.has(widgetId)) {
                newSet.delete(widgetId);
            } else {
                newSet.add(widgetId);
            }
            return newSet;
        });
    };

    // Get price monitors
    const priceMonitors = monitors.filter(m => m.price_detection_enabled);
    
    // Get error monitors
    const errorMonitors = monitors.filter(m => (m.consecutive_failures ?? 0) > 0);

    // Render widget content based on type
    const renderWidgetContent = (widget: WidgetConfig) => {
        switch (widget.type) {
            case 'stats':
                return <StatsWidget stats={stats} />;
            case 'recent_changes':
                return <RecentChangesWidget changes={recentChanges} onViewMonitor={onViewMonitor} />;
            case 'price_trackers':
                return <PriceTrackersWidget monitors={priceMonitors} onViewMonitor={onViewMonitor} />;
            case 'errors':
                return <ErrorsWidget monitors={errorMonitors} onViewMonitor={onViewMonitor} />;
            case 'quick_actions':
                return (
                    <QuickActionsWidget 
                        onRunAllChecks={onRunAllChecks}
                        onRefreshData={onRefreshData}
                        isRunningChecks={isRunningChecks}
                    />
                );
            case 'checks_timeline':
                return <ChecksTimelineWidget data={checksTimeline} />;
            case 'activity_heatmap':
                return <ActivityHeatmapWidget data={activityData} />;
            case 'alert_feed':
                return <AlertFeedWidget alerts={alerts} />;
            default:
                return <div className="text-gray-500 text-sm">Unknown widget type: {widget.type}</div>;
        }
    };

    // Get grid span class based on widget type
    const getWidgetSpan = (widget: WidgetConfig): string => {
        switch (widget.type) {
            case 'stats':
                return 'col-span-2';
            case 'quick_actions':
                return 'col-span-1';
            case 'checks_timeline':
                return 'col-span-2';
            case 'activity_heatmap':
                return 'col-span-3';
            case 'recent_changes':
                return 'col-span-1 row-span-2';
            case 'price_trackers':
                return 'col-span-2 row-span-2';
            case 'errors':
                return 'col-span-2';
            case 'alert_feed':
                return 'col-span-1 row-span-2';
            default:
                return 'col-span-1';
        }
    };

    const visibleWidgets = widgets.filter(w => w.visible);

    return (
        <div className="relative">
            {/* Edit Mode Toggle */}
            <div className="flex items-center justify-end gap-2 mb-4">
                {isEditMode && (
                    <>
                        <button
                            onClick={() => setShowAddPanel(true)}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Add Widget
                        </button>
                        <button
                            onClick={handleResetLayout}
                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Reset
                        </button>
                    </>
                )}
                <button
                    onClick={() => setIsEditMode(!isEditMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        isEditMode 
                            ? 'bg-green-600 hover:bg-green-700 text-white' 
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    {isEditMode ? (
                        <>
                            <Check className="w-4 h-4" />
                            Done
                        </>
                    ) : (
                        <>
                            <Settings className="w-4 h-4" />
                            Customize
                        </>
                    )}
                </button>
            </div>

            {/* Add Widget Panel */}
            {showAddPanel && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center" onClick={() => setShowAddPanel(false)}>
                    <div className="bg-[#161b22] border border-gray-700 rounded-xl p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Add Widget</h3>
                            <button onClick={() => setShowAddPanel(false)} className="p-1 hover:bg-gray-700 rounded">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="space-y-2">
                            {AVAILABLE_WIDGETS.map(widget => {
                                const isActive = widgets.some(w => w.type === widget.type && w.visible);
                                return (
                                    <button
                                        key={widget.type}
                                        onClick={() => handleAddWidget(widget.type)}
                                        disabled={isActive}
                                        className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                                            isActive 
                                                ? 'border-gray-700 bg-gray-800/50 opacity-50 cursor-not-allowed' 
                                                : 'border-gray-700 bg-[#0d1117] hover:bg-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        <span className="text-2xl">{widget.icon}</span>
                                        <div className="text-left flex-1">
                                            <div className="font-medium text-white">{widget.title}</div>
                                            <div className="text-xs text-gray-500">{widget.description}</div>
                                        </div>
                                        {isActive && (
                                            <span className="text-xs text-gray-500">Active</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Widget Grid */}
            <div className="grid grid-cols-3 gap-4 auto-rows-[minmax(180px,auto)]">
                {visibleWidgets.map((widget, index) => (
                    <div 
                        key={widget.id} 
                        className={`${getWidgetSpan(widget)} ${isEditMode ? 'ring-2 ring-blue-500/30 ring-offset-2 ring-offset-[#0d1117] rounded-xl' : ''}`}
                    >
                        <DashboardWidget
                            id={widget.id}
                            title={widget.title}
                            icon={widget.icon}
                            isEditMode={isEditMode}
                            isCollapsed={collapsedWidgets.has(widget.id)}
                            onRemove={() => handleRemoveWidget(widget.id)}
                            onToggleCollapse={() => toggleCollapse(widget.id)}
                            onMoveUp={index > 0 ? () => moveWidgetUp(widget.id) : undefined}
                            onMoveDown={index < visibleWidgets.length - 1 ? () => moveWidgetDown(widget.id) : undefined}
                        >
                            {renderWidgetContent(widget)}
                        </DashboardWidget>
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {visibleWidgets.length === 0 && (
                <div className="text-center py-12">
                    <div className="text-gray-500 mb-4">No widgets configured</div>
                    <button
                        onClick={() => setShowAddPanel(true)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                    >
                        Add Widget
                    </button>
                </div>
            )}
        </div>
    );
}

export default WidgetDashboard;
