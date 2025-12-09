import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, AlertCircle, Radio, Settings, Users, Share2, Plus, Radar } from 'lucide-react'

function Layout({ children }) {
  const location = useLocation();

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Monitoring', path: '/' },
    // { icon: <AlertCircle size={20} />, label: 'Incidents', path: '#' },
    // { icon: <Radio size={20} />, label: 'Status pages', path: '#' },
    // { icon: <Settings size={20} />, label: 'Maintenance', path: '#' },
    // { icon: <Users size={20} />, label: 'Team members', path: '#' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' }, // Changed to Settings for notification config
  ];

  return (
    <div className="flex h-screen bg-[#10141b] text-white font-sans">
      {/* Sidebar */}
      <div className="w-64 flex flex-col border-r border-gray-800 bg-[#161b22]">
        <div className="p-6">
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                <Radar className="text-green-500" />
                DeltaWatch
            </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1">
            {navItems.map((item) => (
                <Link 
                    key={item.label} 
                    to={item.path}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                        location.pathname === item.path 
                        ? 'bg-[#1f6feb] text-white' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }`}
                >
                    {item.icon}
                    {item.label}
                </Link>
            ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header - Optional, maybe just for mobile toggle or profile? */}
        {/* <header className="h-16 border-b border-gray-800 flex items-center justify-end px-6">
            <div className="w-8 h-8 bg-gray-700 rounded-full"></div>
        </header> */}
        
        <main className="flex-1 overflow-y-auto p-8">
            {children}
        </main>
      </div>
    </div>
  )
}

export default Layout
