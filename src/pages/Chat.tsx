// src/pages/Chat.tsx
import {useEffect, useRef, useState} from 'react';
import {
    Send,
    Sparkles,
    Brain,
    Ticket as TicketIcon,
    Plus,
    Trash2,
    Loader2,
    CheckCircle,
    AlertCircle,
    MessageSquare
} from 'lucide-react';
import {api, type KbArticle, type Conversation, type Message, streamAsk} from '@/lib/api';
import {generateAgentResponse} from '@/lib/agent';
import {useAuth} from '@/context/AuthContext';

const quickQuestions = [
    'VPN连接失败，提示错误代码808',
    'Outlook无法收发邮件',
    '打印机无法连接，提示脱机',
    '电脑蓝屏，错误代码0x0000007E',
    '无法连接公司WiFi',
    'C盘空间不足，系统卡顿',
];

type ChatMessage = {
    id: string;
    role: string;
    content: string;
    thinking: string[] | null;
    created_at: string;
    pending?: boolean;
};

export default function Chat() {
    const {employee} = useAuth();
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConv, setActiveConv] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [articles, setArticles] = useState<KbArticle[]>([]);
    const [showThinking, setShowThinking] = useState<Record<string, boolean>>({});
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadArticles();
        loadConversations();
    }, []);

    useEffect(() => {
        if (activeConv) loadMessages(activeConv);
    }, [activeConv]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
    }, [messages]);

    const loadArticles = async () => {
        try {
            const data = await api.kbArticles.list({status: 'published'});
            setArticles(data);
        } catch {
            setArticles([]);
        }
    };

    const loadConversations = async () => {
        try {
            const data = await api.conversations.list();
            const sorted = data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            setConversations(sorted);
            if (sorted.length > 0 && !activeConv) setActiveConv(sorted[0].id);
        } catch {
            setConversations([]);
        }
    };

    const loadMessages = async (convId: string) => {
        try {
            const data = await api.conversations.getMessages(convId);
            const mapped: ChatMessage[] = data.map(m => ({
                ...m,
                thinking: m.thinking ? m.thinking.split('\n') : null,
            }));
            setMessages(mapped);
        } catch {
            setMessages([]);
        }
    };

    const createConversation = async (): Promise<string | null> => {
        try {
            const newConv = await api.conversations.create({
                title: '新对话',
                user_id: employee?.id,
                status: 'active',
            });
            setConversations(prev => [newConv, ...prev]);
            setActiveConv(newConv.id);
            setMessages([]);
            return newConv.id;
        } catch {
            return null;
        }
    };

    const deleteConversation = async (convId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await api.conversations.delete(convId);
            setConversations(prev => prev.filter(c => c.id !== convId));
            if (activeConv === convId) {
                // 自动创建一个新对话，并设为当前活跃
                const newConv = await api.conversations.create({
                title: '新对话',
                user_id: employee?.id,
                status: 'active',
            });
                // 将新对话添加到列表最前面
                setConversations(prev => [newConv, ...prev]);
                setActiveConv(newConv.id);
                setMessages([]);   // 清空旧消息
            }
        } catch { /* ignore */
        }
    };


    const sendMessage = async (text?: string) => {
        const content = (text ?? input).trim();
        if (!content || loading) return;

        let convId = activeConv;
        let isNewConv = false;
        if (!convId) {
            convId = await createConversation();
            if (!convId) return;
            isNewConv = true;
        }else {
            // 检查当前对话的标题是否为默认值（"新对话" 或空）
            const currentConv = conversations.find(c => c.id === convId);
            if (currentConv && (currentConv.title === '新对话' || !currentConv.title)) {
                isNewConv = true;   // 视为新对话，需要更新标题
            }
        }

        setInput('');
        setLoading(true);

        // 1. 乐观添加用户消息（临时）
        const tempUserMsg: ChatMessage = {
            id: `temp-${Date.now()}`,
            role: 'user',
            content,
            thinking: null,
            created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, tempUserMsg]);

        // 2. 预先添加一个“占位”的 AI 消息（空内容，稍后填充）
        const tempAiMsgId = `temp-ai-${Date.now()}`;
        const tempAiMsg: ChatMessage = {
            id: tempAiMsgId,
            role: 'assistant',
            content: '🤔 思考中...',
            thinking: null,
            created_at: new Date().toISOString(),
            pending: true, // 标记为正在生成
        };
        setMessages(prev => [...prev, tempAiMsg]);

        try {
            // 3. 发起流式请求
            await streamAsk(
                convId,
                content,
                // onChunk
                (chunk) => {
                    setMessages(prev =>
                        prev.map(msg => {
                            if (msg.id === tempAiMsgId) {
                                const placeholder = '🤔 思考中...';
                                // 如果当前内容正是占位符，替换为 chunk；否则追加
                                if (msg.content === placeholder) {
                                    return {...msg, content: chunk};
                                } else {
                                    return {...msg, content: msg.content + chunk};
                                }
                            }
                            return msg;
                        })
                    );
                },
                // onDone
                async (aiMessage) => {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === tempAiMsgId
                                ? {...msg, id: aiMessage.id, pending: false}  // 保留内容
                                : msg
                        )
                    );
                    // ✅ 如果是新建对话，直接更新标题（无需查询列表判断）
                    if (isNewConv) {
                        try {
                            // 截取用户消息前 20 个字符作为新标题
                            const newTitle = content.slice(0, 20) + (content.length > 20 ? '...' : '');
                            await api.conversations.update(convId, { title: newTitle });
                            // 刷新对话列表，让左侧显示新标题
                            await loadConversations();
                        } catch (err) {
                            console.error('更新对话标题失败:', err);
                        }
                    }
                },

                // onError: 错误处理
                (err) => {
                    setMessages(prev =>
                        prev.map(msg =>
                            msg.id === tempAiMsgId
                                ? {...msg, content: '⚠️ 生成失败，请重试', pending: false}
                                : msg
                        )
                    );
                    console.error(err);
                }
            );

        } finally {
            setLoading(false);
        }
    };

    const createTicketFromChat = async () => {
        if (!activeConv || !employee) return;
        const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return;

        const ticketNo = `TK${Date.now().toString().slice(-8)}`;
        try {
            const newTicket = await api.tickets.create({
                ticket_no: ticketNo,
                title: lastUserMsg.content.slice(0, 50),
                description: lastUserMsg.content,
                category: '其他',
                priority: 'medium',
                status: 'pending',
                source: 'chat',
                creator_id: employee.id,
                conversation_id: activeConv,
            });
            await api.conversations.update(activeConv, {ticket_id: newTicket.id});
            alert(`工单已创建：${ticketNo}`);
        } catch (err) {
            alert('创建工单失败');
        }
    };

    // ... 渲染部分保持不变（JSX 完全相同）
    // 注意：除了上面所有数据获取与修改的函数，JSX 完全不变，因此省略渲染代码以节省篇幅。
    // 实际使用时将 JSX 原样复制即可。

    return (
        <div className="flex h-[calc(100vh-4rem)]">
            {/* Conversation list */}
            <div className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col hidden lg:flex">
                <div className="p-4 border-b border-slate-800">
                    <button
                        onClick={createConversation}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded-xl hover:bg-blue-500/25 transition text-sm font-medium"
                    >
                        <Plus className="w-4 h-4"/>
                        新建对话
                    </button>
                </div>
                <div className="flex-1 overflow-auto p-2 space-y-1">
                    {conversations.length === 0 && (
                        <div className="text-center text-slate-500 text-sm py-8">暂无对话记录</div>
                    )}
                    {conversations.map(conv => (
                        <div
                            key={conv.id}
                            onClick={() => setActiveConv(conv.id)}
                            className={`group flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition ${
                                activeConv === conv.id ? 'bg-slate-800' : 'hover:bg-slate-800/50'
                            }`}
                        >
                            <MessageSquare className="w-4 h-4 text-slate-500 flex-shrink-0"/>
                            <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{conv.title || '新对话'}</div>
                                <div className="text-xs text-slate-500">{conv.message_count} 条消息</div>
                            </div>
                            <button
                                onClick={(e) => deleteConversation(conv.id, e)}
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition"
                            >
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-auto p-4 lg:p-6 space-y-6">
                    {messages.length === 0 && !loading && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div
                                className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4">
                                <Sparkles className="w-8 h-8 text-white"/>
                            </div>
                            <h2 className="text-xl font-bold text-white mb-2">IT智能客服</h2>
                            <p className="text-slate-400 mb-6">描述您遇到的IT问题，我将为您匹配解决方案</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl w-full">
                                {quickQuestions.map((q, i) => (
                                    <button
                                        key={i}
                                        onClick={() => sendMessage(q)}
                                        className="text-left px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-sm text-slate-300 hover:border-blue-500/30 hover:text-blue-400 transition"
                                    >
                                        {q}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                                msg.role === 'user'
                                    ? 'bg-gradient-to-br from-cyan-500 to-blue-500'
                                    : 'bg-gradient-to-br from-blue-500 to-cyan-500'
                            }`}>
                                {msg.role === 'user' ? (
                                    <span
                                        className="text-white text-sm font-semibold">{employee?.name?.charAt(0) ?? 'U'}</span>
                                ) : (
                                    <Sparkles className="w-5 h-5 text-white"/>
                                )}
                            </div>
                            <div
                                className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                                {/* Thinking process */}
                                {msg.thinking && msg.thinking.length > 0 && (
                                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 max-w-full">
                                        <button
                                            onClick={() => setShowThinking(prev => ({
                                                ...prev,
                                                [msg.id]: !prev[msg.id]
                                            }))}
                                            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-300 transition"
                                        >
                                            <Brain className="w-4 h-4 text-purple-400"/>
                                            思考过程 ({msg.thinking.length} 步)
                                            {showThinking[msg.id] ? ' ▼' : ' ▶'}
                                        </button>
                                        {showThinking[msg.id] && (
                                            <div className="mt-2 space-y-1.5">
                                                {msg.thinking.map((step, i) => (
                                                    <div key={i}
                                                         className="flex items-start gap-2 text-xs text-slate-500">
                                                        <span className="text-purple-400 font-mono">{i + 1}.</span>
                                                        <span>{step}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Message content */}
                                <div className={`rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap ${
                                    msg.role === 'user'
                                        ? 'bg-blue-500 text-white'
                                        : 'bg-slate-900 border border-slate-800 text-slate-200'
                                }`}>
                                    {msg.content}
                                </div>

                                {/* Action buttons for AI messages */}
                                {msg.role === 'assistant' && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={createTicketFromChat}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400 hover:text-amber-400 hover:border-amber-500/30 transition"
                                        >
                                            <TicketIcon className="w-3.5 h-3.5"/>
                                            转工单
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {loading && !messages.some(m => m.role === 'assistant' && m.pending) && (
                        <div className="flex gap-3">
                            <div
                                className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-5 h-5 text-white"/>
                            </div>
                            <div
                                className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-2">
                                <Loader2 className="w-4 h-4 text-blue-400 animate-spin"/>
                                <span className="text-sm text-slate-400">正在分析问题...</span>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef}/>
                </div>

                {/* Input */}
                <div className="border-t border-slate-800 p-4 bg-slate-900/50">
                    <div className="max-w-4xl mx-auto flex gap-3">
                        <input
                            type="text"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                            placeholder="描述您遇到的IT问题..."
                            className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                        />
                        <button
                            onClick={() => sendMessage()}
                            disabled={loading || !input.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl font-medium hover:from-blue-600 hover:to-cyan-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Send className="w-4 h-4"/>
                            发送
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
