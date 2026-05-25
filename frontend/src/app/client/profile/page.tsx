'use client';

import React, { useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { User, Building, Mail, Phone, Calendar, Shield, Info } from 'lucide-react';

interface ClientProfile {
  id: string;
  name: string;
  companyName?: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export default function ClientProfilePage() {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('client-portal/profile');
        setProfile(res.data);
        setError('');
      } catch (err) {
        console.error('Failed to fetch profile', err);
        setError('Could not load your profile. Please refresh or sign in again.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <ClientLayout><div className="py-20 text-center text-slate-500">Loading profile...</div></ClientLayout>;
  if (error) return <ClientLayout><div className="py-20 text-center text-rose-400">{error}</div></ClientLayout>;
  if (!profile) return <ClientLayout><div className="py-20 text-center text-rose-400">Profile not found.</div></ClientLayout>;

  return (
    <ClientLayout>
      <div className="mb-10">
        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Your Profile</h2>
        <p className="text-slate-400 font-medium">View your account details and company information.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-6 lg:col-span-2 lg:space-y-8">
          {/* Profile Card */}
          <div className="glass-card relative overflow-hidden rounded-[2rem] border border-white/5 bg-[#0a0a14]/60 p-5 sm:p-8 lg:rounded-[2.5rem] lg:p-10">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <User size={160} />
            </div>

            <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row lg:gap-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-2xl shadow-indigo-600/20 sm:h-24 sm:w-24">
                <User size={42} />
              </div>
              
              <div className="min-w-0 flex-1">
                <h1 className="break-words text-3xl font-extrabold text-white sm:text-4xl">{profile.name}</h1>
                <p className="mb-6 mt-2 text-base font-semibold text-indigo-400 sm:text-lg">{profile.companyName || 'Private Client'}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                    <div className="flex min-w-0 items-center gap-3 text-slate-200">
                      <Mail size={18} className="text-indigo-400/70" />
                      <span className="break-all font-medium">{profile.email}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Phone Number</label>
                    <div className="flex items-center gap-3 text-slate-200">
                      <Phone size={18} className="text-indigo-400/70" />
                      <span className="font-medium">{profile.phone || 'Not provided'}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Client Since</label>
                    <div className="flex items-center gap-3 text-slate-200">
                      <Calendar size={18} className="text-indigo-400/70" />
                      <span className="font-medium">{new Date(profile.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Account Status</label>
                    <div className="flex items-center gap-3">
                      <Shield size={18} className="text-emerald-400" />
                      <span className="font-bold text-emerald-400">Verified Client</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-[2rem] border border-indigo-500/10 bg-indigo-500/5 p-5 sm:p-8">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <Info size={20} />
            </div>
            <div>
              <h4 className="text-white font-bold mb-1">Information Security</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your profile information is securely managed by your account team. If you need to update admin-only details like your company name or linked email, please contact your account manager.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card rounded-3xl border border-white/5 bg-[#0a0a14]/60 p-5 sm:p-8">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Building className="text-indigo-400" size={20} />
              Company Details
            </h3>
            
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Company ID</div>
                <div className="text-sm font-mono text-slate-300">{profile.id}</div>
              </div>
              
              <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Service Type</div>
                <div className="text-sm text-slate-300">Premium Security SaaS</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ClientLayout>
  );
}
