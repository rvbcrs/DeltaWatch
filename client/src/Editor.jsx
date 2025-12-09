// Editor doesn't use Layout! Removing the import which is causing issues.
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from './contexts/ToastContext';
import { ArrowLeft, Save, Play, Image, FileText, Check, AlertCircle, MousePointerClick } from 'lucide-react';
// import Layout from './Layout'; // REMOVED

function Editor() {
  console.log("Editor Component Loaded - Cache Bust");
  const [url, setUrl] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [selectedElement, setSelectedElement] = useState(null)
  const [interval, setInterval] = useState('1h')
  const navigate = useNavigate()
  const { id } = useParams()
  const [monitorType, setMonitorType] = useState('text'); // 'text' or 'visual'
  const { showToast } = useToast();
  
  const [isSelecting, setIsSelecting] = useState(true); // Default to selection mode

  const [name, setName] = useState('')

  useEffect(() => {
    if (id) {
        // Fetch existing monitor
        fetch(`http://localhost:3000/monitors/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.data) {
                    const monitor = data.data;
                    setName(monitor.name || '');
                    setUrl(monitor.url);
                    setProxyUrl(`http://localhost:3000/proxy?url=${encodeURIComponent(monitor.url)}`);
                    if (monitor.selector) {
                        setSelectedElement({
                            selector: monitor.selector,
                            text: monitor.selector_text || ''
                        });
                    }
                    setInterval(monitor.interval);
                    setMonitorType(monitor.type || 'text');
                }
            })
            .catch(err => alert('Failed to load monitor'));
    }
  }, [id])


  useEffect(() => {
    const handleMessage = (event) => {
      const { type, payload } = event.data;
      if (type === 'selected') {
        console.log('Selected:', payload)
        setSelectedElement(payload)
      } else if (type === 'deselected') {
          if (selectedElement && selectedElement.selector === payload) {
              setSelectedElement(null)
          }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedElement]);

  useEffect(() => {
    // Sync selection mode with iframe
    const iframe = document.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ 
            type: 'set_mode', 
            payload: { active: isSelecting } 
        }, '*');
    }
  }, [isSelecting, proxyUrl]); // Send when mode changes or url loads;

  const [isLoading, setIsLoading] = useState(false)

  const handleGo = async () => {
    if (!url) return;
    setIsLoading(true);
    // Force iframe reload by updating timestamp or similar if needed, 
    // but just setting proxyUrl triggers reload.
    // We can't easily know when iframe is done loading here since it's an iframe,
    // but we can at least show loading while the user waits for the initial "Go" action?
    // Actually, setting state is instant. The iframe load is what takes time.
    // We can add an onLoad handler to the iframe to clear loading state.
    const target = `http://localhost:3000/proxy?url=${encodeURIComponent(url)}`;
    setProxyUrl(target);
  }

  const handleSave = async () => {
    if (!url) return;
    if (monitorType === 'text' && !selectedElement) {
        alert('Please select an element to monitor.');
        return;
    }
    
    try {
        const urlParams = id ? `/${id}` : '';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(`http://localhost:3000/monitors${urlParams}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                url,
                selector: monitorType === 'text' ? selectedElement.selector : '',
                selector_text: monitorType === 'text' ? selectedElement.text : '',
                interval,
                type: monitorType
            })
        });
        const data = await response.json();
        if (data.message === 'success') {
            showToast('Monitor saved successfully', 'success');
            navigate('/'); 
        } else {
            showToast('Error saving monitor: ' + data.error, 'error');
        }
    } catch (e) {
        console.error(e);
        showToast('Error saving monitor: ' + e.message, 'error');
    }
  }

  // Effect to highlight element when iframe loads
  useEffect(() => {
     if (proxyUrl && selectedElement && id && monitorType === 'text') {
         // We need to wait for iframe to load, but we can't easily hook into onLoad for cross-origin (even proxied)
         // We'll just retry sending the message a few times
         const timer = setTimeout(() => {
             const iframe = document.querySelector('iframe');
             if (iframe && iframe.contentWindow) {
                 iframe.contentWindow.postMessage({
                     type: 'highlight',
                     payload: selectedElement.selector
                 }, '*');
             }
         }, 2000); // 2 seconds delay
         return () => clearTimeout(timer);
     }
  }, [proxyUrl, selectedElement, id, monitorType]);

  const getUiMode = () => {
    if (monitorType === 'visual') return 'visual';
    if (monitorType === 'text') {
        if (selectedElement && selectedElement.selector === 'body') return 'text_page';
        return 'text_element';
    }
    return 'text_element';
  };

  return (
    <div className="flex h-screen w-full bg-[#0d1117] flex-col text-white">
      <header className="bg-[#161b22] p-4 shadow-md flex flex-col space-y-4 z-30 relative border-b border-gray-800">
        <div className="flex items-center justify-between w-full max-w-6xl mx-auto">
             <div className="flex items-center space-x-4 w-full">
               <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft />
               </button>
               <h1 className="text-xl font-bold text-white shadow-sm whitespace-nowrap">
                  {id ? 'Edit Monitor' : 'New Monitor'}
               </h1>
               
               {/* Mode Switcher */}
               <div className="flex bg-[#0d1117] rounded-lg p-1 border border-gray-700">
                   <button 
                       onClick={() => { setMonitorType('visual'); setSelectedElement(null); }}
                       className={`px-3 py-1 text-sm rounded-md transition-all ${getUiMode() === 'visual' ? 'bg-[#1f6feb] text-white' : 'text-gray-400 hover:text-white'}`}
                   >
                       <Image size={16} className="inline-block mr-1" /> Visual
                   </button>
                   <button 
                       onClick={() => { setMonitorType('text'); setSelectedElement(null); }}
                       className={`px-3 py-1 text-sm rounded-md transition-all ${getUiMode() === 'text_element' ? 'bg-[#1f6feb] text-white' : 'text-gray-400 hover:text-white'}`}
                   >
                       <MousePointerClick size={16} className="inline-block mr-1" /> Text (Element)
                   </button>
                   <button 
                       onClick={() => { setMonitorType('text'); setSelectedElement({ selector: 'body', text: 'Full Page Text' }); }}
                       className={`px-3 py-1 text-sm rounded-md transition-all ${getUiMode() === 'text_page' ? 'bg-[#1f6feb] text-white' : 'text-gray-400 hover:text-white'}`}
                   >
                       <FileText size={16} className="inline-block mr-1" /> Text (Page)
                   </button>
               </div>

               <input 
                 type="text" 
                 placeholder="Name (optional)" 
                 className="p-2 bg-[#0d1117] border border-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600 w-48"
                 value={name}
                 onChange={(e) => setName(e.target.value)}
               />

               <input 
                 type="text" 
                 placeholder="Enter URL to monitor..." 
                 className="flex-1 p-2 bg-[#0d1117] border border-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-600"
                 value={url}
                 onChange={(e) => setUrl(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleGo()}
               />
               <button 
                 onClick={handleGo}
                 disabled={isLoading}
                 className={`px-6 py-2 rounded font-medium transition flex items-center gap-2 ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-[#1f6feb] hover:bg-blue-600 text-white'}`}
               >
                 {isLoading ? (
                     <>
                         <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                         Loading...
                     </>
                 ) : 'Go'}
               </button>
             </div>
        </div>
        
        {/* Helper Text */}
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between text-sm text-gray-400">
            <div>
                {monitorType === 'text' ? (
                    <div className="flex items-center justify-between w-full">
                        <p className="text-gray-400 text-sm flex items-center gap-2">
                            <span className="bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-wider">Tip</span>
                            {isSelecting ? "Click any element to select it." : "Interact with the page (click buttons, navigate)."}
                        </p>
                        
                        <div className="flex bg-[#21262d] rounded-lg p-1">
                            <button 
                                onClick={() => setIsSelecting(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isSelecting ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <MousePointerClick size={14} />
                                Select Mode
                            </button>
                            <button 
                                onClick={() => setIsSelecting(false)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isSelecting ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <MousePointerClick className="rotate-90" size={14} />
                                Interact Mode
                            </button>
                        </div>
                    </div>
                ) : (
                    <span className="text-blue-400">Visual mode active. We will take screenshots and alert you on visual changes.</span>
                )}
            </div>
             <div className="flex items-center space-x-2">
                 <label className="text-gray-400 text-sm">Check Interval:</label>
                 <select 
                     value={interval} 
                     onChange={(e) => setInterval(e.target.value)}
                     className="bg-[#0d1117] border border-gray-700 text-white rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                 >
                     <option value="1m">1 minute</option>
                     <option value="5m">5 minutes</option>
                     <option value="30m">30 minutes</option>
                     <option value="1h">1 hour</option>
                     <option value="8h">8 hours</option>
                     <option value="24h">24 hours</option>
                     <option value="1w">1 week</option>
                 </select>
                  <button 
                      onClick={handleSave}
                      disabled={!url || !proxyUrl || isLoading || (monitorType === 'text' && !selectedElement)}
                      className={`px-6 py-1 rounded transition font-medium ml-4 w-32 justify-center flex ${(!url || !proxyUrl || isLoading || (monitorType === 'text' && !selectedElement)) ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500'}`}
                  >
                      Save
                  </button>
             </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {selectedElement && monitorType === 'text' && (
            <div className="w-80 bg-[#161b22] border-r border-gray-800 p-4 shadow-lg flex flex-col overflow-y-auto z-20">
                <h2 className="text-lg font-semibold mb-2 text-white">Selected Element</h2>
                <div className="bg-[#0d1117] p-2 rounded mb-4 text-xs font-mono break-all border border-gray-700 text-gray-300">
                    {selectedElement.selector}
                </div>
                <div className="mb-4">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current Text</h3>
                    <p className="p-2 bg-[#0d1117] rounded border border-gray-700 mt-1 text-sm text-gray-200">{selectedElement.text}</p>
                </div>
                {/* Removed duplicate Interval and Save controls */}
            </div>
        )}

        <div className="flex-1 bg-[#0d1117] relative flex flex-col">
          {proxyUrl ? (
            <div className="flex-1 relative bg-gray-900">
                {isLoading && (
                   <div className="absolute inset-0 flex items-center justify-center bg-gray-900 z-10">
                       <div className="flex flex-col items-center">
                           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                           <p className="text-gray-400">Loading site...</p>
                       </div>
                   </div>
                )}
                
                {/* Visual/Page Mode Overlay */}
                {(monitorType === 'visual' || (monitorType === 'text' && selectedElement && selectedElement.selector === 'body')) && !isLoading && proxyUrl && (
                    <div className="absolute inset-0 z-20 bg-blue-900/10 pointer-events-auto flex items-center justify-center backdrop-blur-[1px] border-4 border-blue-500/50">
                        <div className="bg-[#161b22] p-6 rounded-lg shadow-2xl border border-blue-500/50 text-center max-w-md">
                            <div className="bg-blue-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                {monitorType === 'visual' ? (
                                    <Image size={32} className="text-blue-400" />
                                ) : (
                                    <FileText size={32} className="text-blue-400" />
                                )}
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">
                                {monitorType === 'visual' ? 'Visual Monitoring Active' : 'Full Page Text Monitoring'}
                            </h3>
                            <p className="text-gray-300">
                                {monitorType === 'visual' 
                                    ? 'We will monitor the entire page for visual changes.' 
                                    : 'We will monitor the full text content of the page.'}
                            </p>
                            <p className="text-gray-400 text-sm mt-4">Element selection is disabled in this mode.</p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 bg-white">
             <iframe 
                src={proxyUrl} 
                className="w-full h-full border-0"
                title="Website Preview"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                onLoad={(e) => {
                    // Sync mode whenever page loads/navigates
                    e.target.contentWindow.postMessage({ 
                        type: 'set_mode', 
                        payload: { active: isSelecting } 
                    }, '*');
                    
                    // Also re-send highlight if needed
                    if (selectedElement && monitorType === 'text') {
                        e.target.contentWindow.postMessage({
                             type: 'highlight',
                             payload: selectedElement.selector
                        }, '*');
                    }
                    setIsLoading(false); // Keep this from original iframe
                }}
             />
             {!proxyUrl && (
                 <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                     Enter a URL to verify selector
                 </div>
             )}
          </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
                Enter a URL to start
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Editor

