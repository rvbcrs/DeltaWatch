import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

function Editor() {
  const [url, setUrl] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [selectedElement, setSelectedElement] = useState(null)
  const [interval, setInterval] = useState('1h')
  const navigate = useNavigate()
  const { id } = useParams()

  useEffect(() => {
    if (id) {
        // Fetch existing monitor
        fetch(`http://localhost:3000/monitors/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data.message === 'success') {
                    const monitor = data.data;
                    setUrl(monitor.url);
                    setProxyUrl(`http://localhost:3000/proxy?url=${encodeURIComponent(monitor.url)}`);
                    setInterval(monitor.interval);
                    setSelectedElement({
                        selector: monitor.selector,
                        text: monitor.selector_text
                    });
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

  const handleGo = () => {
    if (!url) return;
    const target = `http://localhost:3000/proxy?url=${encodeURIComponent(url)}`;
    setProxyUrl(target);
  }

  const handleSave = async () => {
    if (!selectedElement || !url) return;
    
    try {
        const urlParams = id ? `/${id}` : '';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(`http://localhost:3000/monitors${urlParams}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                selector: selectedElement.selector,
                selector_text: selectedElement.text,
                interval
            })
        });
        const data = await response.json();
        if (data.message === 'success') {
            alert('Monitor saved!');
            navigate('/'); // Go back to dashboard
        } else {
            alert('Error saving monitor: ' + data.error);
        }
    } catch (e) {
        alert('Error saving monitor: ' + e.message);
    }
  }

  // Effect to highlight element when iframe loads
  useEffect(() => {
     if (proxyUrl && selectedElement && id) {
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
  }, [proxyUrl, selectedElement, id]);

  return (
    <div className="flex h-screen w-screen bg-[#0d1117] flex-col text-white">
      <header className="bg-[#161b22] p-4 shadow-md flex items-center justify-between z-10 sticky top-0 border-b border-gray-800">
        <div className="flex items-center space-x-4 w-full max-w-6xl mx-auto">
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
             <ArrowLeft />
          </button>
          <h1 className="text-xl font-bold text-white shadow-sm">
             {id ? 'Edit Monitor' : 'New Monitor'}
          </h1>
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
            className="bg-[#1f6feb] text-white px-6 py-2 rounded hover:bg-blue-600 transition font-medium"
          >
            Go
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {selectedElement && (
            <div className="w-80 bg-[#161b22] border-r border-gray-800 p-4 shadow-lg flex flex-col overflow-y-auto z-20">
                <h2 className="text-lg font-semibold mb-2 text-white">Selected Element</h2>
                <div className="bg-[#0d1117] p-2 rounded mb-4 text-xs font-mono break-all border border-gray-700 text-gray-300">
                    {selectedElement.selector}
                </div>
                <div className="mb-4">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Current Text</h3>
                    <p className="p-2 bg-[#0d1117] rounded border border-gray-700 mt-1 text-sm text-gray-200">{selectedElement.text}</p>
                </div>
                <div className="mb-4">
                    <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Check Interval</h3>
                    <select 
                        className="w-full p-2 bg-[#0d1117] border border-gray-700 text-white rounded mt-1 focus:outline-none focus:border-blue-500"
                        value={interval}
                        onChange={(e) => setInterval(e.target.value)}
                    >
                        <option value="1m">1 minute</option>
                        <option value="5m">5 minutes</option>
                        <option value="30m">30 minutes</option>
                        <option value="1h">1 hour</option>
                        <option value="8h">8 hours</option>
                        <option value="24h">24 hours</option>
                        <option value="1w">1 week</option>
                    </select>
                </div>
                <div className="flex-1"></div>
                <button 
                    onClick={handleSave}
                    className="w-full bg-green-600 text-white py-2 rounded mb-2 hover:bg-green-700 font-bold transition-colors shadow-lg shadow-green-900/20"
                >
                    Save Monitor
                </button>
            </div>
        )}

        <div className="flex-1 bg-[#0d1117] relative flex flex-col">
          {proxyUrl ? (
            <div className="flex-1 bg-white relative">
                 {/* Overlay hint if needed, or just clean view */}
                <iframe 
                    src={proxyUrl} 
                    className="w-full h-full border-none"
                    title="Monitored Site"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600">
                Enter a URL above to start
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default Editor
