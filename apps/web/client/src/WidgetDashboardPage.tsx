import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { WidgetDashboard } from './components/WidgetDashboard';
import { ArrowLeft } from 'lucide-react';

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

export default function WidgetDashboardPage() {
    const navigate = useNavigate();
    const { authFetch } = useAuth();
    
    const [stats, setStats] = useState<Stats>({
        totalMonitors: 0,
        activeMonitors: 0,
        checksToday: 0,
        changesDetected: 0,
        errorsToday: 0,
        successRate: 100
    });
    const [monitors, setMonitors] = useState<Monitor[]>([]);
    const [recentChanges, setRecentChanges] = useState<HistoryItem[]>([]);
    const [checksTimeline, setChecksTimeline] = useState<CheckData[]>([]);
    const [activityData, setActivityData] = useState<ActivityData[]>([]);
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRunningChecks, setIsRunningChecks] = useState(false);

    const fetchData = useCallback(async () => {
        try {
            // Fetch monitors
            const monitorsRes = await authFetch('/api/monitors');
            const monitorsData = await monitorsRes.json();
            if (monitorsData.message === 'success') {
                setMonitors(monitorsData.data);
            }

            // Fetch stats
            const statsRes = await authFetch('/api/stats');
            const statsData = await statsRes.json();
            if (statsData.data) {
                setStats({
                    totalMonitors: statsData.data.total_monitors || 0,
                    activeMonitors: statsData.data.active_monitors || 0,
                    checksToday: statsData.data.checks_24h || 0,
                    changesDetected: statsData.data.changes_24h || 0,
                    errorsToday: statsData.data.errors_24h || 0,
                    successRate: statsData.data.checks_24h > 0 
                        ? Math.round(((statsData.data.checks_24h - statsData.data.errors_24h) / statsData.data.checks_24h) * 100) 
                        : 100
                });
            }

            // Fetch recent changes from history
            const historyRes = await authFetch('/api/history?limit=20&status=changed');
            const historyData = await historyRes.json();
            if (historyData.message === 'success' && Array.isArray(historyData.data)) {
                setRecentChanges(historyData.data.map((h: { 
                    id: number; 
                    monitor_id: number; 
                    monitor_name?: string; 
                    status: string; 
                    value?: string; 
                    created_at: string 
                }) => ({
                    id: h.id,
                    monitor_id: h.monitor_id,
                    monitor_name: h.monitor_name || 'Unknown Monitor',
                    status: h.status as 'changed' | 'unchanged' | 'error',
                    value: h.value,
                    created_at: h.created_at
                })));

                // Generate activity data from changes
                const activityMap = new Map<string, number>();
                historyData.data.forEach((h: { created_at: string }) => {
                    const date = h.created_at.split('T')[0];
                    activityMap.set(date, (activityMap.get(date) || 0) + 1);
                });
                setActivityData(Array.from(activityMap.entries()).map(([date, count]) => ({ date, count })));
            }

            // Fetch checks timeline data
            const timelineRes = await authFetch('/api/stats/timeline');
            const timelineData = await timelineRes.json();
            if (timelineData.message === 'success' && Array.isArray(timelineData.data)) {
                setChecksTimeline(timelineData.data);
            }

            // Generate mock alerts from recent changes (until we have real alerts)
            const mockAlerts: Alert[] = recentChanges.slice(0, 5).map((change, i) => ({
                id: i,
                type: 'change' as const,
                monitor_name: change.monitor_name,
                message: change.value?.substring(0, 50) || 'Content changed',
                created_at: change.created_at
            }));
            setAlerts(mockAlerts);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch, recentChanges]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleViewMonitor = (monitorId: number) => {
        navigate(`/monitor/${monitorId}`);
    };

    const handleRunAllChecks = async () => {
        setIsRunningChecks(true);
        try {
            // Run checks on all active monitors
            const activeMonitors = monitors.filter(m => (m as { active?: boolean }).active !== false);
            await Promise.all(activeMonitors.map(m => 
                authFetch(`/api/monitors/${m.id}/check`, { method: 'POST' })
            ));
            // Refresh data after checks
            setTimeout(fetchData, 2000);
        } catch (error) {
            console.error('Error running checks:', error);
        } finally {
            setIsRunningChecks(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Analytics Dashboard</h1>
                        <p className="text-sm text-gray-400">Monitor activity and trends</p>
                    </div>
                </div>
            </div>

            {/* Widget Dashboard */}
            <WidgetDashboard
                stats={stats}
                monitors={monitors}
                recentChanges={recentChanges}
                checksTimeline={checksTimeline}
                activityData={activityData}
                alerts={alerts}
                onViewMonitor={handleViewMonitor}
                onRunAllChecks={handleRunAllChecks}
                onRefreshData={fetchData}
                isRunningChecks={isRunningChecks}
            />
        </div>
    );
}
