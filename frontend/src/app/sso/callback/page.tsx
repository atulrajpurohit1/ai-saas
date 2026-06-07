'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

export default function SsoCallbackPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [error, setError] = useState('');

  useEffect(() => {
    const finish = async () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken) {
        setError('SSO login did not return an access token.');
        return;
      }

      localStorage.setItem('token', accessToken);
      if (refreshToken) localStorage.setItem('refresh_token', refreshToken);
      const me = await api.get('users/me');
      login(accessToken, me.data);
      router.replace('/');
    };

    finish().catch((err) => {
      setError(err?.response?.data?.message || err?.message || 'Could not finish SSO login.');
    });
  }, [login, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#05050a] px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
        <ShieldCheck className="mx-auto mb-4 text-indigo-300" size={34} />
        <h1 className="text-xl font-black text-white">SSO Login</h1>
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm font-semibold text-rose-300">
            {error}
          </p>
        ) : (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm font-semibold text-slate-400">
            <Loader2 className="animate-spin text-indigo-300" size={18} />
            Signing you in...
          </div>
        )}
      </div>
    </div>
  );
}
