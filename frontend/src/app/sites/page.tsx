'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, MapPin, MoreVertical, Edit2 } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  instructions: string | null;
  clientId: string | null;
  client?: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
  createdAt: string;
}

interface Client {
  id: string;
  name: string;
  companyName: string | null;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', instructions: '', client_id: '' });
  
  const fetchSites = async () => {
    try {
      const res = await api.get('sites');
      setSites(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('clients');
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`sites/${isEditing}`, {
          ...formData,
          client_id: formData.client_id || null,
        });
      } else {
        await api.post('sites', {
          ...formData,
          client_id: formData.client_id || null,
        });
      }
      setShowModal(false);
      resetForm();
      fetchSites();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the site.');
    }
  };

  const handleEdit = (site: Site) => {
    setFormData({
      name: site.name,
      address: site.address,
      instructions: site.instructions || '',
      client_id: site.clientId || ''
    });
    setIsEditing(site.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', instructions: '', client_id: '' });
    setIsEditing(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Sites</h2>
          <p className="text-muted-foreground">Manage your physical security locations and assignments.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>Create Site</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search sites..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Site Detail</th>
                <th className="px-6 py-4 font-semibold">Location</th>
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">Loading sites...</td></tr>
              ) : sites.length === 0 ? (
                <tr><td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">No sites found.</td></tr>
              ) : sites.map((site) => (
                <tr key={site.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4" data-label="Site">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <MapPin size={18} />
                      </div>
                      <span className="font-semibold">{site.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 align-middle md:max-w-xs md:truncate" data-label="Location">
                    <span className="text-muted-foreground text-sm">{site.address}</span>
                  </td>
                  <td className="px-6 py-4 align-middle" data-label="Client">
                    {site.client ? (
                      <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-300">
                        {site.client.companyName || site.client.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Unlinked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground align-middle" data-label="Created">
                    {new Date(site.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                    <button 
                      onClick={() => handleEdit(site)}
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
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">{isEditing ? 'Edit Site' : 'Create New Site'}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Site Name</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Downtown Corporate Office"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Address</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. 123 Main St, New York, NY 10001"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Special Instructions (Optional)</label>
                <textarea 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-none"
                  placeholder="e.g. Keycard required for back entrance. Contact Jane on arrival."
                  value={formData.instructions}
                  onChange={(e) => setFormData({...formData, instructions: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Client (Optional)</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.client_id}
                  onChange={(e) => setFormData({...formData, client_id: e.target.value})}
                >
                  <option value="" className="bg-[#0e0e1a] text-white">No linked client</option>
                  {clients.length === 0 && (
                    <option value="" disabled className="bg-[#0e0e1a] text-white">
                      Create a client first
                    </option>
                  )}
                  {clients.map((client) => (
                    <option key={client.id} value={client.id} className="bg-[#0e0e1a] text-white">
                      {client.companyName || client.name}
                    </option>
                  ))}
                </select>
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
                  {isEditing ? 'Save Changes' : 'Create Site'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
