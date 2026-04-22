'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Lock, Mail, Building2, User } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      if (isRegister) {
        const res = await api.post('auth/register', {
          name: 'Admin',
          email,
          password,
          tenantName,
          tenantSlug
        });
        login(res.data.access_token, { 
          email, 
          role: 'admin', 
          name: 'Admin',
          tenantName 
        });
      } else {
        const res = await api.post('auth/login', { email, password });
        login(res.data.access_token, { 
          email, 
          role: 'admin',
          name: 'Admin User'
        });
      }
    } catch (err: unknown) {
      const errorMessage = (err as any).response?.data?.message || 'Authentication failed';
      setError(errorMessage);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">Ai Saas</h1>
          <p className="text-muted-foreground">Premium Multi-Tenant CRM Dashboard</p>
        </div>

        <div className="glass-card rounded-3xl p-8 shadow-2xl border-white/10">


          <h2 className="text-2xl font-bold mb-6">{isRegister ? 'Register Tenant' : 'Welcome Back'}</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegister && (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Tenant Name</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-3 text-muted-foreground" size={18} />
                    <input
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      placeholder="My Security Co"
                      value={tenantName}
                      onChange={(e) => setTenantName(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Tenant Slug</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="my-security-co"
                    value={tenantSlug}
                    onChange={(e) => setTenantSlug(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <input
                  type="email"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-muted-foreground" size={18} />
                <input
                  type="password"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  suppressHydrationWarning
                />
              </div>
            </div>

            {error && <p className="text-red-400 text-sm font-medium animate-pulse">{error}</p>}

            <button
              type="submit"
              className="w-full bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/25 mt-4"
              suppressHydrationWarning
            >
              {isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

            <div className="mt-6 text-center">
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-indigo-400 hover:text-indigo-300 font-medium"
                suppressHydrationWarning
              >
                {isRegister ? 'Already have an account? Sign in' : "Don't have a company account? Register"}
              </button>
            </div>
        </div>
      </div>
    </div>
  );
}
