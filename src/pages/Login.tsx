import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, User, Eye, EyeOff, RefreshCw, Sparkles, Server, Headphones, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const { signIn, signUp, employee } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captcha, setCaptcha] = useState('');
  const [captchaCode, setCaptchaCode] = useState('');
  const [remember, setRemember] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const generateCaptcha = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    setCaptchaCode(code);
  };

  useEffect(() => { generateCaptcha(); }, []);

  // 监听 employee 变化，自动跳转
  useEffect(() => {
    console.log('Login: employee 变化:', employee);
    if (employee) {
      console.log('Login: 即将跳转到 /dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [employee, navigate]);

  useEffect(() => {
    const saved = localStorage.getItem('remembered_credentials');
    if (saved) {
      try {
        const { email: e, password: p } = JSON.parse(saved);
        setEmail(e);
        setPassword(p);
        setRemember(true);
      } catch { /* ignore */ }
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (captcha.toUpperCase() !== captchaCode) {
      setError('验证码错误，请重新输入');
      generateCaptcha();
      setCaptcha('');
      return;
    }

    setLoading(true);
    if (mode === 'login') {
      const { error: err } = await signIn(email, password);
      if (err) {
        setError(err === 'Invalid login credentials' ? '邮箱或密码错误' : err);
        generateCaptcha();
        setCaptcha('');
        setLoading(false);
      } else {
        // 处理记住密码
        if (remember) {
          localStorage.setItem('remembered_credentials', JSON.stringify({ email, password }));
        } else {
          localStorage.removeItem('remembered_credentials');
        }
        // 注意：不手动 navigate，等待 useEffect 触发跳转
        // 但需要重置 loading，因为跳转由 useEffect 触发，但为了防止按钮一直转圈，我们在跳转前重置
        setLoading(false);
        // 此时 employee 已更新，useEffect 会立即触发跳转
      }
    } else {
      // 注册逻辑（保持不变）
      if (!name.trim()) {
        setError('请输入姓名');
        setLoading(false);
        return;
      }
      const { error: err } = await signUp(email, password, name);
      if (err) {
        setError(err === 'User already registered' ? '该邮箱已注册' : err);
        generateCaptcha();
        setCaptcha('');
        setLoading(false);
      } else {
        setError('');
        setMode('login');
        setLoading(false);
        // 注册成功后切换到登录模式，不自动跳转
        return;
      }
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-950">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(59,130,246,0.3) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(14,165,233,0.2) 0%, transparent 50%)'
        }} />
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Server className="w-7 h-7" />
            </div>
            <span className="text-2xl font-bold">IT智能客服平台</span>
          </div>
          <h1 className="text-4xl font-bold mb-6 leading-tight">
            企业级IT运维<br />智能客服解决方案
          </h1>
          <p className="text-slate-400 text-lg mb-10 leading-relaxed">
            AI驱动的知识库匹配，7×24小时自动响应，工单全流程管理，让IT运维更高效。
          </p>
          <div className="space-y-4">
            {[
              { icon: Sparkles, text: 'AI智能匹配，秒级响应IT故障问题' },
              { icon: Headphones, text: '全渠道工单流转，闭环跟踪处理' },
              { icon: Activity, text: '数据可视化大屏，实时掌握运营态势' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-slate-300">
                <item.icon className="w-5 h-5 text-blue-400" />
                <span>{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <Server className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">IT智能客服平台</span>
          </div>

          <div className="bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-800 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-2">
              {mode === 'login' ? '欢迎回来' : '注册账号'}
            </h2>
            <p className="text-slate-400 mb-8">
              {mode === 'login' ? '请登录您的账号' : '创建一个新账号开始使用'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              {mode === 'register' && (
                <div>
                  <label className="block text-sm text-slate-300 mb-2">姓名</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                      placeholder="请输入姓名"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm text-slate-300 mb-2">邮箱</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                    placeholder="请输入邮箱"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-11 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                    placeholder="请输入密码"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-300 mb-2">验证码</label>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={captcha}
                      onChange={e => setCaptcha(e.target.value)}
                      required
                      maxLength={4}
                      className="w-full bg-slate-800/50 border border-slate-700 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition uppercase"
                      placeholder="请输入验证码"
                    />
                  </div>
                  <div
                    className="w-28 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center cursor-pointer select-none font-mono text-xl font-bold tracking-widest text-blue-400"
                    style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}
                    onClick={generateCaptcha}
                    title="点击刷新验证码"
                  >
                    {captchaCode}
                  </div>
                </div>
              </div>

              {mode === 'login' && (
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={e => setRemember(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
                    />
                    记住密码
                  </label>
                  <button type="button" className="text-sm text-blue-400 hover:text-blue-300">
                    忘记密码？
                  </button>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : mode === 'login' ? '登 录' : '注 册'}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-400">
              {mode === 'login' ? (
                <>
                  还没有账号？{' '}
                  <button onClick={() => { setMode('register'); setError(''); }} className="text-blue-400 hover:text-blue-300 font-medium">
                    立即注册
                  </button>
                </>
              ) : (
                <>
                  已有账号？{' '}
                  <button onClick={() => { setMode('login'); setError(''); }} className="text-blue-400 hover:text-blue-300 font-medium">
                    返回登录
                  </button>
                </>
              )}
            </div>
          </div>

          <p className="text-center text-xs text-slate-600 mt-6">
            © 2024 IT智能客服平台 · 企业级IT运维解决方案
          </p>
        </div>
      </div>
    </div>
  );
}
