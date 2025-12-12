import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Edit, Plus, ExternalLink, Filter, ArrowDown, Pause, Play, ArrowRight, RefreshCw } from 'lucide-react'
import { useToast } from './contexts/ToastContext'
import { useDialog } from './contexts/DialogContext'

const TimeAgo = ({ date }) => {
    const [timeString, setTimeString] = useState('');
    
    useEffect(() => {
        const updateTime = () => {
            if (!date) return setTimeString('');
            const now = new Date();
            const past = new Date(date);
            const diffInSeconds = Math.floor((now - past) / 1000);
            
            if (diffInSeconds < 5) setTimeString('just now');
            else if (diffInSeconds < 60) setTimeString(`${diffInSeconds}s ago`);
            else if (diffInSeconds < 3600) setTimeString(`${Math.floor(diffInSeconds / 60)}m ago`);
            else if (diffInSeconds < 86400) setTimeString(`${Math.floor(diffInSeconds / 3600)}h ago`);
            else setTimeString(`${Math.floor(diffInSeconds / 86400)}d ago`);
        };
        
        updateTime();
        const interval = setInterval(updateTime, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [date]);
    
    return <span>{timeString}</span>;
};

function Dashboard() {
  const [monitors, setMonitors] = useState([])
  const [loading, setLoading] = useState(true)
  const [checkingMonitors, setCheckingMonitors] = useState(new Set())
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { confirm } = useDialog()
  const API_BASE = import.meta.env.DEV ? 'http://localhost:3000' : '';

  useEffect(() => {
    fetchMonitors()
    const interval = setInterval(() => fetchMonitors(true), 30000); // Poll every 30 seconds silently
    return () => clearInterval(interval);
  }, [])

  const fetchMonitors = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
        const res = await fetch(`${API_BASE}/monitors`)
        const data = await res.json()
        if (data.message === 'success') {
            setMonitors(data.data)
        }
    } catch (e) {
        console.error(e)
    } finally {
        if (!silent) setLoading(false)
    }
  }

  const handleDelete = async (id, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      const confirmed = await confirm({
          title: 'Delete Monitor',
          message: 'Are you sure you want to delete this monitor? This action cannot be undone.',
          confirmText: 'Delete',
          type: 'danger'
      });
      if (!confirmed) return;

      try {
          await fetch(`${API_BASE}/monitors/${id}`, { method: 'DELETE' })
          fetchMonitors()
          showToast('Monitor deleted successfully', 'success')
      } catch (e) {
          showToast('Failed to delete monitor', 'error')
      }
  }

  const handleCheck = async (monitor, e) => {
      console.log('Dashboard: Check clicked for', monitor.id);
      e.preventDefault();
      e.stopPropagation();
      
      if (checkingMonitors.has(monitor.id)) return;

      setCheckingMonitors(prev => {
          const newSet = new Set(prev);
          newSet.add(monitor.id);
          return newSet;
      });

      console.log('Dashboard: Sending request...');
      try {
          const res = await fetch(`${API_BASE}/monitors/${monitor.id}/check`, { method: 'POST' });
          console.log('Dashboard: Response status:', res.status);
          if(res.ok) {
              await fetchMonitors(); // Refresh list immediately
              showToast('Check completed successfully', 'success'); 
          }
          else {
              const text = await res.text();
              showToast('Check failed: ' + text, 'error');
          }
      } catch(err) { 
          console.error('Dashboard: Fetch error:', err);
          showToast(err.message, 'error'); 
      } finally {
          setCheckingMonitors(prev => {
              const newSet = new Set(prev);
              newSet.delete(monitor.id);
              return newSet;
          });
      }
  }

  const handleEdit = (monitor, e) => {
      if (e) {
          e.preventDefault();
          e.stopPropagation();
      }
      navigate(`/edit/${monitor.id}`)
  }
  
  // Quick Edit Interval Modal logic (if needed, but moving to visual editor mostly)
  // We can keep the quick edit for interval if desired, but user asked for visual edit mostly.
  // For now let's use the Visual Editor for everything to reduce complexity.
  
  const handleToggleStatus = async (monitor, e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      try {
          // Optimistic update
          setMonitors(monitors.map(m => m.id === monitor.id ? { ...m, active: !m.active } : m));
          
          await fetch(`${API_BASE}/monitors/${monitor.id}/status`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ active: !monitor.active })
          });
      } catch (e) {
          console.error(e);
          fetchMonitors(); // Revert on error
      }
  }
  

  const timeAgo = (dateParam) => {
    if (!dateParam) return null;
    const date = typeof dateParam === 'object' ? dateParam : new Date(dateParam);
    const today = new Date();
    const seconds = Math.round((today - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);

    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }

  const formatDate = (dateString) => {
      if (!dateString) return 'Unknown Date';
      try {
          // Handle SQLite "YYYY-MM-DD HH:MM:SS" -> ISO
          const isoString = dateString.toString().replace(' ', 'T');
          const date = new Date(isoString);
          if (isNaN(date.getTime())) return 'Invalid Date';
          return date.toLocaleString();
      } catch (e) {
          return 'Error Date';
      }
  }

  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Deltas</h1>
            <Link to="/new" className="bg-[#1f6feb] hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors">
                <Plus size={16} /> New
            </Link>
        </div>



        {loading ? (
             <div className="text-center py-10 text-gray-500">Loading monitors...</div>
        ) : (
            <div className="space-y-2">
                {monitors.length === 0 && (
                    <div className="text-center py-20 bg-[#161b22] rounded-lg border border-dashed border-gray-700">
                        <h3 className="text-lg font-medium text-gray-300">No monitors yet</h3>
                        <p className="text-gray-500 mb-4">Get started by creating your first monitor.</p>
                        <Link to="/new" className="text-blue-400 hover:text-blue-300 hover:underline">Create Monitor</Link>
                    </div>
                )}

                {monitors.map(monitor => (
                    <Link 
                        to={`/monitor/${monitor.id}`}
                        key={monitor.id} 
                        className="bg-[#161b22] border border-gray-800 hover:border-gray-600 rounded-lg p-4 flex flex-col md:flex-row md:items-center justify-between transition-colors group block"
                    >
                        <div className="flex items-start gap-4 flex-1 min-w-0 w-full">
                            {/* Screenshot Thumbnail - Only for Visual Type */}
                             {monitor.type === 'visual' && (
                                 <div 
                                    className="w-24 h-16 bg-gray-800 rounded border border-gray-700 overflow-hidden flex-shrink-0 relative group/img cursor-pointer transition-opacity hover:opacity-80" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (monitor.last_screenshot) {
                                            window.open(`${API_BASE}/static/screenshots/${monitor.last_screenshot.split('/').pop()}`, '_blank');
                                        }
                                    }}
                                 >
                                     {monitor.last_screenshot ? (
                                         <img 
                                            src={`${API_BASE}/static/screenshots/${monitor.last_screenshot.split('/').pop()}`} 
                                            alt="Monitor" 
                                            className="w-full h-full object-cover"
                                         />
                                     ) : (
                                         <div className="flex items-center justify-center w-full h-full text-gray-600">
                                             <div className="bg-gray-700 w-8 h-8 rounded-full flex items-center justify-center">
                                                 <span className="text-xs">No Img</span>
                                             </div>
                                         </div>
                                     )}
                                 </div>
                             )}

                             <div className="min-w-0 flex flex-col gap-1 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border ${
                                        monitor.type === 'visual' ? 'bg-blue-900/30 text-blue-400 border-blue-900' : 
                                        (monitor.selector === 'body' ? 'bg-purple-900/30 text-purple-400 border-purple-900' : 'bg-green-900/30 text-green-400 border-green-900')
                                    }`}>
                                        {monitor.type === 'visual' ? 'VISUAL' : (monitor.selector === 'body' ? 'FULL PAGE' : 'TEXT')}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider border bg-red-500/20 text-red-300 border-red-500/30">
                                        {monitor.interval}
                                    </span>
                                    <h3 className="text-white font-bold text-lg truncate max-w-[200px] md:max-w-xs" title={monitor.name || monitor.url}>
                                        {monitor.name || (monitor.url ? new URL(monitor.url).hostname : 'Untitled')}
                                    </h3>
                                </div>
                                
                                {monitor.type === 'text' && (
                                    <p className="text-gray-400 text-sm truncate" title={monitor.selector_text}>
                                        {monitor.selector_text || 'No selector text'}
                                    </p>
                                )}
                                <p className="text-gray-500 text-xs truncate font-mono">
                                    {monitor.url}
                                </p>
                             </div>
                        </div>

                        <div className="flex items-center justify-between md:justify-end gap-4 md:gap-6 mt-4 md:mt-0 w-full md:w-auto border-t md:border-t-0 border-gray-800 pt-3 md:pt-0">
                                <div className="text-left md:text-right">
                                <div className="flex items-center gap-1 justify-start md:justify-end mb-1">
                                    {/* History bars */}
                                    <div className="flex gap-[2px]">
                                        {[...Array(20)].map((_, i) => {
                                            const historyLength = monitor.history ? monitor.history.length : 0;
                                            const offset = 20 - historyLength;
                                            const historyIndex = i - offset;
                                            const record = historyIndex >= 0 ? monitor.history[historyIndex] : null;

                                            let colorClass = 'bg-gray-800'; // Empty slot
                                            if (record) {
                                                if (record.status === 'unchanged') colorClass = 'bg-green-500';
                                                else if (record.status === 'changed') colorClass = 'bg-yellow-500';
                                                else if (record.status === 'error') colorClass = 'bg-red-500';
                                            }

                                            return (
                                                <div 
                                                    key={i} 
                                                    className={`w-1 h-4 rounded-sm ${colorClass}`}
                                                    title={record ? `${new Date(formatDate(record.created_at)).toLocaleString()} - ${record.status}` : 'No Data'}
                                                />
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="text-xs text-gray-400 mt-2 flex items-center gap-4 justify-start md:justify-end">
                                    <span className="flex items-center gap-1" title={formatDate(monitor.last_check) ? new Date(formatDate(monitor.last_check)).toLocaleString() : 'Never'}>
                                        <div className={`w-2 h-2 rounded-full ${monitor.active ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                                        <TimeAgo date={monitor.last_check} />
                                    </span>
                                </div>
                            </div>

                             <div className="flex gap-2"> {/* Removed opacity-0 group-hover:opacity-100 logic for mobile usage and simpler UI */}
                                <button 
                                    onClick={(e) => handleCheck(monitor, e)} 
                                    disabled={checkingMonitors.has(monitor.id)}
                                    className={`p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors ${checkingMonitors.has(monitor.id) ? 'cursor-not-allowed opacity-50' : ''}`} 
                                    title="Check Now"
                                >
                                    <RefreshCw size={16} className={checkingMonitors.has(monitor.id) ? 'animate-spin' : ''} />
                                </button>
                                <button onClick={(e) => handleEdit(monitor, e)} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors" title="Edit">
                                    <Edit size={16} />
                                </button>


                                <button onClick={(e) => handleDelete(monitor.id, e)} className="p-2 text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                                <button 
                                    onClick={(e) => handleToggleStatus(monitor, e)} 
                                    className={`p-2 rounded transition-colors ${!monitor.active ? 'text-green-400 bg-green-900/30 hover:bg-green-900/50 border border-green-700/50' : 'text-orange-400 bg-orange-900/20 hover:bg-orange-900/30 hover:text-orange-300'}`}
                                    title={!monitor.active ? "Resume" : "Pause"}
                                >
                                    {!monitor.active ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}
                                </button>
                             </div>
                        </div>
                    </Link>
                ))}
            </div>
        )}
        
        {/* Right Sidebar Mockup (could be separate component) */}
        {/* For now let's keep it simple as requested, maybe add the right sidebar later or just fit it in grid if screen large enough */}
    </div>
  )
}

export default Dashboard
