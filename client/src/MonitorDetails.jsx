import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, RefreshCw, Image, FileText, AlertTriangle, Trash2, Play } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import * as Diff from 'diff';
import { useToast } from './contexts/ToastContext';
import { useDialog } from './contexts/DialogContext';

function MonitorDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [monitor, setMonitor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isChecking, setIsChecking] = useState(false);
    const [history, setHistory] = useState([]);
    const { showToast } = useToast();
    const { confirm } = useDialog();

    const fetchMonitor = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await fetch(`http://localhost:3000/monitors?t=${Date.now()}`);
            if (res.ok) {
                 const data = await res.json();
                 if (data.message === 'success') {
                    const found = data.data.find(m => m.id === parseInt(id));
                    if (found) {
                        setMonitor(found);
                        const graphData = found.history.map(h => {
                             // Skip errors
                             if (h.status === 'error') return null;

                             let valStr = h.value || "0";
                             if (valStr.includes(',') && (!valStr.includes('.') || valStr.indexOf(',') > valStr.lastIndexOf('.'))) {
                                  valStr = valStr.replace(/\./g, '').replace(',', '.');
                             } else {
                                  valStr = valStr.replace(/,/g, '');
                             }
                             const val = parseFloat(valStr.replace(/[^0-9.-]+/g,""));
                             
                             // If completely invalid number, treat as null (gap) or skip? 
                             // Let's assume valid status means valid value, but safeguard.
                             
                             return {
                                 id: h.id,
                                 date: new Date(h.created_at).toLocaleString(),
                                 timestamp: new Date(h.created_at).getTime(),
                                 value: isNaN(val) ? null : val, // Use null for gaps if NaN
                                 raw: h.value
                             };
                        }).filter(item => item !== null).reverse();
                        setHistory(graphData);
                    }
                 }
            }
        } catch (e) {
            console.error(e);
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        fetchMonitor();
    }, [id]);

    const handleRunCheck = async () => {
        if (isChecking) return;
        setIsChecking(true);
        console.log('Details: Check clicked');
        
        console.log('Details: Sending request...');
        try {
            const res = await fetch(`http://localhost:3000/monitors/${id}/check`, { method: 'POST' });
            console.log('Details: Response status:', res.status);
            if (res.ok) {
                 showToast('Check completed successfully', 'success');
                 await fetchMonitor(true); 
            } else {
                const err = await res.text();
                showToast('Error running check: ' + err, 'error');
            }
        } catch(e) { 
            console.error(e); 
            showToast('Error: ' + e.message, 'error'); 
        } finally { setIsChecking(false); }
    };

    const handleDeleteHistory = async (historyId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        console.log("Attempting to delete history ID:", historyId);
        if (!historyId) {
            showToast("Error: Cannot delete item without an ID.", 'error');
            return;
        }
        
        try {
            const res = await fetch(`http://localhost:3000/monitors/${id}/history/${historyId}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                 const newHistory = monitor.history.filter(h => h.id !== historyId);
                 setMonitor(prev => ({ ...prev, history: newHistory }));
                 setHistory(prev => prev.filter(h => h.id !== historyId));
                 showToast('History item deleted', 'success');
            } else {
                const errText = await res.text();
                console.error("Delete failed:", errText);
                showToast("Failed to delete: " + errText, 'error');
            }
        } catch (e) {
            console.error("Network error deleting:", e);
            showToast("Network error: " + e.message, 'error');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
    if (!monitor) return <div className="p-8 text-center text-red-500">Monitor not found</div>;

    return (
        <div className="flex h-full flex-col bg-[#0d1117] text-white p-6 overflow-y-auto">
            <div className="flex items-center gap-4 mb-6">
                <Link to="/" className="text-gray-400 hover:text-white transition-colors">
                    <ArrowLeft size={24} />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        {monitor.name || "Monitor Details"}
                        <span className={`px-2 py-0.5 rounded textxs uppercase font-bold tracking-wider border ${monitor.type === 'visual' ? 'bg-blue-900/30 text-blue-400 border-blue-900' : 'bg-green-900/30 text-green-400 border-green-900'}`}>
                            {monitor.type}
                        </span>
                    </h1>
                    <a href={monitor.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline text-sm flex items-center gap-1">
                        {monitor.url} <ExternalLink size={12} />
                    </a>
                </div>
                <Link to={`/edit/${monitor.id}`} className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded border border-gray-700 transition-colors">
                    Edit
                </Link>
                <button 
                    onClick={handleRunCheck} 
                    disabled={isChecking}
                    className={`bg-[#1f6feb] hover:bg-blue-600 text-white px-4 py-2 rounded border border-blue-600 transition-colors flex items-center gap-2 ${isChecking ? 'opacity-75 cursor-not-allowed' : ''}`}
                >
                    <RefreshCw size={16} className={isChecking ? 'animate-spin' : ''} /> 
                    {isChecking ? 'Checking...' : 'Check Now'}
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Stats Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-[#161b22] p-6 rounded-lg border border-gray-800">
                        <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Current Status</h3>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="text-gray-500 text-xs uppercase">Latest Value</label>
                                <div className="text-2xl font-mono text-white break-all">
                                {monitor.selector === 'body' && monitor.last_value 
                                    ? `Full Page Content (${monitor.last_value.length} chars)`
                                    : (monitor.last_value || "No Data")}
                                </div>
                            </div>
                             <div>
                                <label className="text-gray-500 text-xs uppercase">Last Check</label>
                                <div className="text-white">
                                    {new Date(monitor.last_check).toLocaleString()}
                                </div>
                            </div>
                             <div>
                                <label className="text-gray-500 text-xs uppercase">Interval</label>
                                <div className="text-white">
                                    {monitor.interval}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Graph Card */}
                {monitor.type !== 'visual' && monitor.selector !== 'body' && (
                <div className="lg:col-span-2 bg-[#161b22] p-6 rounded-lg border border-gray-800 flex flex-col">
                     <h3 className="text-gray-400 text-sm font-medium mb-4 uppercase tracking-wider">Value History</h3>
                     <div className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={history}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                                <XAxis 
                                    dataKey="date" 
                                    stroke="#8b949e" 
                                    fontSize={12}
                                    tickFormatter={(val) => new Date(val).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} 
                                />
                                <YAxis 
                                    stroke="#8b949e" 
                                    fontSize={12} 
                                    domain={['auto', 'auto']} 
                                    tickFormatter={(val) => val.toLocaleString()}
                                />
                                <Tooltip 
                                    contentStyle={{ backgroundColor: '#161b22', borderColor: '#30363d', color: '#c9d1d9' }}
                                    itemStyle={{ color: '#58a6ff' }}
                                    labelStyle={{ color: '#8b949e' }}
                                    formatter={(value) => [value.toLocaleString(), 'Value']}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="value" 
                                    stroke="#58a6ff" 
                                    strokeWidth={2}
                                    dot={{ fill: '#58a6ff', r: 4 }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                     </div>
                </div>
                )}

                {/* History List */}
                <div className="lg:col-span-3 bg-[#161b22] px-6 py-6 rounded-lg border border-gray-800">
                    <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
                        <h3 className="text-white font-bold text-lg">Change time</h3>
                        <div className="text-sm text-gray-400">
                           {/* Placeholder for potential sort/filter dropdown */}
                           Differences in a compact view
                        </div>
                    </div>

                    <div className="space-y-1">
                        {[...monitor.history].reverse().map((record, i) => {
                             const date = new Date(record.created_at);
                             const isError = record.status === 'error';
                             const isChanged = record.status === 'changed';
                             
                             return (
                                <div key={i} className={`flex items-start gap-4 p-4 rounded-md transition-colors group ${isError ? 'bg-yellow-900/10 hover:bg-yellow-900/20' : 'hover:bg-gray-800/50'}`}>
                                    {/* Date Column */}
                                    <div className="w-32 flex-shrink-0 text-sm">
                                        <div className={`font-medium ${isError ? 'text-yellow-500' : 'text-gray-400'}`}>
                                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                                        </div>
                                        <div className="flex gap-2 mt-2 text-gray-400">
                                            {isError && <AlertTriangle size={14} className="text-red-500" />}
                                            {monitor.type === 'visual' && <Image size={14} />}
                                            <FileText size={14} />
                                        </div>
                                    </div>

                                    {/* Content Column */}
                                    <div className="flex-1 min-w-0">
                                        {isError ? (
                                            <div className="flex items-start gap-2 text-red-400">
                                                <div className="w-0.5 self-stretch bg-red-500 rounded-full mr-1"></div>
                                                <p className="font-medium">{record.value || "The server returned an error response"}</p>
                                                <p className="font-medium">{record.value || "The server returned an error response"}</p>
                                            </div>
                                        ) : (
                                            <div className="text-gray-300">
                                                {monitor.type === 'visual' ? (
                                                    <div className="space-y-4">
                                                        {record.screenshot_path ? (
                                                            <div className="flex gap-4 overflow-x-auto pb-2">
                                                                {record.prev_screenshot_path && (
                                                                    <div className="flex-shrink-0">
                                                                        <span className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Before</span>
                                                                        <div 
                                                                            className="w-48 h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
                                                                            onClick={() => window.open(`http://localhost:3000/static/screenshots/${record.prev_screenshot_path.split('/').pop()}`, '_blank')}
                                                                        >
                                                                            <img src={`http://localhost:3000/static/screenshots/${record.prev_screenshot_path.split('/').pop()}`} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                                <div className="flex-shrink-0">
                                                                    <span className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">After</span>
                                                                    <div 
                                                                        className="w-48 h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
                                                                        onClick={() => window.open(`http://localhost:3000/static/screenshots/${record.screenshot_path.split('/').pop()}`, '_blank')}
                                                                    >
                                                                        <img src={`http://localhost:3000/static/screenshots/${record.screenshot_path.split('/').pop()}`} className="w-full h-full object-cover" />
                                                                    </div>
                                                                </div>
                                                                 {record.diff_screenshot_path && (
                                                                    <div className="flex-shrink-0">
                                                                        <span className="text-xs text-gray-500 mb-1 block uppercase tracking-wider">Diff</span>
                                                                        <div 
                                                                            className="w-48 h-32 bg-gray-900 rounded border border-gray-700 overflow-hidden cursor-pointer hover:border-blue-500 transition-colors"
                                                                            onClick={() => window.open(`http://localhost:3000/static/screenshots/${record.diff_screenshot_path.split('/').pop()}`, '_blank')}
                                                                        >
                                                                            <img src={`http://localhost:3000/static/screenshots/${record.diff_screenshot_path.split('/').pop()}`} className="w-full h-full object-cover" />
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            // For old records or unchanging checks where we didn't save screenshot
                                                            <span className="text-gray-500 italic text-sm">Visual check OK</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-xs text-gray-500 uppercase tracking-wider">Recorded Text Content</span>
                                                            {isChanged && i < monitor.history.length - 1 && (
                                                                <button 
                                                                    onClick={() => {
                                                                        const el = document.getElementById(`diff-${record.id}`);
                                                                        if(el) el.classList.toggle('hidden');
                                                                    }}
                                                                    className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded hover:bg-blue-900/50 transition-colors"
                                                                >
                                                                    Toggle Diff
                                                                </button>
                                                            )}
                                                        </div>
                                                        <div className="p-3 bg-gray-900 rounded border border-gray-800 font-mono text-xs overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                                                            {record.value || <span className="text-gray-500 italic">No text content</span>}
                                                        </div>
                                                        
                                                        {isChanged && i < monitor.history.length - 1 && (() => {
                                                            const originalIndex = monitor.history.length - 1 - i;
                                                            const olderValue = originalIndex > 0 ? monitor.history[originalIndex - 1].value : '';
                                                            return (
                                                            <div id={`diff-${record.id}`} className="hidden mt-4">
                                                                <span className="text-xs text-gray-500 uppercase tracking-wider block mb-2">Change Diff</span>
                                                                <div className="bg-black rounded border border-gray-700 p-2 text-xs font-mono whitespace-pre-wrap">
                                                                    {Diff.diffLines(olderValue || '', record.value || '').map((part, idx) => {
                                                                        if (!part.added && !part.removed) return null;
                                                                        return (
                                                                            <span key={idx} className={part.added ? 'bg-green-900/40 text-green-200 block px-1' : 'bg-red-900/40 text-red-200 block px-1'}>
                                                                                {part.value}
                                                                            </span>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                            );
                                                        })()}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Action Column */}
                                    <button 
                                        onClick={(e) => handleDeleteHistory(record.id, e)}
                                        className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        title="Delete check"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                             );
                        })}
                    </div>
                </div>

            </div>
            
             {/* Removed old table */}
        </div>
    );
}

export default MonitorDetails;
