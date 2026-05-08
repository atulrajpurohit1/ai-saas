'use client';

import React, { useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { User, Building, Mail, Phone, Calendar, Shield, Loader2, Info } from 'lucide-react';

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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await api.get('client-portal/profile');
        setProfile(res.data);
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  if (loading) return <ClientLayout><div className="py-20 text-center text-slate-500">Loading profile...</div></ClientLayout>;
  if (!profile) return <ClientLayout><div className="py-20 text-center text-rose-400">Profile not found.</div></ClientLayout>;

  return (
    <ClientLayout>
      <div className="mb-10">
        <h2 className="text-3xl font-bold text-white tracking-tight">Your Profile</h2>
        <p className="text-slate-400 font-medium">Manage your account details and view company information.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Card */}
          <div className="glass-card bg-[#0a0a14]/60 border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <User size={160} />
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start relative z-10">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-2xl shadow-indigo-600/20">
                <User size={48} />
              </div>
              
              <div className="flex-1">
                <h1 className="text-4xl font-extrabold text-white mb-2">{profile.name}</h1>
                <p className="text-indigo-400 font-semibold text-lg mb-6">{profile.companyName || 'Private Client'}</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                    <div className="flex items-center gap-3 text-slate-200">
                      <Mail size={18} className="text-indigo-400/70" />
                      <span className="font-medium">{profile.email}</span>
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

          <div className="p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
              <Info size={20} />
            </div>
            <div>
              <h4 className="text-white font-bold mb-1">Information Security</h4>
              <p className="text-sm text-slate-400 leading-relaxed">
                Your profile information is securely managed by Antigravity AI. If you need to update any admin-only details like your company name or linked email, please contact your account manager.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-card bg-[#0a0a14]/60 border border-white/5 rounded-3xl p-8">
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
