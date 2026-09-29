// import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
// import type { Session } from '@supabase/supabase-js';
// import { supabase, type Employee } from '@/lib/supabase';
//
// type AuthContextType = {
//   session: Session | null;
//   employee: Employee | null;
//   loading: boolean;
//   isAdmin: boolean;
//   signIn: (email: string, password: string) => Promise<{ error: string | null }>;
//   signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
//   signOut: () => Promise<void>;
//   refreshEmployee: () => Promise<void>;
// };
//
// const AuthContext = createContext<AuthContextType | undefined>(undefined);
//
// export function AuthProvider({ children }: { children: ReactNode }) {
//   const [session, setSession] = useState<Session | null>(null);
//   const [employee, setEmployee] = useState<Employee | null>(null);
//   const [loading, setLoading] = useState(true);
//
//   const fetchEmployee = async (authId: string) => {
//     const { data } = await supabase
//       .from('employees')
//       .select('*')
//       .eq('auth_id', authId)
//       .maybeSingle();
//     setEmployee(data as Employee | null);
//   };
//
//   useEffect(() => {
//     supabase.auth.getSession().then(({ data: { session: s } }) => {
//       setSession(s);
//       if (s?.user?.id) {
//         fetchEmployee(s.user.id).finally(() => setLoading(false));
//       } else {
//         setLoading(false);
//       }
//     });
//
//     const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
//       (async () => {
//         setSession(s);
//         if (s?.user?.id) {
//           await fetchEmployee(s.user.id);
//         } else {
//           setEmployee(null);
//         }
//         setLoading(false);
//       })();
//     });
//
//     return () => listener.subscription.unsubscribe();
//   }, []);
//
//   const signIn = async (email: string, password: string) => {
//     const { error } = await supabase.auth.signInWithPassword({ email, password });
//     return { error: error?.message ?? null };
//   };
//
//   const signUp = async (email: string, password: string, name: string) => {
//     const { data, error } = await supabase.auth.signUp({ email, password });
//     if (error) return { error: error.message };
//     if (data.user) {
//       await supabase.from('employees').insert({
//         auth_id: data.user.id,
//         employee_no: `EMP${Date.now().toString().slice(-6)}`,
//         name,
//         email,
//         role: 'user',
//         status: 'active',
//       });
//     }
//     return { error: null };
//   };
//
//   const signOut = async () => {
//     await supabase.auth.signOut();
//     setSession(null);
//     setEmployee(null);
//   };
//
//   const refreshEmployee = async () => {
//     if (session?.user?.id) await fetchEmployee(session.user.id);
//   };
//
//   return (
//     <AuthContext.Provider value={{ session, employee, loading, isAdmin: employee?.role === 'admin', signIn, signUp, signOut, refreshEmployee }}>
//       {children}
//     </AuthContext.Provider>
//   );
// }
//
// export function useAuth() {
//   const ctx = useContext(AuthContext);
//   if (!ctx) throw new Error('useAuth must be used within AuthProvider');
//   return ctx;
// }
// src/context/AuthContext.tsx
import {createContext, useContext, useEffect, useState, ReactNode} from 'react';
import {api, type Employee} from '@/lib/api';

type AuthContextType = {
    employee: Employee | null;
    loading: boolean;
    isAdmin: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    refreshEmployee: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({children}: { children: ReactNode }) {
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchMe = async () => {
        try {
            const data = await api.auth.me();
            setEmployee(data);
        } catch {
            setEmployee(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchMe();
        } else {
            setLoading(false);
        }
    }, []);

    const signIn = async (email: string, password: string) => {
        console.log('signIn 开始，email:', email);
        try {
            console.log('准备调用 api.auth.login...');
            const result = await api.auth.login(email, password);
            console.log('api.auth.login 返回结果:', result);
            const {token, employee} = result;
            console.log('token:', token, 'employee:', employee);
            if (!token || !employee) {
                console.error('登录返回数据缺少 token 或 employee');
                return {error: '登录响应数据异常'};
            }
            localStorage.setItem('token', token);
            setEmployee(employee);
            console.log('signIn 设置 employee 成功，employee:', employee);
            return {error: null};
        } catch (err: any) {
            console.error('signIn 捕获异常:', err?.message || err);
            return { error: err?.message || '登录失败' };
        }

    };
    const signUp = async (email: string, password: string, name: string) => {
        try {
            await api.auth.register(email, password, name);
            // 注册后自动登录（或者让用户手动登录）
            return {error: null};
        } catch (err: any) {
            return {error: err.message || '注册失败'};
        }
    };

    const signOut = async () => {
        try {
            await api.auth.logout();
        } catch { /* ignore */
        }
        localStorage.removeItem('token');
        setEmployee(null);
    };

    const refreshEmployee = async () => {
        await fetchMe();
    };

    return (
        <AuthContext.Provider
            value={{
                employee,
                loading,
                isAdmin: employee?.role === 'admin',
                signIn,
                signUp,
                signOut,
                refreshEmployee,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}