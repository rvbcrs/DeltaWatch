import { ReactNode } from 'react';
import { X, ChevronUp, ChevronDown, Minimize2, Maximize2 } from 'lucide-react';

interface DashboardWidgetProps {
    id: string;
    title: string;
    icon?: ReactNode;
    children: ReactNode;
    onRemove?: () => void;
    isEditMode?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    onMoveUp?: () => void;
    onMoveDown?: () => void;
    className?: string;
}

export function DashboardWidget({ 
    title, 
    icon, 
    children, 
    onRemove, 
    isEditMode = false,
    isCollapsed = false,
    onToggleCollapse,
    onMoveUp,
    onMoveDown,
    className = ''
}: DashboardWidgetProps) {
    return (
        <div className={`bg-[#161b22] border border-gray-700 rounded-xl overflow-hidden h-full flex flex-col ${className}`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-[#1c2128]`}>
                <div className="flex items-center gap-2">
                    {icon && <span className="text-lg">{icon}</span>}
                    <h3 className="font-semibold text-white text-sm">{title}</h3>
                </div>
                <div className="flex items-center gap-1">
                    {/* Edit mode controls */}
                    {isEditMode && (
                        <>
                            {onMoveUp && (
                                <button 
                                    onClick={onMoveUp}
                                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                                    title="Move Up"
                                >
                                    <ChevronUp className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                            {onMoveDown && (
                                <button 
                                    onClick={onMoveDown}
                                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                                    title="Move Down"
                                >
                                    <ChevronDown className="w-4 h-4 text-gray-400" />
                                </button>
                            )}
                            {onRemove && (
                                <button 
                                    onClick={onRemove}
                                    className="p-1 hover:bg-red-900/30 rounded transition-colors group"
                                    title="Remove Widget"
                                >
                                    <X className="w-4 h-4 text-gray-400 group-hover:text-red-400" />
                                </button>
                            )}
                        </>
                    )}
                    {/* Collapse toggle (always visible) */}
                    {onToggleCollapse && (
                        <button 
                            onClick={onToggleCollapse}
                            className="p-1 hover:bg-gray-700 rounded transition-colors"
                            title={isCollapsed ? "Expand" : "Collapse"}
                        >
                            {isCollapsed ? (
                                <Maximize2 className="w-4 h-4 text-gray-400" />
                            ) : (
                                <Minimize2 className="w-4 h-4 text-gray-400" />
                            )}
                        </button>
                    )}
                </div>
            </div>
            
            {/* Content */}
            {!isCollapsed && (
                <div className="flex-1 p-4 overflow-auto">
                    {children}
                </div>
            )}
        </div>
    );
}

export default DashboardWidget;
