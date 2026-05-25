'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { ArrowRight, KeyRound, Loader2, Phone, ShieldCheck } from 'lucide-react';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function GuardLoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('guard-auth/login', {
        identifier: identifier.trim(),
        password,
      });

      localStorage.setItem('guard_token', response.data.access_token);
      localStorage.setItem('guard_user', JSON.stringify(response.data.guard));
      router.push('/guard/dashboard');
    } catch (err: unknown) {
      setError((err as ApiError).response?.data?.message || 'Unable to sign in. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#071013] px-4 py-8 text-slate-100">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-xl shadow-emerald-500/20">
            <ShieldCheck size={34} />
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Guard Login</h1>
          <p className="mt-2 text-sm text-slate-400">Access assigned field shifts.</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl sm:p-8">
          <div className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Phone or email</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
                  placeholder="phone or email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-300">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-12 pr-4 text-white outline-none transition focus:border-emerald-400/50 focus:ring-2 focus:ring-emerald-400/20"
                  placeholder="password"
                  required
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
