// Export all widgets
export { DashboardWidget } from './DashboardWidget';
export { StatsWidget } from './StatsWidget';
export { RecentChangesWidget } from './RecentChangesWidget';
export { PriceTrackersWidget } from './PriceTrackersWidget';
export { ErrorsWidget } from './ErrorsWidget';
export { QuickActionsWidget } from './QuickActionsWidget';
export { ChecksTimelineWidget } from './ChecksTimelineWidget';
export { ActivityHeatmapWidget } from './ActivityHeatmapWidget';
export { AlertFeedWidget } from './AlertFeedWidget';

// Widget types and configurations
export interface WidgetConfig {
    id: string;
    type: WidgetType;
    title: string;
    icon: string;
    visible: boolean;
    position: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
}

export type WidgetType = 
    | 'stats' 
    | 'recent_changes' 
    | 'price_trackers' 
    | 'errors' 
    | 'quick_actions'
    | 'checks_timeline'
    | 'activity_heatmap'
    | 'alert_feed';

export const DEFAULT_WIDGETS: WidgetConfig[] = [
    {
        id: 'stats',
        type: 'stats',
        title: 'Statistics',
        icon: '📊',
        visible: true,
        position: { x: 0, y: 0, w: 2, h: 2 }
    },
    {
        id: 'quick_actions',
        type: 'quick_actions',
        title: 'Quick Actions',
        icon: '⚡',
        visible: true,
        position: { x: 2, y: 0, w: 1, h: 2 }
    },
    {
        id: 'checks_timeline',
        type: 'checks_timeline',
        title: 'Checks Timeline',
        icon: '📈',
        visible: true,
        position: { x: 0, y: 2, w: 2, h: 2 }
    },
    {
        id: 'activity_heatmap',
        type: 'activity_heatmap',
        title: 'Activity Heatmap',
        icon: '📅',
        visible: true,
        position: { x: 0, y: 4, w: 3, h: 2 }
    },
    {
        id: 'recent_changes',
        type: 'recent_changes',
        title: 'Recent Changes',
        icon: '🔄',
        visible: true,
        position: { x: 2, y: 2, w: 1, h: 2 }
    },
    {
        id: 'price_trackers',
        type: 'price_trackers',
        title: 'Price Trackers',
        icon: '💰',
        visible: false,
        position: { x: 0, y: 6, w: 2, h: 2 }
    },
    {
        id: 'errors',
        type: 'errors',
        title: 'Errors',
        icon: '⚠️',
        visible: false,
        position: { x: 0, y: 8, w: 2, h: 2 }
    },
    {
        id: 'alert_feed',
        type: 'alert_feed',
        title: 'Alert Feed',
        icon: '🔔',
        visible: false,
        position: { x: 2, y: 6, w: 1, h: 2 }
    }
];

// Available widgets for the add widget panel
export const AVAILABLE_WIDGETS = [
    { type: 'stats' as WidgetType, title: 'Statistics', icon: '📊', description: 'Overview of your monitors' },
    { type: 'checks_timeline' as WidgetType, title: 'Checks Timeline', icon: '📈', description: 'Bar chart of checks per day' },
    { type: 'activity_heatmap' as WidgetType, title: 'Activity Heatmap', icon: '📅', description: 'GitHub-style activity calendar' },
    { type: 'recent_changes' as WidgetType, title: 'Recent Changes', icon: '🔄', description: 'Latest detected changes' },
    { type: 'price_trackers' as WidgetType, title: 'Price Trackers', icon: '💰', description: 'Monitor price trends' },
    { type: 'errors' as WidgetType, title: 'Errors', icon: '⚠️', description: 'Monitors with issues' },
    { type: 'alert_feed' as WidgetType, title: 'Alert Feed', icon: '🔔', description: 'Recent alerts and notifications' },
    { type: 'quick_actions' as WidgetType, title: 'Quick Actions', icon: '⚡', description: 'Common actions' },
];
