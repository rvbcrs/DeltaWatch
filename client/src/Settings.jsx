import { useState, useEffect } from 'react'
import { ArrowLeft, Save, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

function Settings() {
    const navigate = useNavigate();
    const [settings, setSettings] = useState({
        email_enabled: false,
        email_host: '',
        email_port: 587,
        email_secure: false,
        email_user: '',
        email_pass: '',
        email_to: '',
        push_enabled: false,
        push_type: 'pushover',
        push_key1: '',
        push_key2: ''
    });

    useEffect(() => {
        fetch('http://localhost:3000/settings')
            .then(res => res.json())
            .then(data => {
                if (data.message === 'success' && data.data) {
                    setSettings({
                        ...data.data,
                        email_enabled: !!data.data.email_enabled,
                        email_secure: !!data.data.email_secure,
                        push_enabled: !!data.data.push_enabled,
                    });
                }
            })
            .catch(err => console.error(err));
    }, []);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = async () => {
        try {
            const res = await fetch('http://localhost:3000/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            const data = await res.json();
            if (data.message === 'success') {
                alert('Settings saved!');
            } else {
                alert('Error saving settings');
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };
    
    const handleTest = async () => {
        // Save first? Maybe warn user.
        // For now just call test endpoint which reads from DB, so we should save first implicitly or tell user.
        // Or we can pass current state to test endpoint? 
        // The endpoint reads from DB. So we MUST save first.
        try {
             // Save first automatically? 
             await fetch('http://localhost:3000/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });
            
            const res = await fetch('http://localhost:3000/test-notification', { method: 'POST' });
            const data = await res.json();
            if (data.message === 'success') {
                alert('Test notification sent! Check your inbox/app.');
            } else {
                alert('Test functionality failed: ' + (data.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error: ' + e.message);
        }
    };

    return (
        <div className="flex h-screen w-screen bg-[#0d1117] flex-col text-white">
            <header className="bg-[#161b22] p-4 shadow-md flex items-center justify-between z-10 sticky top-0 border-b border-gray-800">
                <div className="flex items-center space-x-4 w-full max-w-6xl mx-auto">
                    <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft />
                    </button>
                    <h1 className="text-xl font-bold text-white shadow-sm flex items-center gap-2">
                        <Bell size={20} /> Notification Settings
                    </h1>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    
                    {/* Email Settings */}
                    <div className="bg-[#161b22] p-6 rounded-lg border border-gray-800 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Email Notifications</h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" name="email_enabled" checked={settings.email_enabled} onChange={handleChange} className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        
                        {settings.email_enabled && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">SMTP Host</label>
                                    <input type="text" name="email_host" value={settings.email_host} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="smtp.gmail.com" />
                                </div>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-sm font-medium text-gray-400 mb-1">Port</label>
                                        <input type="number" name="email_port" value={settings.email_port} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="587" />
                                    </div>
                                    <div className="flex items-center pt-6">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input type="checkbox" name="email_secure" checked={settings.email_secure} onChange={handleChange} className="form-checkbox h-4 w-4 text-blue-500 bg-[#0d1117] border-gray-700 rounded" />
                                            <span className="text-sm text-gray-400">Secure (SSL/TLS)</span>
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                                    <input type="text" name="email_user" value={settings.email_user} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="user@example.com" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                                    <input type="password" name="email_pass" value={settings.email_pass} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="App Password" />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Send to Email</label>
                                    <input type="email" name="email_to" value={settings.email_to} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="recipient@example.com" />
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Push Settings */}
                    <div className="bg-[#161b22] p-6 rounded-lg border border-gray-800 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-white">Smartphone Notifications</h2>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input type="checkbox" name="push_enabled" checked={settings.push_enabled} onChange={handleChange} className="sr-only peer" />
                              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            </label>
                        </div>
                        
                        {settings.push_enabled && (
                            <div className="grid grid-cols-1 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Service Provider</label>
                                    <div className="flex gap-4">
                                        <label className="flex items-center gap-2 cursor-pointer bg-[#0d1117] px-4 py-2 rounded border border-gray-700 flex-1 hover:border-gray-600">
                                            <input type="radio" name="push_type" value="pushover" checked={settings.push_type === 'pushover'} onChange={handleChange} className="text-blue-500 bg-[#0d1117] border-gray-700" />
                                            <span className="text-white">Pushover</span>
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer bg-[#0d1117] px-4 py-2 rounded border border-gray-700 flex-1 hover:border-gray-600">
                                            <input type="radio" name="push_type" value="telegram" checked={settings.push_type === 'telegram'} onChange={handleChange} className="text-blue-500 bg-[#0d1117] border-gray-700" />
                                            <span className="text-white">Telegram</span>
                                        </label>
                                    </div>
                                </div>
                                
                                {settings.push_type === 'pushover' ? (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Application Token</label>
                                            <input type="text" name="push_key1" value={settings.push_key1} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Pushover App Token" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">User Key</label>
                                            <input type="text" name="push_key2" value={settings.push_key2} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Pushover User Key" />
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Bot Token</label>
                                            <input type="text" name="push_key1" value={settings.push_key1} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Telegram Bot Token" />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Chat ID</label>
                                            <input type="text" name="push_key2" value={settings.push_key2} onChange={handleChange} className="w-full bg-[#0d1117] border border-gray-700 rounded p-2 text-white focus:border-blue-500 focus:outline-none" placeholder="Telegram Chat ID" />
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button 
                            onClick={handleSave}
                            className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 font-bold transition-colors shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
                        >
                            <Save size={20} /> Save Settings
                        </button>
                        <button 
                            onClick={handleTest}
                            className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 font-bold transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                        >
                            <Bell size={20} /> Test Notification
                        </button>
                    </div>

                </div>
            </div>
        </div>
    )
}

export default Settings
