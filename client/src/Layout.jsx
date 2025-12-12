import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { LayoutDashboard, AlertCircle, Radio, Settings, Users, Share2, Plus, Radar, Menu, X } from 'lucide-react'

function Layout({ children }) {
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Close menu when route changes
  useEffect(() => {
      setIsSidebarOpen(false);
  }, [location]);

  const navItems = [
    { icon: <LayoutDashboard size={20} />, label: 'Monitoring', path: '/' },
    { icon: <Settings size={20} />, label: 'Settings', path: '/settings' },
  ];

  return (
    <div className="flex h-screen bg-[#10141b] text-white font-sans overflow-hidden">
      
      {/* Sidebar Overlay */}
      {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 animate-in fade-in" 
            onClick={() => setIsSidebarOpen(false)}
          />
      )}

      {/* Sidebar - Fixed Sliding Drawer */}
      <div className={`
        fixed inset-y-0 left-0 z-50 
        w-64 bg-[#161b22] border-r border-gray-800 flex flex-col 
        transform transition-transform duration-300 ease-in-out
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
      `}>
        <div className="p-6 flex items-center justify-between">
            <h1 className="text-xl font-bold flex items-center gap-2 text-white">
                <Radar className="text-green-500" />
                DeltaWatch
            </h1>
            <button 
                onClick={() => setIsSidebarOpen(false)} 
                className="text-gray-400 hover:text-white"
            >
                <X size={24} />
            </button>
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
      <div className="flex-1 flex flex-col w-full min-w-0 bg-[#0d1117]">
        
        {/* Dedicated Header for Toggle */}
        <header className="h-14 border-b border-gray-800 flex items-center px-4 bg-[#161b22] sticky top-0 z-40 shrink-0">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className={`p-2 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-opacity ${isSidebarOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
                title="Open Menu"
            >
                <Menu size={24} />
            </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
        </main>
      </div>
    </div>
  )
}

export default Layout;
export { Layout };
