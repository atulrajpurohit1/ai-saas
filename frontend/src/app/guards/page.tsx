'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, ShieldCheck, Edit2, Phone, AlertTriangle, RefreshCw, Mail, KeyRound } from 'lucide-react';

interface Guard {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  createdAt: string;
  availability?: {
    status: string;
  };
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}

export default function GuardsPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', email: '', password: '' });
  
  const fetchGuards = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('v2/guards');
      setGuards(res.data);
    } catch (err: unknown) {
      console.error('Fetch Guards Error:', err);
      const status = (err as ApiError).response?.status;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 403) {
        setError('You do not have permission to view guards.');
      } else if (status === 500) {
        setError('Server error: the database may be temporarily unavailable. Please try again later.');
      } else {
        setError('Failed to load guards. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuards();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        ...(formData.password ? { password: formData.password } : {}),
      };

      if (isEditing) {
        await api.put(`v2/guards/${isEditing}`, payload);
      } else {
        await api.post('v2/guards', payload);
      }
      setShowModal(false);
      resetForm();
      fetchGuards();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the guard.');
    }
  };

  const handleEdit = (guard: Guard) => {
    setFormData({
      name: guard.name,
      phone: guard.phone || '',
      email: guard.email || '',
      password: '',
    });
    setIsEditing(guard.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '', email: '', password: '' });
    setIsEditing(null);
  };

  const toggleAvailability = async (guardId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';
    try {
      await api.put(`v2/guards/${guardId}/availability`, { status: newStatus });
      fetchGuards();
    } catch (err) {
      console.error('Toggle Availability Error:', err);
      alert('Failed to update availability.');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Guards</h2>
          <p className="text-muted-foreground">Manage your security personnel and assignments.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>Add New Guard</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search guards..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Guard Detail</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold">Availability</th>
                <th className="px-6 py-4 font-semibold">Date Added</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Loading guards...</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <AlertTriangle size={32} className="text-amber-400" />
                    <p className="text-amber-400 font-medium">{error}</p>
                    <button
                      onClick={fetchGuards}
                      className="mt-2 flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-xl transition-all text-sm"
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                  </div>
                </td></tr>
              ) : guards.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No guards found. Administrators can add new personnel above.</td></tr>
              ) : guards.map((guard) => (
                <tr key={guard.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4" data-label="Guard">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <ShieldCheck size={18} />
                      </div>
                      <span className="font-semibold">{guard.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle" data-label="Contact">
                    <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} className="text-indigo-400" />
                       <span className="text-sm">{guard.phone || 'No phone'}</span>
                    </div>
                    {guard.email && (
                      <div className="flex items-center gap-2 text-muted-foreground mt-1">
                        <Mail size={14} className="text-indigo-400" />
                        <span className="text-sm">{guard.email}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 align-middle" data-label="Availability">
                    <button
                      onClick={() => toggleAvailability(guard.id, guard.availability?.status || 'available')}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        (guard.availability?.status || 'available') === 'available'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20'
                      }`}
                    >
                      {(guard.availability?.status || 'available').toUpperCase()}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground align-middle" data-label="Date Added">
                    {new Date(guard.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                    <button 
                      onClick={() => handleEdit(guard)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300"
                    >
                      <Edit2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">{isEditing ? 'Edit Guard' : 'Add New Guard'}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Full Name</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Michael Smith"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                <input 
                  type="tel" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. +1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <input
                    type="email"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="guard@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Portal Password</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 text-muted-foreground" size={16} />
                  <input
                    type="password"
                    minLength={6}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder={isEditing ? 'Leave blank to keep current password' : 'Set guard portal password'}
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:gap-4">
                <button 
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  {isEditing ? 'Save Changes' : 'Add Guard'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
