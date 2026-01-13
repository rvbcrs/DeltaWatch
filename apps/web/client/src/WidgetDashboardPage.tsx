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
            if (statsData) {
                setStats({
                    totalMonitors: statsData.total_monitors || 0,
                    activeMonitors: statsData.active_monitors || 0,
                    checksToday: statsData.checks_24h || 0,
                    changesDetected: 0, // Will be calculated from history
                    errorsToday: statsData.errors_24h || 0,
                    successRate: statsData.checks_24h > 0 
                        ? Math.round(((statsData.checks_24h - statsData.errors_24h) / statsData.checks_24h) * 100) 
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
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }, [authFetch]);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [fetchData]);

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
                        <h1 className="text-2xl font-bold text-white">Widget Dashboard</h1>
                        <p className="text-sm text-gray-400">Customize your dashboard with widgets</p>
                    </div>
                </div>
            </div>

            {/* Widget Dashboard */}
            <WidgetDashboard
                stats={stats}
                monitors={monitors}
                recentChanges={recentChanges}
                onViewMonitor={handleViewMonitor}
                onRunAllChecks={handleRunAllChecks}
                onRefreshData={fetchData}
                isRunningChecks={isRunningChecks}
            />
        </div>
    );
}
