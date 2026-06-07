'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Lock, Mail, Building2, User, Shield, Briefcase, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startSsoLogin } from '@/lib/sso';
import { useBranding } from '@/lib/branding';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [role, setRole] = useState<'admin' | 'client'>('admin');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [ssoLoading, setSsoLoading] = useState(false);
  const { login } = useAuth();
  const { branding } = useBranding();
  const router = useRouter();

  const completeAdminLogin = async (accessToken: string, fallbackName: string, fallbackTenantName?: string) => {
    localStorage.setItem('token', accessToken);
    const me = await api.get('users/me');
    login(accessToken, {
      ...me.data,
      name: me.data.name || fallbackName,
      tenantName: me.data.tenantName || fallbackTenantName,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (role === 'admin') {
        if (isRegister) {
          const res = await api.post('auth/register', {
            name: name || 'Admin',
            email,
            password,
            tenantName,
            tenantSlug
          });
          await completeAdminLogin(res.data.access_token, name || 'Admin', tenantName);
        } else {
          const res = await api.post('auth/login', { email, password });
          await completeAdminLogin(res.data.access_token, 'Admin User');
        }
      } else {
        // Client Flow
        if (isRegister) {
          const res = await api.post('client-auth/register', {
            name,
            email,
            password,
            tenantSlug
          });
          localStorage.setItem('client_token', res.data.access_token);
          router.push('/client/dashboard');
        } else {
          const res = await api.post('client-auth/login', { email, password });
          localStorage.setItem('client_token', res.data.access_token);
          router.push('/client/dashboard');
        }
      }
    } catch (err: unknown) {
      const errorMessage = (err as ApiError).response?.data?.message || 'Authentication failed';
      setError(errorMessage);
    }
  };

  const handleSsoLogin = async () => {
    setError('');
    setSsoLoading(true);
    try {
      const result = await startSsoLogin(email);
      window.location.href = result.redirect_url;
    } catch (err: unknown) {
      const errorMessage = (err as ApiError).response?.data?.message || 'SSO login failed';
      setError(errorMessage);
      setSsoLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#05050a] px-4 py-8"
      style={{
        backgroundImage: branding.login_background ? `linear-gradient(rgba(5,5,10,.78), rgba(5,5,10,.78)), url(${branding.login_background})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
       {/* Background decoration */}
       <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full"></div>
       <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-600/10 blur-[120px] rounded-full"></div>

      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center sm:mb-10">
          {branding.logo_url ? (
            <img src={branding.logo_url} alt={branding.company_name} className="mx-auto mb-4 max-h-20 max-w-64 object-contain" />
          ) : (
            <h1 className="mb-2 text-4xl font-black italic tracking-tighter text-white sm:text-5xl">{branding.company_name || 'Ai Saas'}</h1>
          )}
          <p className="text-slate-500 font-medium tracking-wide">
            {branding.welcome_message || 'Next Generation Security CRM'}
          </p>
        </div>

        <div className="glass-card rounded-[2rem] border-white/5 bg-[#0a0a14]/80 p-5 shadow-2xl backdrop-blur-xl sm:rounded-[2.5rem] sm:p-10">
          
          {/* Role Switcher */}
          <div className="flex bg-white/5 p-1 rounded-2xl mb-8 border border-white/5">
            <button 
              onClick={() => { setRole('admin'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${role === 'admin' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <Shield size={14} />
              ADMIN
            </button>
            <button 
              onClick={() => { setRole('client'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${role === 'client' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
            >
              <User size={14} />
              CLIENT
            </button>
          </div>

          <h2 className="mb-2 text-2xl font-extrabold text-white sm:text-3xl">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
          <p className="text-slate-500 text-sm mb-8">
            {isRegister 
              ? `Signing up as a ${role === 'admin' ? 'Company Administrator' : 'Client'}` 
              : `Sign in to your ${role === 'admin' ? 'Admin' : 'Client'} dashboard`}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Full Name</label>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="John Doe"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {isRegister && role === 'admin' && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Company Name</label>
                <div className="relative group">
                  <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="Acme Security"
                    value={tenantName}
                    onChange={(e) => setTenantName(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            {isRegister && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Company Slug</label>
                <div className="relative group">
                  <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                    placeholder="acme-security"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600 group-focus-within:text-indigo-400 transition-colors" size={18} />
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-xs font-bold bg-red-500/5 p-3 rounded-xl border border-red-500/10">{error}</p>}

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 mt-6"
            >
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          {!isRegister && role === 'admin' && (
            <button
              type="button"
              onClick={handleSsoLogin}
              disabled={ssoLoading || !email}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-4 font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {ssoLoading ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
              Continue with SSO
            </button>
          )}

          <div className="mt-8 text-center">
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-sm text-slate-500 hover:text-indigo-400 font-bold transition-colors"
            >
              {isRegister ? 'ALREADY HAVE AN ACCOUNT? SIGN IN' : "DON'T HAVE AN ACCOUNT? REGISTER"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
