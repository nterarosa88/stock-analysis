import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { List, Search, Menu, X, Home, RefreshCcw, TrendingUp } from 'lucide-react'

const Layout = () => {
    const location = useLocation()
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [openSubMenus, setOpenSubMenus] = useState<Record<string, boolean>>({})

    const isActive = (path: string) => {
        return location.pathname === path
    }

    const toggleSubMenu = (label: string) => {
        if (!isSidebarOpen) setIsSidebarOpen(true)
        setOpenSubMenus(prev => ({ ...prev, [label]: !prev[label] }))
    }

    const MENU_ITEMS = [
        { label: '대시보드', path: '/', icon: Home },
        { label: '종목 검색', path: '/stock/search', icon: Search },
        { label: '종목 리스트', path: '/stock/list', icon: List },
        { label: '데이터 동기화', path: '/stock/main', icon: RefreshCcw },
        {
            label: '분석',
            path: '/analysis',
            icon: TrendingUp,
            children: [
                { label: '120일 돌파', path: '/analysis/breakout120' },
                { label: '120일 돌파2', path: '/analysis/breakout120v2' }
            ]
        },
        {
            label: '조회',
            path: '/inquiry',
            icon: Search,
            children: [
                { label: '종목별 수익률', path: '/inquiry/returns' },
                { label: '관심 종목', path: '/inquiry/interest' }
            ]
        },
    ]

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* Sidebar */}
            <aside
                className={`bg-slate-900 text-white transition-all duration-300 ease-in-out flex flex-col fixed inset-y-0 left-0 z-30
                    ${isSidebarOpen ? 'w-64' : 'w-20'}
                `}
            >
                {/* Logo Area */}
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="font-bold text-lg">R</span>
                        </div>
                        <span className={`font-bold text-xl whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                            Rich Brother
                        </span>
                    </div>
                </div>

                {/* Navigation */}
                <nav className="flex-1 py-6 px-3 space-y-1">
                    {MENU_ITEMS.map((item) => {
                        const hasChildren = item.children && item.children.length > 0
                        const isOpen = openSubMenus[item.label]
                        const isChildActive = hasChildren && item.children?.some(child => isActive(child.path))

                        // For parent menu with children
                        if (hasChildren) {
                            return (
                                <div key={item.label}>
                                    <button
                                        onClick={() => toggleSubMenu(item.label)}
                                        className={`
                                            w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group relative
                                            ${isChildActive
                                                ? 'text-white' // Parent stays white-ish if child active?
                                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                            }
                                        `}
                                    >
                                        <item.icon className={`h-5 w-5 flex-shrink-0 ${isChildActive ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                        <span className={`flex-1 text-left whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                            {item.label}
                                        </span>
                                    </button>

                                    {/* Submenu */}
                                    <div className={`${isOpen && isSidebarOpen ? 'block' : 'hidden'} pl-10 space-y-1`}>
                                        {item.children?.map(child => (
                                            <Link
                                                key={child.path}
                                                to={child.path}
                                                className={`
                                                    block text-sm py-2 px-3 rounded-lg transition-colors
                                                    ${isActive(child.path)
                                                        ? 'bg-blue-600 text-white'
                                                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                                                    }
                                                `}
                                            >
                                                {child.label}
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        // Standard Menu Item
                        const active = isActive(item.path || '')
                        return (
                            <Link
                                key={item.path}
                                to={item.path!}
                                className={`
                                    flex items-center gap-3 px-3 py-3 rounded-lg transition-colors group relative
                                    ${active
                                        ? 'bg-blue-600 text-white'
                                        : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                    }
                                `}
                            >
                                <item.icon className={`h-5 w-5 flex-shrink-0 ${active ? 'text-white' : 'text-slate-400 group-hover:text-white'}`} />
                                <span className={`whitespace-nowrap transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                                    {item.label}
                                </span>
                                {!isSidebarOpen && (
                                    <div className="absolute left-full ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50">
                                        {item.label}
                                    </div>
                                )}
                            </Link>
                        )
                    })}
                </nav>

                {/* Sidebar Footer / Toggle */}
                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    >
                        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
                    </button>
                </div>
            </aside>

            {/* Main Content Wrapper */}
            <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${isSidebarOpen ? 'ml-64' : 'ml-20'}`}>
                {/* Top Header (Optional, for user profile or breadcrumbs) */}
                <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 sticky top-0 z-20">
                    <h2 className="text-xl font-semibold text-gray-800">
                        {MENU_ITEMS.find(item => item.path === location.pathname)?.label || 'Rich Brother'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                            U
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 p-8 overflow-auto">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}

export default Layout
