// src/pages/UserManagement.tsx
import { useEffect, useState } from 'react';
import { Users, Plus, Search, Edit2, Trash2, X, CheckCircle, XCircle, Mail, Phone, Building2, Filter } from 'lucide-react';
import { api, type Employee, type Department } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function UserManagement() {
  const { employee: currentUser } = useAuth();
  const [users, setUsers] = useState<(Employee & { department_name?: string })[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    department_id: '',
    role: 'agent',
    status: 'active',
    title: '',
    password: '',
  });

  useEffect(() => {
    (async () => {
      const data = await api.departments.list();
      const sorted = data.sort((a, b) => a.sort_order - b.sort_order);
      setDepartments(sorted);
      await loadUsers(sorted);
    })();
  }, []);


  const loadDepartments = async () => {
    try {
      const data = await api.departments.list();
      setDepartments(data.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setDepartments([]);
    }
  };

  const loadUsers = async (depts?: Department[]) => {
    setLoading(true);
    try {
      const data = await api.employees.list();
      const deptMap = Object.fromEntries((depts ?? departments).map(d => [d.id, d.name]));
      const list = data.map(u => ({ ...u, department_name: u.department_id ? deptMap[u.department_id] : undefined }));
      setUsers(list);
    } catch {
      setUsers([]);
    }
    setLoading(false);
  };


  const filtered = users.filter(u => {
    if (search && !u.name.includes(search) && !u.email?.includes(search) && !u.employee_no.includes(search)) return false;
    if (deptFilter !== 'all' && u.department_id !== deptFilter) return false;
    if (statusFilter !== 'all' && u.status !== statusFilter) return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(f => f.id)));
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: '',
      email: '',
      phone: '',
      department_id: departments[0]?.id ?? '',
      role: 'agent',
      status: 'active',
      title: '',
      password: '',
    });
    console.log('Open create, form:', form);
    setShowModal(true);
  };

  const openEdit = (user: Employee) => {
    setEditing(user);
    setForm({
      name: user.name,
      email: user.email ?? '',
      phone: user.phone ?? '',
      department_id: user.department_id ?? '',
      role: user.role,
      status: user.status,
      title: user.title ?? '',
      password: '',
    });
    setShowModal(true);
  };

  const saveUser = async () => {
    if (!form.name.trim()) return;
    if (!editing && !form.password) {
      alert('请设置密码');
      return;
    }

    try {
      if (editing) {
        await api.employees.update(editing.id, {
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          department_id: form.department_id || null,
          role: form.role,
          status: form.status,
          title: form.title || null,
          // 编辑时不修改密码
        });
      } else {
        await api.employees.create({
          employee_no: `EMP${Date.now().toString().slice(-6)}`,
          name: form.name,
          email: form.email || null,
          phone: form.phone || null,
          department_id: form.department_id || null,
          role: form.role,
          status: form.status,
          title: form.title || null,
          password: form.password, // 传递密码
        });
      }
      setShowModal(false);
      loadUsers(); // 重新加载
    } catch (err) {
      console.error(err);
      alert('保存失败');
    }
  };

  const deleteUser = async (id: string) => {
    if (!confirm('确认删除该用户？')) return;
    try {
      await api.employees.delete(id);
      loadUsers();
    } catch { /* ignore */ }
  };

  const batchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确认删除选中的 ${selected.size} 个用户？`)) return;
    try {
      await api.employees.batchDelete(Array.from(selected));
      setSelected(new Set());
      loadUsers();
    } catch { /* ignore */ }
  };

  const batchUpdateStatus = async (status: string) => {
    if (selected.size === 0) return;
    try {
      await api.employees.batchUpdateStatus(Array.from(selected), status);
      setSelected(new Set());
      loadUsers();
    } catch { /* ignore */ }
  };

  const roleLabels: Record<string, string> = { admin: '管理员', agent: '客服', user: '普通用户' };
  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: '在职', color: 'text-emerald-400 bg-emerald-500/10' },
    inactive: { label: '停用', color: 'text-red-400 bg-red-500/10' },
    suspended: { label: '休假', color: 'text-amber-400 bg-amber-500/10' },
  };

  // JSX 部分完全不变，省略
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">用户管理</h1>
          <p className="text-slate-400 mt-1">管理平台用户、部门分组与权限</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition"
        >
          <Plus className="w-4 h-4" />
          添加用户
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索姓名、邮箱、工号..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
          />
        </div>
        <select
          value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">全部部门</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">全部状态</option>
          <option value="active">在职</option>
          <option value="inactive">停用</option>
          <option value="suspended">休假</option>
        </select>
      </div>

      {/* Batch actions */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <span className="text-sm text-blue-400">已选中 {selected.size} 个用户</span>
          <button onClick={() => batchUpdateStatus('active')} className="px-3 py-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg text-sm hover:bg-emerald-500/30 transition">批量启用</button>
          <button onClick={() => batchUpdateStatus('inactive')} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition">批量停用</button>
          <button onClick={batchDelete} className="px-3 py-1.5 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition">批量删除</button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-1.5 bg-slate-700 text-slate-300 rounded-lg text-sm hover:bg-slate-600 transition">取消</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50">
                <th className="px-4 py-3 text-left">
                  <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">用户</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">工号</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">部门</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">角色</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">状态</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-400 uppercase">操作</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">加载中...</td></tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">暂无用户数据</td></tr>
              )}
              {filtered.map(user => (
                <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selected.has(user.id)} onChange={() => toggleSelect(user.id)} className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white text-sm font-semibold">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-white">{user.name}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-300 font-mono">{user.employee_no}</td>
                  <td className="px-4 py-3 text-sm text-slate-300">{user.department_name ?? '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-1 rounded-lg bg-slate-800 text-slate-300">{roleLabels[user.role] ?? user.role}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-lg ${statusLabels[user.status]?.color ?? statusLabels.active.color}`}>
                      {statusLabels[user.status]?.label ?? user.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => openEdit(user)} className="p-1.5 text-slate-400 hover:text-blue-400 transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {user.id !== currentUser?.id && (
                        <button onClick={() => deleteUser(user.id)} className="p-1.5 text-slate-400 hover:text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? '编辑用户' : '添加用户'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">姓名 *</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="请输入姓名" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">邮箱</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="请输入邮箱" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">手机号</label>
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="请输入手机号" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">部门</label>
                <select value={form.department_id} onChange={e => setForm({ ...form, department_id: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm">
                  <option value="">未分配</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">角色</label>
                  <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm">
                    <option value="admin">管理员</option>
                    <option value="agent">客服</option>
                    <option value="user">普通用户</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm">
                    <option value="active">在职</option>
                    <option value="inactive">停用</option>
                    <option value="suspended">休假</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">职位</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} autoComplete="off" className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="请输入职位" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">密码 *</label>
                  <input
                    type="password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm"
                    autoComplete="new-password"
                    placeholder="请设置初始密码"
                  />
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-sm">取消</button>
              <button onClick={saveUser} className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition text-sm font-medium">{editing ? '保存' : '添加'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

