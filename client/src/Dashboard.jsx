import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trash2, Edit, Plus, ExternalLink, Filter, ArrowDown, Pause, Play } from 'lucide-react'

function Dashboard() {
  const [monitors, setMonitors] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const [editingMonitor, setEditingMonitor] = useState(null)
  const [editInterval, setEditInterval] = useState('1h')

  useEffect(() => {
    fetchMonitors()
  }, [])

  const fetchMonitors = async () => {
    setLoading(true)
    try {
        const res = await fetch('http://localhost:3000/monitors')
        const data = await res.json()
        if (data.message === 'success') {
            setMonitors(data.data)
        }
    } catch (e) {
        console.error(e)
    } finally {
        setLoading(false)
    }
  }

  const handleDelete = async (id) => {
      if (!confirm('Are you sure you want to delete this monitor?')) return;
      try {
          await fetch(`http://localhost:3000/monitors/${id}`, { method: 'DELETE' })
          fetchMonitors()
      } catch (e) {
          alert('Failed to delete')
      }
  }

  const handleEdit = (monitor) => {
      navigate(`/edit/${monitor.id}`)
  }
  
  // Quick Edit Interval Modal logic (if needed, but moving to visual editor mostly)
  // We can keep the quick edit for interval if desired, but user asked for visual edit mostly.
  // For now let's use the Visual Editor for everything to reduce complexity.
  
  const handleToggleStatus = async (monitor) => {
      try {
          // Optimistic update
          setMonitors(monitors.map(m => m.id === monitor.id ? { ...m, active: !m.active } : m));
          
          await fetch(`http://localhost:3000/monitors/${monitor.id}/status`, {
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
    return `${days}d ago`;
  }
  return (
    <div className="h-full flex flex-col">
       <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Monitors.</h1>
            <Link to="/new" className="bg-[#1f6feb] hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 text-sm font-medium transition-colors">
                <Plus size={16} /> New
            </Link>
        </div>

        {/* Filters Bar Mockup */}
        <div className="bg-[#161b22] p-4 rounded-lg border border-gray-800 flex flex-wrap gap-4 items-center mb-6">
            <div className="flex items-center gap-2">
                <input type="checkbox" className="rounded bg-gray-700 border-gray-600 text-blue-500 focus:ring-0" />
                <span className="text-sm text-gray-400">0 / {monitors.length}</span>
            </div>
            <button className="text-sm text-gray-400 flex items-center gap-1 hover:text-white px-3 py-1 bg-gray-800 rounded border border-gray-700">
                Show groups
            </button>
            <div className="flex-1"></div>
            <div className="relative">
                <input 
                    type="text" 
                    placeholder="Search by name or url" 
                    className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded px-3 py-1 focus:outline-none focus:border-blue-500 w-64"
                />
            </div>
             <button className="text-sm text-gray-400 flex items-center gap-1 hover:text-white px-3 py-1 bg-gray-800 rounded border border-gray-700">
                <Filter size={14} /> Filter
            </button>
            <button className="text-sm text-gray-400 flex items-center gap-1 hover:text-white px-3 py-1 bg-gray-800 rounded border border-gray-700">
                <ArrowDown size={14} /> Down first
            </button>
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
                    <div key={monitor.id} className="bg-[#161b22] border border-gray-800 hover:border-gray-600 rounded-lg p-4 flex items-center justify-between transition-colors group">
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                             {/* Status Indicator */}
                             <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></div>
                             
                             <div className="min-w-0">
                                <h3 className="text-white font-medium text-sm truncate pr-4" title={monitor.selector_text || 'No Text'}>
                                    {monitor.selector_text || 'No text content'}
                                </h3>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                    <span className="bg-gray-800 px-1 rounded text-gray-400 border border-gray-700">HTTP</span>
                                    <a href={monitor.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 truncate max-w-[300px]">
                                        {monitor.url}
                                    </a>
                                </div>
                             </div>
                        </div>

                        <div className="flex items-center gap-6">
                                <div className="text-right">
                                <div className="flex items-center gap-1 justify-end mb-1">
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
                                                    className={`w-1 h-3 rounded-sm ${colorClass}`}
                                                    title={record ? `${record.status} - ${new Date(record.created_at).toLocaleString()}` : 'No data'}
                                                ></div>
                                            )
                                        })}
                                    </div>
                                </div>

                                <div className="text-xs text-gray-500 flex items-center justify-end gap-3 mt-1">
                                     <span title="Last Checked time">
                                        Checked: {monitor.last_check ? timeAgo(monitor.last_check) : 'Never'}
                                     </span>
                                     <span className="text-gray-600">|</span>
                                     <span title={`Last Change: ${monitor.last_change ? new Date(monitor.last_change).toLocaleString() : 'Never'}`}>
                                        Changed: {monitor.last_change ? timeAgo(monitor.last_change) : 'Never'}
                                     </span>
                                </div>
                            </div>

                             <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(monitor)} className="p-2 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded transition-colors" title="Edit">
                                    <Edit size={16} />
                                </button>


                                <button onClick={() => handleDelete(monitor.id)} className="p-2 text-gray-400 hover:text-red-400 bg-gray-800 hover:bg-gray-700 rounded transition-colors" title="Delete">
                                    <Trash2 size={16} />
                                </button>
                                <button 
                                    onClick={() => handleToggleStatus(monitor)} 
                                    className={`p-2 rounded transition-colors ${monitor.active === 0 ? 'text-yellow-500 bg-yellow-900/20 hover:bg-yellow-900/30' : 'text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700'}`}
                                    title={monitor.active === 0 ? "Resume" : "Pause"}
                                >
                                    {monitor.active === 0 ? <Play size={16} /> : <Pause size={16} />}
                                </button>
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        )}
        
        {/* Right Sidebar Mockup (could be separate component) */}
        {/* For now let's keep it simple as requested, maybe add the right sidebar later or just fit it in grid if screen large enough */}
    </div>
  )
}

export default Dashboard
