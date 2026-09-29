// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export type Department = {
  id: string;
  name: string;
  code: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type Employee = {
  id: string;
  auth_id: string | null;   // 兼容原字段，可忽略
  employee_no: string;
  name: string;
  email: string | null;
  password?: string;
  phone: string | null;
  department_id: string | null;
  role: string;
  status: string;
  title: string | null;
  avatar_url: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type KbCategory = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type KbArticle = {
  id: string;
  title: string;
  category_id: string | null;
  content: string;
  summary: string | null;
  tags: string[];
  status: string;
  view_count: number;
  helpful_count: number;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  ticket_no: string;
  title: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  source: string;
  creator_id: string | null;
  assignee_id: string | null;
  conversation_id: string | null;
  solution: string | null;
  related_article_ids: string[];
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TicketRecord = {
  id: string;
  ticket_id: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  comment: string | null;
  operator_id: string | null;
  created_at: string;
};

export type Conversation = {
  id: string;
  title: string | null;
  user_id: string | null;
  status: string;
  message_count: number;
  ticket_id: string | null;
  summary: string | null;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: string;
  content: string;
  thinking: string | null;
  tool_calls: any;
  metadata: any;
  created_at: string;
};

export type OperationLog = {
  id: string;
  operator_id: string | null;
  operator_name: string | null;
  module: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
};

export type SystemSetting = {
  key: string;
  value: string;
  category: string;
  description: string | null;
  updated_by: string | null;
  updated_at: string;
};

// ---------- 请求基础函数 ----------
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem('token');
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || error.error || `请求失败 (${res.status})`);
  }

  return res.json();
}

// 先添加一个响应类型（在文件顶部 type 定义区域）
export type ImportFileResponse = {
  message: string;
  article_id: string;
  title: string;
  content_length: number;
};

// ---------- API 模块 ----------
export const api = {
  // ---- 认证 ----
  auth: {
    login: (email: string, password: string) =>
      request<{ token: string; employee: Employee }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    register: (email: string, password: string, name: string) =>
      request<{ message: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name }),
      }),
    me: () => request<Employee>('/auth/me'),
    logout: () => request('/auth/logout', { method: 'POST' }),
  },

  // ---- 员工 ----
  employees: {
    list: () => request<Employee[]>('/employees'),
    create: (data: Partial<Employee>) =>
      request<Employee>('/employees', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Employee>) =>
      request<Employee>(`/employees/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) => request(`/employees/${id}`, { method: 'DELETE' }),
    batchDelete: (ids: string[]) =>
      request('/employees/batch', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      }),
    batchUpdateStatus: (ids: string[], status: string) =>
      request('/employees/batch/status', {
        method: 'PATCH',
        body: JSON.stringify({ ids, status }),
      }),
  },

  // ---- 部门 ----
  departments: {
    list: () => request<Department[]>('/departments'),
    create: (data: Partial<Department>) =>
      request<Department>('/departments', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ---- 知识库分类 ----
  kbCategories: {
    list: () => request<KbCategory[]>('/kb/categories'),
    create: (data: Partial<KbCategory>) =>
      request<KbCategory>('/kb/categories', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/kb/categories/${id}`, { method: 'DELETE' }),
  },

  // ---- 知识库文章 ----
  kbArticles: {
    list: (params?: { status?: string }) =>
      request<KbArticle[]>(`/kb/articles${params ? '?' + new URLSearchParams(params as any) : ''}`),
    create: (data: Partial<KbArticle>) =>
      request<KbArticle>('/kb/articles', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<KbArticle>) =>
      request<KbArticle>(`/kb/articles/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/kb/articles/${id}`, { method: 'DELETE' }),
    view: (id: string) =>
      request<KbArticle>(`/kb/articles/${id}/view`, { method: 'POST' }),
    helpful: (id: string) =>
      request<KbArticle>(`/kb/articles/${id}/helpful`, { method: 'POST' }),

    // ✨ 新增：导入文件（支持 .txt, .docx, .pdf）
    importFile: (file: File): Promise<ImportFileResponse> => {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('token');
      return fetch(`${API_BASE}/kb/import-file`, {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      }).then(async (res) => {
        if (!res.ok) {
          const error = await res.json().catch(() => ({ detail: '请求失败' }));
          throw new Error(error.detail || error.error || `请求失败 (${res.status})`);
        }
        return res.json();
      });
    },
  },

  // ---- 对话 ----
  conversations: {
    list: () => request<Conversation[]>('/conversations'),
    create: (data: Partial<Conversation>) =>
      request<Conversation>('/conversations', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    update: (id: string, data: Partial<Conversation>) =>
      request<Conversation>(`/conversations/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/conversations/${id}`, { method: 'DELETE' }),
    getMessages: (id: string) =>
      request<Message[]>(`/conversations/${id}/messages`),
    addMessage: (id: string, data: Partial<Message>) =>
      request<Message>(`/conversations/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    ask: (id: string, data: { content: string }) =>
      request<{ user_message: Message; ai_message: Message }>(`/conversations/${id}/ask`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  },

  // ---- 工单 ----
  tickets: {
    list: () => request<Ticket[]>('/tickets'),
    create: (data: Partial<Ticket>) =>
      request<Ticket>('/tickets', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    get: (id: string) => request<Ticket>(`/tickets/${id}`),
    update: (id: string, data: Partial<Ticket>) =>
      request<Ticket>(`/tickets/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    getRecords: (id: string) =>
      request<TicketRecord[]>(`/tickets/${id}/records`),
    addRecord: (id: string, data: Partial<TicketRecord>) =>
      request<TicketRecord>(`/tickets/${id}/records`, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    getConversationMessages: (id: string) =>
      request<Message[]>(`/tickets/${id}/messages`),
    close: (id: string, solution: string) =>
      request<Ticket>(`/tickets/${id}/close`, {
        method: 'POST',
        body: JSON.stringify({ solution }),
      }),
  },

  // ---- 系统设置 ----
  settings: {
    list: () => request<SystemSetting[]>('/settings'),
    update: (key: string, value: string) =>
      request<SystemSetting>(`/settings/${key}`, {
        method: 'PUT',
        body: JSON.stringify({ value }),
      }),
  },

  // ---- 操作日志 ----
  logs: {
    list: (limit?: number) =>
      request<OperationLog[]>(`/logs${limit ? `?limit=${limit}` : ''}`),
  },

  // ---- 仪表盘统计 ----
  dashboard: {
    stats: () => request<any>('/dashboard/stats'),
    trend: (days?: number) =>
      request<any>(`/dashboard/trend${days ? `?days=${days}` : ''}`),
    faultDistribution: () => request<any>('/dashboard/fault-distribution'),
    statusDistribution: () => request<any>('/dashboard/status-distribution'),
  },
};

// src/lib/api.ts
export const streamAsk = async (
  convId: string,
  content: string,
  onChunk: (chunk: string) => void,
  onDone: (aiMessage: any) => void,
  onError: (err: Error) => void
) => {
  const token = localStorage.getItem('token');
  const response = await fetch(`${API_BASE}/conversations/${convId}/ask/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: '请求失败' }));
    throw new Error(error.detail || error.error);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';

  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.event === 'chunk') {
            onChunk(parsed.content);
          } else if (parsed.event === 'done') {
            onDone(parsed.ai_message);
          } else if (parsed.event === 'error') {
            onError(new Error(parsed.message));
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
};