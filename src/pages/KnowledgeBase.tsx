// src/pages/KnowledgeBase.tsx
import { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  FolderPlus,
  Folder,
  ChevronRight,
  Download,
  Upload,
  Eye,
  Tag,
  Loader2, CheckCircle, AlertCircle
} from 'lucide-react';
import { api, type KbArticle, type KbCategory } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function KnowledgeBase() {
  const { employee, isAdmin } = useAuth();
  const [categories, setCategories] = useState<KbCategory[]>([]);
  const [articles, setArticles] = useState<KbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewing, setViewing] = useState<KbArticle | null>(null);
  const [editing, setEditing] = useState<KbArticle | null>(null);
  const [form, setForm] = useState({ title: '', category_id: '', content: '', summary: '', tags: '', status: 'published' });
  const [catForm, setCatForm] = useState({ name: '', description: '' });
  const [importStatus, setImportStatus] = useState<{
    loading: boolean;
    message: string;
    success: boolean;
  }>({ loading: false, message: '', success: false });
  // 用于通用操作反馈（非确认对话框）
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | '';
  }>({ message: '', type: '' });

  // 用于删除确认对话框
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    type: 'article' | 'category';
    id: string;
    name: string;
  }>({ show: false, type: 'article', id: '', name: '' });


  useEffect(() => { loadCategories(); loadArticles(); }, []);

  const loadCategories = async () => {
    try {
      const data = await api.kbCategories.list();
      setCategories(data.sort((a, b) => a.sort_order - b.sort_order));
    } catch {
      setCategories([]);
    }
  };

  const loadArticles = async () => {
    setLoading(true);
    try {
      const data = await api.kbArticles.list();
      setArticles(data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
    } catch {
      setArticles([]);
    }
    setLoading(false);
  };

  const filtered = articles.filter(a => {
    if (search) {
      const q = search.toLowerCase();
      if (!a.title.toLowerCase().includes(q) && !a.content.toLowerCase().includes(q) && !a.tags?.some(t => t.toLowerCase().includes(q))) return false;
    }
    if (activeCategory && a.category_id !== activeCategory) return false;
    return true;
  });

  const getCategoryName = (id: string | null) => categories.find(c => c.id === id)?.name ?? '未分类';

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', category_id: activeCategory ?? categories[0]?.id ?? '', content: '', summary: '', tags: '', status: 'published' });
    setShowArticleModal(true);
  };

  const openEdit = (article: KbArticle) => {
    setEditing(article);
    setForm({
      title: article.title,
      category_id: article.category_id ?? '',
      content: article.content,
      summary: article.summary ?? '',
      tags: article.tags?.join(', ') ?? '',
      status: article.status,
    });
    setShowArticleModal(true);
  };

  const saveArticle = async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);

    try {
      if (editing) {
        await api.kbArticles.update(editing.id, {
          title: form.title,
          category_id: form.category_id || null,
          content: form.content,
          summary: form.summary || null,
          tags,
          status: form.status,
        });
      } else {
        await api.kbArticles.create({
          title: form.title,
          category_id: form.category_id || null,
          content: form.content,
          summary: form.summary || null,
          tags,
          status: form.status,
          author_id: employee?.id,
        });
      }
      setShowArticleModal(false);
      loadArticles();
    } catch { /* ignore */ }
  };

  const confirmDeleteArticle = (id: string, title: string) => {
    setDeleteConfirm({ show: true, type: 'article', id, name: title });
  };

  const viewArticle = async (article: KbArticle) => {
    setViewing(article);
    setShowViewModal(true);
    try {
      await api.kbArticles.view(article.id);
      // 更新本地视图计数（可选）
    } catch { /* ignore */ }
  };

  const saveCategory = async () => {
    if (!catForm.name.trim()) return;
    try {
      await api.kbCategories.create({
        name: catForm.name,
        description: catForm.description || null,
        sort_order: categories.length,
      });
      setCatForm({ name: '', description: '' });
      setShowCategoryModal(false);
      loadCategories();
    } catch { /* ignore */ }
  };
  const executeDelete = async () => {
    const { type, id, name } = deleteConfirm;
    try {
      if (type === 'article') {
        await api.kbArticles.delete(id);
        setNotification({ message: `✅ 文章“${name}”已删除`, type: 'success' });
      } else {
        await api.kbCategories.delete(id);
        if (activeCategory === id) setActiveCategory(null);
        setNotification({ message: `✅ 分类“${name}”已删除`, type: 'success' });
      }
      // 刷新数据
      if (type === 'article') loadArticles();
      else loadCategories();
    } catch (err: any) {
      setNotification({ message: `❌ 删除失败：${err.message || '未知错误'}`, type: 'error' });
    } finally {
      setDeleteConfirm({ show: false, type: 'article', id: '', name: '' });
      // 5秒后自动清除通知
      setTimeout(() => setNotification({ message: '', type: '' }), 5000);
    }
  };
  const confirmDeleteCategory = (id: string, name: string) => {
    setDeleteConfirm({ show: true, type: 'category', id, name });
  };

  // 导出/导入功能保留，但需要调整（使用api可能不支持直接导出，可保持原有逻辑）
  const exportArticles = () => {
    const data = JSON.stringify(articles, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kb_articles_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };


  const importFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['.txt', '.docx', '.pdf'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!validTypes.includes(ext)) {
      setImportStatus({ loading: false, message: '仅支持 .txt, .docx, .pdf 格式', success: false });
      e.target.value = '';
      return;
    }

    setImportStatus({ loading: true, message: '正在导入，请稍候...', success: false });

    try {
      const result = await api.kbArticles.importFile(file);
      setImportStatus({ loading: false, message: `✅ 导入成功：${result.title}`, success: true });
      loadArticles(); // 刷新列表
    } catch (err: any) {
      console.error('导入错误:', err);
      setImportStatus({ loading: false, message: `❌ 导入失败：${err.message || '请检查网络'}`, success: false });
    } finally {
      e.target.value = ''; // 清空 input，允许重新选择同一文件
      // 5 秒后自动清除消息（可选）
      setTimeout(() => {
        setImportStatus(prev => ({ ...prev, message: '' }));
      }, 5000);
    }
  };

  const articleCount = (catId: string) => articles.filter(a => a.category_id === catId).length;

  // JSX 完全保持不变，省略
  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Category sidebar */}
      <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col hidden lg:flex">
        <div className="p-4 border-b border-slate-800">
          {isAdmin ? (
            <button
              onClick={() => setShowCategoryModal(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-xl hover:bg-slate-700 transition text-sm font-medium"
            >
              <FolderPlus className="w-4 h-4" />
              添加分类
            </button>
          ) : <div className="h-2" />}
        </div>
        <div className="flex-1 overflow-auto p-2">
          <button
            onClick={() => setActiveCategory(null)}
            className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${activeCategory === null ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
          >
            <Folder className="w-4 h-4" />
            全部文章
            <span className="ml-auto text-xs text-slate-500">{articles.length}</span>
          </button>
          {categories.map(cat => (
            <div key={cat.id} className="group flex items-center">
              <button
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition ${activeCategory === cat.id ? 'bg-blue-500/15 text-blue-400' : 'text-slate-400 hover:bg-slate-800/50'}`}
              >
                <Folder className="w-4 h-4" />
                <span className="truncate">{cat.name}</span>
                <span className="ml-auto text-xs text-slate-500">{articleCount(cat.id)}</span>
              </button>
              {isAdmin && (
                <button
                  onClick={() => confirmDeleteCategory(cat.id, cat.name)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-auto">
        <div className="p-4 lg:p-6 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">知识库管理</h1>
              <p className="text-slate-400 mt-1">管理IT知识库分类与文章</p>
            </div>
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <label
                      className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-800 transition cursor-pointer text-sm font-medium">
                    <Upload className="w-4 h-4"/>
                    导入
                    <input
                        type="file"
                        accept=".txt,.docx,.pdf"
                        onChange={importFile}
                        className="hidden"
                    />
                  </label>
                  {/* 状态消息显示 */}
                  {importStatus.message && (
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm ${
                      importStatus.loading ? 'bg-blue-500/10 text-blue-400' :
                      importStatus.success ? 'bg-emerald-500/10 text-emerald-400' :
                      'bg-red-500/10 text-red-400'
                    }`}>
                      {importStatus.loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      {!importStatus.loading && (importStatus.success ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />)}
                      {importStatus.message}
                    </div>
                  )}
                  <button onClick={exportArticles}
                          className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 border border-slate-800 text-slate-300 rounded-xl hover:bg-slate-800 transition text-sm font-medium">
                    <Download className="w-4 h-4" />
                    导出
                  </button>
                  <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition text-sm">
                    <Plus className="w-4 h-4" />
                    新建文章
                  </button>
                </>
              )}
            </div>
          </div>

          {/* 操作反馈通知 */}
          {notification.message && (
            <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
              notification.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
              notification.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/30' :
              'bg-blue-500/10 text-blue-400 border border-blue-500/30'
            }`}>
              {notification.type === 'success' && <CheckCircle className="w-4 h-4" />}
              {notification.type === 'error' && <AlertCircle className="w-4 h-4" />}
              {notification.message}
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索文章标题、内容、标签..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none text-sm"
            />
          </div>

          {/* Articles grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {loading && <div className="col-span-full text-center text-slate-400 py-8">加载中...</div>}
            {!loading && filtered.length === 0 && (
              <div className="col-span-full text-center text-slate-400 py-8">暂无文章</div>
            )}
            {filtered.map(article => (
              <div key={article.id} className="group bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition cursor-pointer" onClick={() => viewArticle(article)}>
                <div className="flex items-start justify-between mb-3">
                  <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400">{getCategoryName(article.category_id)}</span>
                  {isAdmin && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition" onClick={e => e.stopPropagation()}>
                      <button onClick={() => openEdit(article)} className="p-1.5 text-slate-400 hover:text-blue-400 transition">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => confirmDeleteArticle(article.id, article.title)} className="p-1.5 text-slate-400 hover:text-red-400 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="text-white font-semibold mb-2 line-clamp-2">{article.title}</h3>
                <p className="text-sm text-slate-400 line-clamp-2 mb-3">{article.summary || article.content.replace(/[#*]/g, '').slice(0, 80)}</p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {article.tags?.slice(0, 3).map((tag, i) => (
                    <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center gap-1">
                      <Tag className="w-2.5 h-2.5" />
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{article.view_count} 次浏览</span>
                  <span>{new Date(article.updated_at).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Article modal */}
      {showArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowArticleModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">{editing ? '编辑文章' : '新建文章'}</h2>
              <button onClick={() => setShowArticleModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">标题 *</label>
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="文章标题" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">分类</label>
                  <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm">
                    <option value="">未分类</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1.5">状态</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm">
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">摘要</label>
                <input value={form.summary} onChange={e => setForm({ ...form, summary: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="文章摘要" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">标签（逗号分隔）</label>
                <input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="VPN, 网络, 连接失败" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">内容 *（支持 Markdown 格式）</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm({ ...form, content: e.target.value })}
                  rows={12}
                  className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm font-mono"
                  placeholder="## 症状&#10;描述问题症状...&#10;&#10;## 排查步骤&#10;1. 第一步...&#10;&#10;## 解决方案&#10;解决方案..."
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowArticleModal(false)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-sm">取消</button>
              <button onClick={saveArticle} className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition text-sm font-medium">{editing ? '保存' : '创建'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Category modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowCategoryModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">添加分类</h2>
              <button onClick={() => setShowCategoryModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">分类名称 *</label>
                <input value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="分类名称" />
              </div>
              <div>
                <label className="block text-sm text-slate-300 mb-1.5">描述</label>
                <input value={catForm.description} onChange={e => setCatForm({ ...catForm, description: e.target.value })} className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-2.5 text-white focus:border-blue-500 focus:outline-none text-sm" placeholder="分类描述" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowCategoryModal(false)} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-sm">取消</button>
              <button onClick={saveCategory} className="flex-1 px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition text-sm font-medium">创建</button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {showViewModal && viewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowViewModal(false)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div>
                <span className="text-xs px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 mb-2 inline-block">{getCategoryName(viewing.category_id)}</span>
                <h2 className="text-xl font-bold text-white">{viewing.title}</h2>
              </div>
              <button onClick={() => setShowViewModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-4">
              {viewing.tags?.map((tag, i) => (
                <span key={i} className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 flex items-center gap-1">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
            <div className="prose prose-invert max-w-none text-sm text-slate-300 whitespace-pre-wrap">{viewing.content}</div>
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800 text-xs text-slate-500">
              <span>{viewing.view_count} 次浏览 · {viewing.helpful_count} 次点赞</span>
              <span>更新于 {new Date(viewing.updated_at).toLocaleDateString('zh-CN')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm({ show: false, type: 'article', id: '', name: '' })}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-white mb-2">确认删除</h3>
            <p className="text-sm text-slate-300 mb-6">
              确定要删除{deleteConfirm.type === 'article' ? '文章' : '分类'} <strong className="text-white">“{deleteConfirm.name}”</strong> 吗？此操作不可撤销。
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm({ show: false, type: 'article', id: '', name: '' })} className="flex-1 px-4 py-2.5 bg-slate-800 text-slate-300 rounded-xl hover:bg-slate-700 transition text-sm">取消</button>
              <button onClick={executeDelete} className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 transition text-sm font-medium">确认删除</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


