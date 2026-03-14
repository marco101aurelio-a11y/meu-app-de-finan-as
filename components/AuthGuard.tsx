'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [authActionLoading, setAuthActionLoading] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setAuthActionLoading(true);

    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            },
          },
        });
        if (error) throw error;
        setError('Cadastro realizado! Faça login para continuar.');
        setMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro na autenticação');
    } finally {
      setAuthActionLoading(false);
    }
  };

  if (!mounted) return null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#101622] flex items-center justify-center">
        <div className="text-primary flex flex-col items-center gap-4">
          <Wallet size={48} />
          <p className="text-slate-400 font-medium animate-pulse">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#101622] flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-8 bg-slate-900/50 p-8 rounded-3xl border border-slate-800 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="flex justify-center mb-4">
              <div className="size-16 bg-primary/20 rounded-2xl flex items-center justify-center text-primary">
                <Wallet size={32} />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white">
              {mode === 'login' ? 'Bem-vindo de volta' : 'Criar conta'}
            </h1>
            <p className="text-slate-400 text-sm">
              {mode === 'login' 
                ? 'Acesse sua conta para gerenciar suas finanças.' 
                : 'Comece sua jornada para a liberdade financeira hoje.'}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {mode === 'signup' && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-400 ml-1">NOME COMPLETO</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 text-white outline-none focus:border-primary transition-all text-base leading-normal"
                />
              </div>
            )}
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 ml-1">E-MAIL</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 text-white outline-none focus:border-primary transition-all text-base leading-normal"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 ml-1">SENHA</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl py-4 px-4 text-white outline-none focus:border-primary transition-all text-base leading-normal"
              />
            </div>

            {error && (
              <p className="text-red-500 text-xs font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={authActionLoading}
              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-3 mt-6"
            >
              {authActionLoading ? (
                <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn size={20} />
                  {mode === 'login' ? 'Entrar' : 'Cadastrar'}
                </>
              )}
            </button>
          </form>

          <div className="text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary text-sm font-semibold hover:underline"
            >
              {mode === 'login' 
                ? 'Não tem uma conta? Cadastre-se' 
                : 'Já tem uma conta? Faça login'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
