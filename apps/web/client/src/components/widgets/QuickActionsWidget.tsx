import { Plus, Play, RefreshCw, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

interface QuickActionsWidgetProps {
    onRunAllChecks?: () => void;
    onRefreshData?: () => void;
    isRunningChecks?: boolean;
}

export function QuickActionsWidget({ 
    onRunAllChecks, 
    onRefreshData,
    isRunningChecks = false 
}: QuickActionsWidgetProps) {
    const navigate = useNavigate();
    const { t } = useTranslation();

    const actions = [
        {
            label: t('dashboard.new_delta'),
            icon: <Plus className="w-5 h-5" />,
            onClick: () => navigate('/new'),
            color: 'bg-green-600 hover:bg-green-700',
            primary: true
        },
        {
            label: 'Run All Checks',
            icon: isRunningChecks ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />,
            onClick: onRunAllChecks,
            color: 'bg-blue-600 hover:bg-blue-700',
            disabled: isRunningChecks
        },
        {
            label: 'Refresh Data',
            icon: <RefreshCw className="w-5 h-5" />,
            onClick: onRefreshData,
            color: 'bg-gray-700 hover:bg-gray-600'
        },
        {
            label: t('sidebar.settings'),
            icon: <Settings className="w-5 h-5" />,
            onClick: () => navigate('/settings'),
            color: 'bg-gray-700 hover:bg-gray-600'
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-2">
            {actions.map((action, index) => (
                <button
                    key={index}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-white font-medium transition-colors ${action.color} ${
                        action.disabled ? 'opacity-50 cursor-not-allowed' : ''
                    } ${action.primary ? 'col-span-2' : ''}`}
                >
                    {action.icon}
                    <span className="text-sm">{action.label}</span>
                </button>
            ))}
        </div>
    );
}

export default QuickActionsWidget;
