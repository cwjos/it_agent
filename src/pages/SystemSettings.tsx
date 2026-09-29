// src/pages/SystemSettings.tsx
import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, Cpu, Bell, FileText, Save, User, Mail, Phone, Building2, Lock } from 'lucide-react';
import { api, type SystemSetting, type OperationLog, type Department, type Employee } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type Tab = 'profile' | 'model' | 'notification' | 'logs';

export default function SystemSettings() {
  const { employee, isAdmin, refreshEmployee } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [profileForm, setProfileForm] = useState({ name: '', email: '', phone: '', title: '', department_id: '' });

  useEffect(() => {
    loadSettings();
    loadLogs();
    loadDepartments();
    if (employee) {
      setProfileForm({
        name: employee.name,
        email: employee.email ?? '',
        phone: employee.phone ?? '',
        title: employee.title ?? '',
        department_id: employee.department_id ?? '',
      });
    }
  }, [employee]);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.settings.list();
      setSettings(data);
      const values: Record<string, string> = {};
      data.forEach(s => { values[s.key] = s.value; });
      setFormValues(values);
    } catch {
      setSettings([]);
    }
    setLoading(false);
  };

  const loadLogs = async () => {
    try {
      const data = await api.logs.list(50);
      setLogs(data);
    } catch {
      setLogs([]);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await api.departments.list();
      setDepartments(data.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setDepartments([]);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      for (const [key, value] of Object.entries(formValues)) {
        await api.settings.update(key, value);
      }
      // 记录操作日志（后端自动记录，或手动调用）
      await loadLogs();
      alert('设置已保存');
    } catch {
      alert('保存失败');
    }
    setSaving(false);
  };

  const saveProfile = async () => {
    if (!employee) return;
    setSavingProfile(true);
    try {
      await api.employees.update(employee.id, {
        name: profileForm.name,
        email: profileForm.email || null,
        phone: profileForm.phone || null,
        title: profileForm.title || null,
        department_id: profileForm.department_id || null,
      });
      await refreshEmployee();
      alert('个人信息已保存');
    } catch (err: any) {
      alert('保存失败：' + err.message);
    }
    setSavingProfile(false);
  };

  const modelSettings = settings.filter(s => s.category === 'model');
  const notificationSettings = settings.filter(s => s.category === 'notification');

  const allTabs = [
    { id: 'profile' as Tab, label: '个人信息', icon: User },
    { id: 'model' as Tab, label: '模型配置', icon: Cpu, adminOnly: true },
    { id: 'notification' as Tab, label: '通知设置', icon: Bell, adminOnly: true },
    { id: 'logs' as Tab, label: '操作日志', icon: FileText, adminOnly: true },
  ];
  const tabs = allTabs.filter(t => !t.adminOnly || isAdmin);

  const renderField = (setting: SystemSetting) => {
    const value = formValues[setting.key] ?? '';
    const isBoolean = value === 'true' || value === 'false' || setting.key.includes('enabled') || setting.key.includes('notification_');

    return (
      <div key={setting.key} className="bg-slate-800/30 rounded-xl p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-sm font-medium text-white">{setting.description ?? setting.key}</div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono">{setting.key}</div>
          </div>
        </div>
        {isBoolean ? (
          <label className="flex items-center gap-2 cursor-pointer mt-2">
            <button
              type="button"
              onClick={() => setFormValues({ ...formValues, [setting.key]: value === 'true' ? 'false' : 'true' })}
              className={`relative w-11 h-6 rounded-full transition ${value === 'true' ? 'bg-blue-500' : 'bg-slate-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${value === 'true' ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-slate-400">{value === 'true' ? '已启用' : '已禁用'}</span>
          </label>
        ) : (
          <input
            value={value}
            onChange={e => setFormValues({ ...formValues, [setting.key]: e.target.value })}
            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm mt-2"
            placeholder={setting.description ?? ''}
          />
        )}
      </div>
    );
  };

  // JSX 部分保持原样，无需修改
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">系统设置</h1>
        <p className="text-slate-400 mt-1">
          {isAdmin ? '管理个人信息、AI模型、通知规则与操作日志' : '管理您的个人信息'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
              tab === t.id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading && tab !== 'profile' ? (
        <div className="text-center text-slate-400 py-8">加载中...</div>
      ) : tab === 'profile' ? (
        <div className="space-y-4 max-w-2xl">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">个人信息</h3>
                <p className="text-sm text-slate-400">修改您的姓名、联系方式与部门</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">姓名 *</label>
                <input
                  value={profileForm.name}
                  onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                  placeholder="请输入姓名"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">邮箱</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                      placeholder="邮箱地址"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">手机号</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      value={profileForm.phone}
                      onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                      placeholder="手机号码"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">职位</label>
                  <input
                    value={profileForm.title}
                    onChange={e => setProfileForm({ ...profileForm, title: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                    placeholder="职位"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">部门</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <select
                      value={profileForm.department_id}
                      onChange={e => setProfileForm({ ...profileForm, department_id: e.target.value })}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                    >
                      <option value="">未分配</option>
                      {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6">
              <button
                onClick={saveProfile}
                disabled={savingProfile || !profileForm.name.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition text-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? '保存中...' : '保存个人信息'}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Lock className="w-6 h-6 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">账号安全</h3>
                <p className="text-sm text-slate-400">您的账号信息</p>
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">工号</span>
                <span className="text-white font-mono">{employee?.employee_no ?? '-'}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-800">
                <span className="text-slate-400">角色</span>
                <span className="text-white">
                  {employee?.role === 'admin' ? '管理员' : employee?.role === 'agent' ? '客服' : '普通用户'}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">账号状态</span>
                <span className="text-emerald-400">{employee?.status === 'active' ? '在职' : employee?.status === 'inactive' ? '停用' : '休假'}</span>
              </div>
            </div>
          </div>
        </div>
      ) : tab === 'model' ? (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">AI模型配置</h3>
                <p className="text-sm text-slate-400">配置智能客服使用的AI模型参数</p>
              </div>
            </div>
            <div className="space-y-3">
              {modelSettings.map(renderField)}
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      ) : tab === 'notification' ? (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center">
                <Bell className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">通知设置</h3>
                <p className="text-sm text-slate-400">配置工单和系统通知规则</p>
              </div>
            </div>
            <div className="space-y-3">
              {notificationSettings.map(renderField)}
            </div>
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition text-sm disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-slate-800">
            <h3 className="text-lg font-semibold text-white">操作日志</h3>
            <p className="text-sm text-slate-400 mt-1">最近50条系统操作记录</p>
          </div>
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">操作人</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">模块</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">操作</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">详情</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">时间</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">暂无操作日志</td></tr>}
                {logs.map(log => (
                  <tr key={log.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                    <td className="px-4 py-3 text-sm text-white">{log.operator_name ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-300">{log.module}</td>
                    <td className="px-4 py-3 text-sm text-blue-400">{log.action}</td>
                    <td className="px-4 py-3 text-sm text-slate-400 max-w-[200px] truncate">{log.detail ?? '-'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

