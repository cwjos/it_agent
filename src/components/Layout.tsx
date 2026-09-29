import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageSquare, Users, BookOpen, Ticket, Settings, LogOut, Menu, X, Server, ChevronDown } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

const navItems: NavItem[] = [
  { to: '/dashboard', label: '数据大屏', icon: LayoutDashboard },
  { to: '/chat', label: '智能客服', icon: MessageSquare },
  { to: '/users', label: '用户管理', icon: Users, adminOnly: true },
  { to: '/knowledge', label: '知识库', icon: BookOpen },
  { to: '/tickets', label: '工单系统', icon: Ticket },
  { to: '/settings', label: '系统设置', icon: Settings },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { employee, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenu, setUserMenu] = useState(false);

  const visibleNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className={`fixed lg:sticky top-0 left-0 h-screen w-64 bg-slate-900 border-r border-slate-800 z-50 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="h-16 flex items-center gap-3 px-6 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <Server className="w-5 h-5 text-white" />
          </div>
          <span className="font-bold text-white text-lg">IT客服平台</span>
        </div>

        <nav className="p-4 space-y-1">
          {visibleNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                  isActive
                    ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-800">
          <div className="text-xs text-slate-600 text-center">v1.0.0 · © 2024</div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 bg-slate-900/80 backdrop-blur-xl border-b border-slate-800 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:text-slate-400 text-white p-2 hover:bg-slate-800 rounded-lg"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          <div className="relative">
            <button
              onClick={() => setUserMenu(!userMenu)}
              className="flex items-center gap-3 px-3 py-2 hover:bg-slate-800 rounded-xl transition"
            >
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white font-semibold text-sm">
                {employee?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium text-white">{employee?.name ?? '用户'}</div>
                <div className="text-xs text-slate-500">{employee?.role === 'admin' ? '管理员' : employee?.role === 'agent' ? '客服' : '普通用户'}</div>
              </div>
              <ChevronDown className="w-4 h-4 text-slate-500 hidden sm:block" />
            </button>

            {userMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenu(false)} />
                <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl py-2 z-50">
                  <div className="px-4 py-2 border-b border-slate-700">
                    <div className="text-sm font-medium text-white">{employee?.name}</div>
                    <div className="text-xs text-slate-500">{employee?.email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-slate-700/50 transition"
                  >
                    <LogOut className="w-4 h-4" />
                    退出登录
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
