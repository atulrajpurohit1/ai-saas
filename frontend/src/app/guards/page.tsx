'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, ShieldCheck, MoreVertical, Edit2, Phone } from 'lucide-react';

interface Guard {
  id: string;
  name: string;
  phone: string;
  createdAt: string;
}

export default function GuardsPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });
  
  const fetchGuards = async () => {
    try {
      const res = await api.get('guards');
      setGuards(res.data);
    } catch (err: any) {
      console.error('Fetch Guards Error:', err);
      // If 403, we might want to show an access denied message instead of just log
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
      if (isEditing) {
        await api.put(`guards/${isEditing}`, formData);
      } else {
        await api.post('guards', formData);
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
      phone: guard.phone || ''
    });
    setIsEditing(guard.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', phone: '' });
    setIsEditing(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Guards</h2>
          <p className="text-muted-foreground">Manage your security personnel and assignments.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Plus size={20} />
          <span>Add New Guard</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search guards..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Guard Detail</th>
                <th className="px-6 py-4 font-semibold">Contact Info</th>
                <th className="px-6 py-4 font-semibold">Date Added</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">Loading guards...</td></tr>
              ) : guards.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No guards found. Administrators can add new personnel above.</td></tr>
              ) : guards.map((guard) => (
                <tr key={guard.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <ShieldCheck size={18} />
                      </div>
                      <span className="font-semibold">{guard.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle">
                    <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} className="text-indigo-400" />
                       <span className="text-sm">{guard.phone}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground align-middle">
                    {new Date(guard.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right align-middle">
                    <button 
                      onClick={() => handleEdit(guard)}
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300"
                    >
                      <Edit2 size={18} />
                    </button>
                    <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white ml-2">
                      <MoreVertical size={18} />
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
          <div className="glass-card w-full max-w-lg rounded-3xl p-8 border-white/10 shadow-3xl animate-in zoom-in-95 duration-200">
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
                  required
                />
              </div>

              <div className="flex gap-4 mt-8 pt-4">
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
