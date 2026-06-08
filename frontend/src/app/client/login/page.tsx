'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Shield, Loader2, Mail, Lock, ArrowRight, User, Briefcase } from 'lucide-react';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const normalizeSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default function ClientLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('guard_token');

      const res = isRegister
        ? await api.post('client-auth/register', {
            name,
            email,
            password,
            tenantSlug: normalizeSlug(tenantSlug),
          })
        : await api.post('client-auth/login', {
            email,
            password,
          });

      localStorage.setItem('client_token', res.data.access_token);
      router.push('/client/dashboard');
    } catch (err: unknown) {
      setError((err as ApiError).response?.data?.message || 'Could not access the client portal.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05050a] px-4 py-8">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center sm:mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 shadow-2xl shadow-indigo-600/40 mb-6">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="mb-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {isRegister ? 'Create Client Account' : 'Client Portal'}
          </h1>
          <p className="text-slate-400 font-medium">
            {isRegister ? 'Register your client portal account.' : 'Access your proposals and secure service details.'}
          </p>
        </div>

        <div className="glass-card rounded-[2rem] border border-white/5 bg-[#0a0a14]/80 p-5 shadow-2xl backdrop-blur-xl sm:rounded-[2.5rem] sm:p-10">
          <form onSubmit={handleLogin} className="space-y-6">
            {isRegister && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Full Name</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-300 ml-1">Company Name</label>
                  <div className="relative group">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                      <Briefcase size={18} />
                    </div>
                    <input
                      type="text"
                      autoCapitalize="none"
                      spellCheck={false}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                      placeholder="Acme Security"
                      value={tenantSlug}
                      onChange={(e) => setTenantSlug(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 ml-1">Email Address</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Mail size={18} />
                </div>
                <input 
                  type="email" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-semibold text-slate-300">Password</label>
                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Forgot password?</a>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors">
                  <Lock size={18} />
                </div>
                <input 
                  type="password" 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm py-3 px-4 rounded-xl flex items-center gap-2">
                <Shield size={14} className="shrink-0" />
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-70 group"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <span>{isRegister ? 'Create Account' : 'Sign In to Portal'}</span>
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              type="button"
              onClick={() => {
                setIsRegister((current) => !current);
                setError('');
              }}
              className="text-sm font-bold text-slate-500 transition-colors hover:text-indigo-400"
            >
              {isRegister ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : "DON'T HAVE AN ACCOUNT? REGISTER"}
            </button>
          </div>
        </div>

        <p className="text-center mt-8 text-slate-500 text-sm">
          Protected by Antigravity AI Security. &copy; 2026
        </p>
      </div>
    </div>
  );
}
