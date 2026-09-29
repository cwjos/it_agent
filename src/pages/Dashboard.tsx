import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend } from 'recharts';
import { MessageSquare, CheckCircle, Ticket as TicketIcon, Clock, Users, Activity, Zap } from 'lucide-react';
import { api } from '@/lib/api';

const COLORS = ['#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

type Stats = {
  totalConversations: number;
  resolvedTickets: number;
  totalTickets: number;
  activeTickets: number;
  avgResponseTime: string;
  onlineAgents: number;
};

type TrendPoint = {
  date: string;
  count: number;
  resolved: number;
  created: number;
};

type DistItem = { name: string; value: number };

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalConversations: 0,
    resolvedTickets: 0,
    totalTickets: 0,
    activeTickets: 0,
    avgResponseTime: '-',
    onlineAgents: 0,
  });
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [faultDist, setFaultDist] = useState<DistItem[]>([]);
  const [ticketStatusDist, setTicketStatusDist] = useState<DistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, trendData, faultData, statusData] = await Promise.all([
        api.dashboard.stats(),
        api.dashboard.trend(),
        api.dashboard.faultDistribution(),
        api.dashboard.statusDistribution(),
      ]);

      setStats(statsData);
      setTrend(trendData);
      setFaultDist(faultData);
      setTicketStatusDist(statusData);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: '对话总量',
      value: stats.totalConversations,
      icon: MessageSquare,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: '工单解决率',
      value: `${stats.totalTickets > 0 ? Math.round(stats.resolvedTickets / stats.totalTickets * 100) : 0}%`,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600',
    },
    {
      label: '活跃工单',
      value: stats.activeTickets,
      icon: TicketIcon,
      color: 'from-amber-500 to-amber-600',
    },
    {
      label: '在线客服',
      value: stats.onlineAgents,
      icon: Users,
      color: 'from-cyan-500 to-cyan-600',
    },
  ];

  if (loading) {
    return (
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">数据大屏</h1>
          <p className="text-slate-400 mt-1">实时监控IT客服运营数据</p>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-400">加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">数据大屏</h1>
          <p className="text-slate-400 mt-1">实时监控IT客服运营数据</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-xl border border-slate-800">
          <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
          <span className="text-sm text-slate-300">实时更新</span>
          <span className="text-xs text-slate-500">{new Date().toLocaleString('zh-CN')}</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition group">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center group-hover:scale-110 transition`}>
                <card.icon className="w-6 h-6 text-white" />
              </div>
            </div>
            <div className="text-3xl font-bold text-white mb-1">{card.value}</div>
            <div className="text-sm text-slate-400">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">对话量趋势</h3>
              <p className="text-sm text-slate-400 mt-1">近7天对话与解决量</p>
            </div>
            <MessageSquare className="w-5 h-5 text-blue-400" />
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="convGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
              <Area type="monotone" dataKey="count" stroke="#3b82f6" fill="url(#convGrad)" name="对话量" strokeWidth={2} />
              <Area type="monotone" dataKey="resolved" stroke="#10b981" fill="url(#resGrad)" name="解决量" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fault distribution */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">故障类型分布</h3>
              <p className="text-sm text-slate-400 mt-1">工单按故障分类统计</p>
            </div>
            <Zap className="w-5 h-5 text-amber-400" />
          </div>
          {faultDist.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-slate-500">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={faultDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} paddingAngle={3}>
                  {faultDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ticket trend */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">工单趋势</h3>
              <p className="text-sm text-slate-400 mt-1">近7天工单创建与解决</p>
            </div>
            <TicketIcon className="w-5 h-5 text-cyan-400" />
          </div>
          {trend.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-slate-500">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }} />
                <Line type="monotone" dataKey="created" stroke="#06b6d4" name="新建工单" strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="resolved" stroke="#10b981" name="解决工单" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Ticket status */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">工单状态分布</h3>
              <p className="text-sm text-slate-400 mt-1">当前各状态工单数量</p>
            </div>
            <Clock className="w-5 h-5 text-purple-400" />
          </div>
          {ticketStatusDist.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-slate-500">暂无数据</div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ticketStatusDist}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                <YAxis stroke="#64748b" fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                  {ticketStatusDist.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
