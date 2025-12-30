// Editor doesn't use Layout! Removing the import which is causing issues.
import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from './contexts/ToastContext';
import { MousePointerClick, Save, Play, Clock, ArrowLeft, Trash2, Sliders, AlertTriangle, CheckCircle, RotateCcw, ScanEye, FileText, Type, MousePointer2, Smartphone, Image as ImageIcon } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';

interface SelectedElement {
    selector: string;
    text: string;
}

interface NotifyConfig {
    method: string;
    threshold: string;
}

interface MessageEvent extends Event {
    data: {
        type: string;
        payload: unknown;
    };
}

function Editor() {
  console.log("Editor Component Loaded - Cache Bust");
  const API_BASE = '';
  const [url, setUrl] = useState('')
  const [proxyUrl, setProxyUrl] = useState('')
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null)
  const [interval, setIntervalValue] = useState('1h')
  const navigate = useNavigate()
  const { id } = useParams()
  const [monitorType, setMonitorType] = useState<'text' | 'visual' | 'price'>('text');
  const { showToast } = useToast();
  const { authFetch } = useAuth();
  const { t } = useTranslation();
  
  const [isSelecting, setIsSelecting] = useState(true);

  const [name, setName] = useState('')
  const [notifyConfig, setNotifyConfig] = useState<NotifyConfig>({ method: 'all', threshold: '' });
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOnlyVisual, setAiOnlyVisual] = useState(false);
  const [retryCount, setRetryCount] = useState(3);
  const [retryDelay, setRetryDelay] = useState(2000);
  const [priceDetectionEnabled, setPriceDetectionEnabled] = useState(false);
  const [priceThresholdMin, setPriceThresholdMin] = useState<number | ''>('');
  const [priceThresholdMax, setPriceThresholdMax] = useState<number | ''>('');
  const [priceScanResult, setPriceScanResult] = useState<{
      success: boolean; 
      formatted?: string; 
      source?: string; 
      message?: string; 
      price?: number; 
      currency?: string;
  } | null>(null);
  const [isScanning, setIsScanning] = useState(false);

  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false)

  // Floating Panel Drag State
  const [floatingOffset, setFloatingOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setFloatingOffset({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        });
      }
    };
    
    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (id) {
        const fetchMonitor = async () => {
            try {
                const response = await authFetch(`${API_BASE}/monitors`);
                const data = await response.json();
                if (data.message === 'success') {
                    const monitor = data.data.find((m: { id: number }) => m.id == Number(id));
                    if (monitor) {
                        setUrl(monitor.url);
                        setName(monitor.name || '');
                        setIntervalValue(monitor.interval);
                        
                        // Set Monitor Type
                        if (monitor.price_detection_enabled) {
                            setMonitorType('price');
                            setPriceDetectionEnabled(true);
                        } else {
                            setMonitorType(monitor.type);
                            setPriceDetectionEnabled(false);
                        }

                        setAiPrompt(monitor.ai_prompt || '');
                        setAiOnlyVisual(!!monitor.ai_only_visual);
                        setRetryCount(monitor.retry_count ?? 3);
                        setRetryDelay(monitor.retry_delay ?? 2000);
                        setPriceThresholdMin(monitor.price_threshold_min ?? '');
                        setPriceThresholdMax(monitor.price_threshold_max ?? '');
                        
                        try {
                            if (monitor.notify_config) setNotifyConfig(JSON.parse(monitor.notify_config));
                        } catch {}
                        
                        if (monitor.selector) {
                            setSelectedElement({
                                selector: monitor.selector,
                                text: monitor.selector_text || 'Loaded Selector'
                            });
                        }
                        
                        setProxyUrl(`${API_BASE}/proxy?url=${encodeURIComponent(monitor.url)}`);
                    } else {
                        showToast(t('editor.toasts.monitor_not_found'), 'error');
                        navigate('/');
                    }
                }
            } catch (e) {
                console.error(e);
                showToast(t('editor.toasts.load_error'), 'error');
            }
        };
        fetchMonitor();
    } else {
        const paramUrl = searchParams.get('url');
        const paramName = searchParams.get('name');
        const paramSelector = searchParams.get('selector');
        const paramType = searchParams.get('type');
        
        if (paramUrl) {
            setUrl(paramUrl);
            setProxyUrl(`${API_BASE}/proxy?url=${encodeURIComponent(paramUrl)}`);
        }
        if (paramName) setName(paramName);
        if (paramType) setMonitorType(paramType as 'text' | 'visual' | 'price');
        if (paramSelector) {
            setSelectedElement({ selector: paramSelector, text: t('editor.toasts.auto_detected') });
        }
        
        const paramPrice = searchParams.get('price');
        const paramCurrency = searchParams.get('currency');
        const paramFormatted = searchParams.get('formatted');

        if (paramType === 'price' && paramPrice) {
             setPriceScanResult({
                 success: true,
                 price: parseFloat(paramPrice),
                 currency: paramCurrency || 'EUR',
                 formatted: paramFormatted || `${paramCurrency || '€'} ${paramPrice}`,
                 source: 'extension'
             });
             setPriceDetectionEnabled(true);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams])

  useEffect(() => {
    const handleMessage = (event: Event) => {
      const msgEvent = event as unknown as MessageEvent;
      const { type, payload } = msgEvent.data;
      if (type === 'selected') {
        console.log('Selected:', payload)
        setSelectedElement(payload as SelectedElement)
      } else if (type === 'deselected') {
          if (selectedElement && selectedElement.selector === payload) {
              setSelectedElement(null)
          }
      } else if (type === 'navigate') {
          console.log("Navigating to:", payload);
          setProxyUrl(`${API_BASE}/proxy?url=${encodeURIComponent(payload as string)}`);
          showToast(t('editor.toasts.navigating'), 'info');
      } else if (type === 'TEST_SELECTOR_RESULT') {
          const result = payload as { found?: boolean; count?: number; text?: string; error?: string };
          if (result.found) {
              showToast(t('editor.toasts.found_elements', { count: result.count }), 'success');
              if (selectedElement) {
                  setSelectedElement(prev => prev ? { ...prev, text: result.text || '' } : null);
              }
          } else if (result.error) {
              showToast(t('editor.toasts.invalid_selector', { error: result.error }), 'error');
          } else {
              showToast(t('editor.toasts.no_elements'), 'error');
          }
      } else if (type === 'SELECTOR_READY') {
          // Iframe script is ready, enforce correct mode immediately
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
              // Re-calculate strict mode logic
              let shouldBeActive = false;
              if (monitorType === 'text') {
                  const isBody = selectedElement && selectedElement.selector === 'body';
                  shouldBeActive = isSelecting && !isBody;
              }
              
              iframe.contentWindow.postMessage({ 
                  type: 'set_mode', 
                  payload: { active: shouldBeActive } 
              }, '*');
              
              // Force clear if needed
              if (!shouldBeActive) {
                  iframe.contentWindow.postMessage({ type: 'clear' }, '*');
              }
          }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedElement, monitorType, isSelecting, t, navigate]);

  // Sync selection mode with Iframe
  useEffect(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
        // STRICT: Only allow active selection in interactive Text Mode for specific elements
        // Disabled for Price Mode, Visual Mode, and Full Page Body Text Mode
        let shouldBeActive = false;
        
        if (monitorType === 'text') {
             // Only active if we are selecting AND it's not a full-page body monitor
             // If selectedElement is body, we probably want to disable selection to show full page clearly
             if (selectedElement && selectedElement.selector === 'body') {
                 shouldBeActive = false;
             } else {
                 shouldBeActive = isSelecting;
             }
        }

        iframe.contentWindow.postMessage({ 
            type: 'set_mode', 
            payload: { active: shouldBeActive } 
        }, '*');
        
        // Clear any existing highlights if we are in a "Full Page" mode (visual or body-text)
        if (monitorType === 'visual' || (monitorType === 'text' && selectedElement?.selector === 'body')) {
             iframe.contentWindow.postMessage({ type: 'clear' }, '*');
        }
    }
  }, [isSelecting, proxyUrl, monitorType, selectedElement]);

  const handleGo = async () => {
    if (!url) return;
    setIsLoading(true);
    
    // Safety timeout: stop loading after 15s if iframe hangs
    setTimeout(() => {
        setIsLoading(prev => {
            if (prev) {
                showToast(t('editor.toasts.timeout_warning', 'Page load took too long, but we are showing what we got.'), 'info');
                return false;
            }
            return prev;
        });
    }, 15000);

    const target = `${API_BASE}/proxy?url=${encodeURIComponent(url)}`;
    setProxyUrl(target);
  }

  // Sync flag with type
  useEffect(() => {
    if (monitorType === 'price') {
        setPriceDetectionEnabled(true);
    } else {
        setPriceDetectionEnabled(false);
    }
  }, [monitorType]);

  const handleSave = async () => {
    if (!url) return;
    if (monitorType === 'text' && !selectedElement && !priceDetectionEnabled) {
        showToast(t('editor.toasts.select_element'), 'error');
        return;
    }
    
    try {
        const urlParams = id ? `/${id}` : '';
        const method = id ? 'PUT' : 'POST';
        
        const finalType = monitorType === 'price' ? 'text' : monitorType;
        const finalPriceEnabled = monitorType === 'price' ? 1 : 0;

        const response = await authFetch(`${API_BASE}/monitors${urlParams}`, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                url,
                selector: (monitorType === 'text' || monitorType === 'price') && selectedElement ? selectedElement.selector : '',
                selector_text: (monitorType === 'text' || monitorType === 'price') && selectedElement ? selectedElement.text : '',
                interval,
                type: finalType,
                notify_config: notifyConfig,
                ai_prompt: aiPrompt,
                ai_only_visual: aiOnlyVisual ? 1 : 0,
                retry_count: retryCount,
                retry_delay: retryDelay,
                price_detection_enabled: finalPriceEnabled,
                price_threshold_min: priceThresholdMin || null,
                price_threshold_max: priceThresholdMax || null
            })
        });
        const data = await response.json();
        if (data.message === 'success' || data.message === 'Monitor added' || data.message === 'Monitor updated') {
            showToast(t('editor.toasts.monitor_saved'), 'success');
            navigate('/'); 
        } else {
            showToast(t('editor.toasts.save_error', { error: data.error || 'Unknown error' }), 'error');
        }
    } catch (e) {
        console.error(e);
        showToast(t('editor.toasts.save_error', { error: e instanceof Error ? e.message : 'Unknown error' }), 'error');
    }
  }

  // Auto-scan price when switching to Price Monitor
  useEffect(() => {
    if (monitorType === 'price' && url && !priceScanResult && !isScanning) {
        handleScanPrice();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monitorType, url]);

  // Force disable selection in Price Mode
  useEffect(() => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    if (iframe && iframe.contentWindow) {
        // Send disable mode
        iframe.contentWindow.postMessage({ 
            type: 'set_mode', 
            payload: { active: monitorType !== 'price' && isSelecting } 
        }, '*');
        
        // Also clear any existing highlight/selection
        if (monitorType === 'price') {
             iframe.contentWindow.postMessage({ type: 'clear' }, '*');
             setSelectedElement(null);
        }
    }
  }, [monitorType, isSelecting]);

  const handleScanPrice = async () => {
    if (!url) return;
    setIsScanning(true);
    setPriceScanResult(null); // Clear previous result
    try {
        const res = await authFetch(`${API_BASE}/api/scan-price`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        
        // Always set result to show feedback in sidebar
        setPriceScanResult(data);
        
        if (data.success && data.price !== null) {
            showToast(t('editor.toasts.price_detected', { price: `${data.currency} ${data.price}` }), "success");
        } else {
            showToast(t('editor.toasts.price_not_found'), "error");
        }
    } catch (e) {
        console.error("Price scan failed", e);
        showToast(t('editor.toasts.price_scan_error'), "error");
        // Show error in sidebar too
        setPriceScanResult({ success: false, message: "Scan failed: Network error" });
    } finally {
        setIsScanning(false);
    }
  };

  useEffect(() => {
     if (proxyUrl && selectedElement && id && monitorType === 'text') {
         const timer = setTimeout(() => {
   // ... rest of hook

             const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
             if (iframe && iframe.contentWindow) {
                 iframe.contentWindow.postMessage({
                     type: 'highlight',
                     payload: selectedElement.selector
                 }, '*');
             }
         }, 2000); 
         return () => clearTimeout(timer);
     }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proxyUrl, id]);

  /* Removed unused helper functions */
  const handleTestSelector = () => {
    const iframe = document.querySelector('iframe') as HTMLIFrameElement | null;
    if (iframe && selectedElement) {
        iframe.contentWindow?.postMessage({
            type: 'TEST_SELECTOR',
            payload: selectedElement.selector
        }, '*');
    }
  };


  const handleIframeLoad = (e: React.SyntheticEvent<HTMLIFrameElement>) => {
    const iframe = e.currentTarget;
    
    // STRICT Mode Logic for Iframe Load
    let shouldBeActive = false;
    if (monitorType === 'text') {
         if (selectedElement && selectedElement.selector === 'body') {
             shouldBeActive = false; 
         } else {
             shouldBeActive = isSelecting;
         }
    }
    
    // Send mode configuration
    iframe.contentWindow?.postMessage({ 
        type: 'set_mode', 
        payload: { active: shouldBeActive } 
    }, '*');
    
    // Clear any highlights in non-selection modes
    if (monitorType === 'price' || monitorType === 'visual' || (monitorType === 'text' && selectedElement?.selector === 'body')) {
        iframe.contentWindow?.postMessage({ type: 'clear' }, '*');
    }
    
    if (selectedElement && monitorType === 'text' && selectedElement.selector !== 'body') {
        iframe.contentWindow?.postMessage({
             type: 'highlight',
             payload: selectedElement.selector
        }, '*');
    }
    setIsLoading(false);
  };

  const [step, setStep] = useState<'url' | 'type' | 'config'>('url');
  
  // Effect to automatically advance step if editing existing monitor
  useEffect(() => {
      if (id && url && monitorType) {
          setStep('config');
      }
  }, [id, url, monitorType]);

  const handleUrlSubmit = () => {
      if (url) {
          handleGo();
          setStep('type');
      }
  };

  return (
    <div className="flex h-screen w-full bg-[#0d1117] flex-col text-white font-sans">
      {/* Header / Nav */}
      <header className="bg-[#161b22] px-6 py-4 shadow-md flex items-center justify-between border-b border-gray-800 z-30">
          <div className="flex items-center gap-4">
               <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
                  <ArrowLeft size={20} />
               </button>
               <div className="flex flex-col">
                   <h1 className="text-lg font-bold text-white leading-tight">
                      {id ? t('editor.title_edit') : t('editor.title_new')}
                   </h1>
                   <div className="flex items-center gap-2 text-xs text-gray-500">
                       <span className={step === 'url' ? 'text-blue-400 font-bold' : ''}>1. URL</span>
                       <span>&rsaquo;</span>
                       <span className={step === 'type' ? 'text-blue-400 font-bold' : ''}>2. Type</span>
                       <span>&rsaquo;</span>
                       <span className={step === 'config' ? 'text-blue-400 font-bold' : ''}>3. Config</span>
                   </div>
               </div>
          </div>
          {step === 'config' && (
              <button 
                  onClick={handleSave}
                  disabled={!url || !proxyUrl || isLoading || (monitorType === 'text' && !selectedElement && !priceDetectionEnabled)}
                  className={`px-6 py-2 rounded-lg font-bold transition flex items-center gap-2 ${(!url || !proxyUrl || isLoading || (monitorType === 'text' && !selectedElement && !priceDetectionEnabled)) ? 'bg-gray-700 text-gray-400 cursor-not-allowed' : 'bg-[#238636] text-white hover:bg-[#2ea043] shadow-lg hover:shadow-green-900/20'}`}
              >
                  {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                  {t('editor.save')}
              </button>
          )}
      </header>

      <div className="flex flex-1 overflow-hidden relative">
          
          {/* STEP 1: URL INPUT */}
          {step === 'url' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
                  <div className="w-full max-w-2xl bg-[#161b22] p-8 rounded-2xl border border-gray-700 shadow-2xl">
                      <h2 className="text-2xl font-bold mb-6 text-center text-white">
                          What website do you want to monitor?
                      </h2>
                      <div className="flex gap-4">
                          <input 
                            type="text" 
                            placeholder="https://example.com" 
                            className="flex-1 p-4 bg-[#0d1117] border border-gray-700 text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg placeholder-gray-600 transition-all"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
                            autoFocus
                          />
                          <button 
                            onClick={handleUrlSubmit}
                            disabled={!url}
                            className={`px-8 rounded-xl font-bold text-lg transition-all transform active:scale-95 ${!url ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg hover:shadow-blue-900/20'}`}
                          >
                            Go
                          </button>
                      </div>
                      <div className="mt-6 flex justify-center">
                          <p className="text-gray-500 text-sm">
                              Enter the full URL of the page you want to track.
                          </p>
                      </div>
                  </div>
              </div>
          )}

          {/* STEP 2: TYPE SELECTION */}
          {step === 'type' && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in slide-in-from-right-10 duration-300">
                  <div className="w-full max-w-5xl">
                      <button 
                          onClick={() => setStep('url')} 
                          className="mb-8 text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                      >
                          <ArrowLeft size={16} /> Back to URL
                      </button>
                      
                      <h2 className="text-3xl font-bold mb-8 text-center text-white">
                          How do you want to monitor this page?
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* TEXT MONITOR */}
                            <button 
                                onClick={() => { setMonitorType('text'); setSelectedElement(null); setStep('config'); }}
                                className="group relative bg-[#161b22] hover:bg-[#1c2128] p-8 rounded-2xl border border-gray-700 hover:border-blue-500 transition-all text-left shadow-lg hover:shadow-blue-900/10"
                            >
                                <div className="absolute top-6 right-6 p-3 bg-blue-900/20 rounded-xl text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                    <MousePointerClick size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">Element Text</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Select a specific part of the page to track (e.g. a price, stock status, or news headline). Best for focused monitoring.
                                </p>
                            </button>

                            {/* PRICE MONITOR */}
                            <button 
                                onClick={() => { setMonitorType('price'); setStep('config'); }}
                                className="group relative bg-[#161b22] hover:bg-[#1c2128] p-8 rounded-2xl border border-gray-700 hover:border-emerald-500 transition-all text-left shadow-lg hover:shadow-emerald-900/10"
                            >
                                <div className="absolute top-6 right-6 p-3 bg-emerald-900/20 rounded-xl text-emerald-400 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                                    <span>💰</span>
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">Price Detection</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Automatically detect and track product prices. Get notified on price drops or increases.
                                </p>
                            </button>

                            {/* VISUAL MONITOR */}
                            <button 
                                onClick={() => { setMonitorType('visual'); setSelectedElement(null); setStep('config'); }}
                                className="group relative bg-[#161b22] hover:bg-[#1c2128] p-8 rounded-2xl border border-gray-700 hover:border-purple-500 transition-all text-left shadow-lg hover:shadow-purple-900/10"
                            >
                                <div className="absolute top-6 right-6 p-3 bg-purple-900/20 rounded-xl text-purple-400 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                                    <ImageIcon size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">Visual Snapshot</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Take screenshots of the page and detect any visual changes. Good for layout changes or visual content.
                                </p>
                            </button>

                            {/* FULL PAGE TEXT */}
                            <button 
                                onClick={() => { setMonitorType('text'); setSelectedElement({ selector: 'body', text: 'Full Page' }); setStep('config'); }}
                                className="group relative bg-[#161b22] hover:bg-[#1c2128] p-8 rounded-2xl border border-gray-700 hover:border-gray-500 transition-all text-left shadow-lg hover:shadow-gray-900/10"
                            >
                                <div className="absolute top-6 right-6 p-3 bg-gray-800 rounded-xl text-gray-400 group-hover:bg-gray-600 group-hover:text-white transition-colors">
                                    <FileText size={24} />
                                </div>
                                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-gray-300 transition-colors">Full Page Text</h3>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Monitor the entire text content of the page. Useful for tracking any content update anywhere on the page.
                                </p>
                            </button>
                      </div>
                  </div>
              </div>
          )}

          {/* STEP 3: CONFIGURATION (Existing UI Wrapped) */}
          {step === 'config' && (
                <div className="flex flex-1 w-full h-full"> 
                    {selectedElement && monitorType === 'text' && selectedElement.selector !== 'body' && (
                        <div className="w-80 bg-[#161b22] border-r border-gray-800 p-4 shadow-lg flex flex-col overflow-y-auto z-20">
                            <button onClick={() => setStep('type')} className="mb-4 text-xs text-gray-500 hover:text-white flex items-center gap-1">
                                <ArrowLeft size={12} /> {t('monitor_details.back')}
                            </button>
                            {/* ... Existing Sidebar Content for Text ... */}
                            <h2 className="text-lg font-semibold mb-2 text-white">{t('editor.selected_element')}</h2>
                            
                            <div className="flex bg-[#0d1117] rounded-lg p-1 mb-4 border border-gray-700">
                                <button 
                                    onClick={() => setIsSelecting(true)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${isSelecting ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <MousePointerClick size={14} />
                                    {t('editor.select')}
                                </button>
                                <button 
                                    onClick={() => setIsSelecting(false)}
                                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${!isSelecting ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                                >
                                    <MousePointerClick className="rotate-90" size={14} />
                                    {t('editor.interact')}
                                </button>
                            </div>

                            <div className="flex gap-2 mb-2">
                                <input 
                                    type="text"
                                    value={selectedElement.selector}
                                    onChange={(e) => setSelectedElement({ ...selectedElement, selector: e.target.value })}
                                    className="flex-1 bg-[#0d1117] p-2 rounded text-xs font-mono break-all border border-gray-700 text-gray-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    placeholder={t('editor.selector_placeholder')}
                                />
                                <button
                                    onClick={handleTestSelector}
                                    className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-500 transition whitespace-nowrap"
                                    title="Test selector"
                                >
                                    🔍
                                </button>
                            </div>
                            <div className="mb-4">
                                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider">{t('editor.current_text')}</h3>
                                <p className="p-2 bg-[#0d1117] rounded border border-gray-700 mt-1 text-sm text-gray-200 h-24 overflow-y-auto font-mono text-xs">{selectedElement.text || <span className="text-gray-500 italic">{t('editor.no_text')}</span>}</p>
                            </div>

                            {/* DOM Hierarchy */}
                            <div className="mb-4">
                                <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">{t('editor.hierarchy', 'Hierarchy')}</h3>
                                <div className="flex flex-wrap gap-1 bg-[#0d1117] p-2 rounded border border-gray-700">
                                    {selectedElement.selector.split('>').map((segment, index, array) => (
                                        <div key={index} className="flex items-center">
                                            {index > 0 && <span className="text-gray-600 mx-1">›</span>}
                                            <button
                                                onClick={() => {
                                                    const newSelector = array.slice(0, index + 1).join('>').trim();
                                                    setSelectedElement({ ...selectedElement, selector: newSelector });
                                                    // Trigger highlight update in iframe
                                                    const iframe = document.querySelector('iframe');
                                                    iframe?.contentWindow?.postMessage({
                                                        type: 'highlight',
                                                        payload: newSelector
                                                    }, '*');
                                                }}
                                                className="px-1.5 py-0.5 rounded text-xs text-blue-400 hover:bg-blue-900/30 hover:text-blue-300 transition-colors border border-transparent hover:border-blue-800"
                                                title={segment.trim()}
                                            >
                                                {segment.trim().replace(/\[.*?\]/g, '').replace(/\:nth-of-type\(\d+\)/g, '') || segment.trim()}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                            <hr className="border-gray-800 my-4" />
                            
                             <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('editor.name_placeholder')}</label>
                                    <input 
                                      type="text" 
                                      placeholder={t('editor.name_placeholder_default')} 
                                      className="w-full p-2 bg-[#0d1117] border border-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      value={name}
                                      onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('monitor_details.interval')}</label>
                                    <select 
                                        value={interval} 
                                        onChange={(e) => setIntervalValue(e.target.value)}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="*/1 * * * *">{t('editor.intervals.1m')}</option>
                                        <option value="*/5 * * * *">{t('editor.intervals.5m')}</option>
                                        <option value="*/15 * * * *">{t('editor.intervals.15m')}</option>
                                        <option value="*/30 * * * *">{t('editor.intervals.30m')}</option>
                                        <option value="0 * * * *">{t('editor.intervals.1h')}</option>
                                        <option value="0 */8 * * *">{t('editor.intervals.8h')}</option>
                                        <option value="0 */12 * * *">{t('editor.intervals.12h')}</option>
                                        <option value="0 0 * * *">{t('editor.intervals.24h')}</option>
                                    </select>
                                </div>

                                {/* Retry Config */}
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('editor.retry_policy')}</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={retryCount}
                                            onChange={(e) => setRetryCount(Number(e.target.value))}
                                            className="flex-1 bg-[#0d1117] border border-gray-700 text-white rounded p-2 text-sm"
                                        >
                                            {[1, 2, 3, 5, 10].map(n => <option key={n} value={n}>{t('editor.retries', {count: n})}</option>)}
                                        </select>
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                    
                     {/* SIDEBAR FOR PRICE DETECT MODE */}
                     {monitorType === 'price' && (
                         <div className="w-80 bg-[#161b22] border-r border-gray-800 p-4 shadow-lg flex flex-col overflow-y-auto z-20">
                             <button onClick={() => setStep('type')} className="mb-4 text-xs text-gray-500 hover:text-white flex items-center gap-1">
                                <ArrowLeft size={12} /> {t('monitor_details.back')}
                            </button>
                             <div className="flex items-center gap-2 mb-6">
                                 <span className="text-2xl">💰</span>
                                 <h2 className="text-lg font-bold text-white">{t('editor.price_heading', 'Price Detection')}</h2>
                             </div>
                             
                             <div className="space-y-6">
                                <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700">
                                    <div className="flex justify-between items-center mb-2">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">{t('editor.detected_price', 'Detected Price')}</label>
                                        <button 
                                            onClick={handleScanPrice}
                                            disabled={isScanning}
                                            className="text-xs text-blue-400 hover:text-blue-300 disabled:text-gray-600"
                                        >
                                            {isScanning ? t('monitor_details.checking') : t('monitor_details.check_now')}
                                        </button>
                                    </div>
                                    
                                    {isScanning ? (
                                         <div className="flex items-center justify-center py-4">
                                             <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                         </div>
                                    ) : priceScanResult ? (
                                        <div className={`text-center py-2 rounded ${priceScanResult.success ? 'bg-emerald-900/20 text-emerald-400' : 'bg-red-900/20 text-red-400'}`}>
                                            {priceScanResult.success ? (
                                                <div className="flex flex-col">
                                                    <span className="text-2xl font-bold">{priceScanResult.formatted}</span>
                                                    <span className="text-[10px] text-gray-500 mt-1 uppercase">{priceScanResult.source}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs">{priceScanResult.message}</span>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-500 text-xs italic">
                                            {t('editor.price_not_found')}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('editor.name_placeholder')}</label>
                                    <input 
                                      type="text" 
                                      placeholder={t('editor.name_placeholder_default')} 
                                      className="w-full p-2 bg-[#0d1117] border border-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      value={name}
                                      onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                
                                <div>
                                    <h2 className="text-lg font-semibold mb-2 text-white">{t('editor.price_thresholds')}</h2>
                                    <div className="grid grid-cols-2 gap-2 mb-1">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('editor.min_price')}</label>
                                            <input 
                                                type="number"
                                                value={priceThresholdMin}
                                                onChange={(e) => setPriceThresholdMin(e.target.value ? Number(e.target.value) : '')}
                                                placeholder="0.00"
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-400 mb-1">{t('editor.max_price')}</label>
                                            <input 
                                                type="number"
                                                value={priceThresholdMax}
                                                onChange={(e) => setPriceThresholdMax(e.target.value ? Number(e.target.value) : '')}
                                                placeholder="0.00"
                                                className="w-full bg-[#0d1117] border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 italic mb-4">
                                        {t('editor.price_threshold_hint', 'Leave blank to get notified on ANY price change.')}
                                    </p>
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('monitor_details.interval')}</label>
                                    <select 
                                        value={interval} 
                                        onChange={(e) => setIntervalValue(e.target.value)}
                                        className="w-full bg-[#0d1117] border border-gray-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                                    >
                                        <option value="*/1 * * * *">{t('editor.intervals.1m')}</option>
                                        <option value="*/5 * * * *">{t('editor.intervals.5m')}</option>
                                        <option value="*/15 * * * *">{t('editor.intervals.15m')}</option>
                                        <option value="*/30 * * * *">{t('editor.intervals.30m')}</option>
                                        <option value="0 * * * *">{t('editor.intervals.1h')}</option>
                                        <option value="0 */6 * * *">{t('editor.intervals.6h')}</option>
                                        <option value="0 */12 * * *">{t('editor.intervals.12h')}</option>
                                        <option value="0 0 * * *">{t('editor.intervals.24h')}</option>
                                    </select>
                                </div>
                             </div>

                         </div>
                    )}
                    
                     {/* SIDEBAR FOR VISUAL/FULLPAGE MODE */}
                    {(monitorType === 'visual' || (monitorType === 'text' && selectedElement?.selector === 'body')) && (
                         <div className="w-80 bg-[#161b22] border-r border-gray-800 p-4 shadow-lg flex flex-col overflow-y-auto z-20">
                             <button onClick={() => setStep('type')} className="mb-4 text-xs text-gray-500 hover:text-white flex items-center gap-1">
                                <ArrowLeft size={12} /> {t('monitor_details.back')}
                            </button>
                             <div className="flex items-center gap-2 mb-6">
                                 <span className="text-blue-400">
                                    {monitorType === 'visual' ? <ScanEye size={28} /> : <FileText size={28} />}
                                 </span>
                                 <h2 className="text-lg font-bold text-white">{monitorType === 'visual' ? t('editor.visual') : t('editor.full_page')}</h2>
                             </div>
                             
                             <div className="space-y-6">
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('editor.name_placeholder')}</label>
                                    <input 
                                      type="text" 
                                      placeholder={t('editor.name_placeholder_default')} 
                                      className="w-full p-2 bg-[#0d1117] border border-gray-700 text-white rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                                      value={name}
                                      onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                
                                <div className="p-4 bg-gray-800/50 rounded-xl border border-gray-700">
                                   <label className="flex items-center gap-3 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            checked={aiOnlyVisual}
                                            onChange={(e) => setAiOnlyVisual(e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                                        />
                                        <div>
                                            <span className="text-sm font-medium text-white block">{t('editor.ai_analysis')}</span>
                                            <span className="text-xs text-gray-400">{t('editor.ai_analysis_desc', 'Reduce false positives using AI')}</span>
                                        </div>
                                    </label>
                                </div>
                                
                                <div>
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-2">{t('monitor_details.interval')}</label>
                                    <select 
                                        value={interval} 
                                        onChange={(e) => setIntervalValue(e.target.value)}
                                        className="w-full bg-[#0d1117] border border-gray-700 text-white rounded p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    >
                                        <option value="0 * * * *">{t('editor.intervals.1h')}</option>
                                        <option value="0 */6 * * *">{t('editor.intervals.6h')}</option>
                                        <option value="0 */12 * * *">{t('editor.intervals.12h')}</option>
                                        <option value="0 0 * * *">{t('editor.intervals.24h')}</option>
                                        <option value="0 0 * * 0">{t('editor.intervals.1w')}</option>
                                    </select>
                                </div>
                             </div>
                         </div>
                    )}


                    {/* PREVIEW PANE */}
                    <div className="flex-1 bg-[#0d1117] relative flex flex-col">
                      {proxyUrl ? (
                        <div className="flex-1 relative bg-gray-900">
                            {/* Iframe container */}
                            <div className="absolute inset-0 bg-white">
                                <iframe 
                                    src={proxyUrl} 
                                    className="w-full h-full border-0"
                                    title="Website Preview"
                                    sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                                    onLoad={handleIframeLoad}
                                />
                            </div>

                             {/* Visual/Full Page Overlay */}
                             {(monitorType === 'visual' || (monitorType === 'text' && selectedElement?.selector === 'body')) && !isLoading && (
                                <div className="absolute inset-0 bg-black/10 backdrop-blur-sm z-30 flex items-center justify-center pointer-events-none">
                                    <div className="bg-[#161b22]/90 border border-blue-500/50 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                        <div className="p-3 bg-blue-500/20 rounded-full text-blue-400">
                                            {monitorType === 'visual' ? <ScanEye size={40} /> : <FileText size={40} />}
                                        </div>
                                        <div className="text-center">
                                            <h3 className="text-white font-bold text-xl mb-1">
                                                {monitorType === 'visual' ? t('editor.visual_active') : t('editor.text_active')}
                                            </h3>
                                            <p className="text-gray-400 text-sm max-w-[240px] leading-relaxed">
                                                {monitorType === 'visual' ? t('editor.visual_active_desc') : t('editor.text_active_desc')}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                             )}
                            
                            {/* Loading overlay */}
                            {isLoading && (
                               <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-50">
                                   <div className="flex flex-col items-center">
                                       <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                                       <p className="text-white font-medium">Loading Page...</p>
                                   </div>
                               </div>
                            )}

                             {/* Helper Overlay for Selection Mode */}
                             {/* Helper Control Panel for Selection Mode */}
                             {monitorType === 'text' && !priceDetectionEnabled && !isLoading && !selectedElement && (
                                <div 
                                    className="absolute z-40 animate-in fade-in slide-in-from-top-4 duration-300 cursor-move"
                                    style={{ 
                                        top: `calc(24px + ${floatingOffset.y}px)`, 
                                        left: `calc(50% + ${floatingOffset.x}px)`,
                                        transform: 'translateX(-50%)' // Keep initial centering logic, offset applied to left
                                    }}
                                    onMouseDown={(e) => {
                                        if ((e.target as HTMLElement).tagName === 'BUTTON') return; // Don't drag when clicking buttons
                                        setIsDragging(true);
                                        setDragStart({ 
                                            x: e.clientX - floatingOffset.x, 
                                            y: e.clientY - floatingOffset.y 
                                        });
                                    }}
                                >
                                    <div className="bg-[#161b22]/95 backdrop-blur-md border border-gray-600 p-1.5 rounded-full shadow-2xl flex items-center w-64 relative select-none">
                                        {/* Slider Background */}
                                        <div 
                                            className={`absolute top-1.5 bottom-1.5 w-[calc(50%-6px)] bg-blue-600 rounded-full transition-all duration-300 ease-spring ${isSelecting ? 'left-1.5' : 'left-[calc(50%+3px)]'}`}
                                        />
                                        
                                        {/* Select Option */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsSelecting(true); }}
                                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on button
                                            className={`relative flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 z-10 transition-colors ${isSelecting ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                        >
                                            <MousePointerClick size={14} />
                                            {t('editor.select')}
                                        </button>
                                        
                                        {/* Interact Option */}
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setIsSelecting(false); }}
                                            onMouseDown={(e) => e.stopPropagation()} // Prevent drag start on button
                                            className={`relative flex-1 py-2 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 z-10 transition-colors ${!isSelecting ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                                        >
                                            <MousePointerClick size={14} className="rotate-90" />
                                            {t('editor.interact')}
                                        </button>
                                    </div>
                                    
                                    {/* Helper Text below pill */}
                                    <div className="mt-2 text-center pointer-events-none">
                                        <span className="px-3 py-1 bg-black/50 text-gray-300 text-[10px] rounded-full backdrop-blur-sm border border-white/10">
                                            {t('editor.tip_drag', 'Drag to move • Toggle to interact')}
                                        </span>
                                    </div>
                                </div>
                             )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-gray-600">
                            Loading Preview...
                        </div>
                      )}
                    </div>
                </div>
          )}
      </div>
    </div>
  )
}

export default Editor
