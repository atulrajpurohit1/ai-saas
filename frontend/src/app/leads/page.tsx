'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, MoreVertical, Building2, User, Mail, FileText, Upload, Loader2 } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  company: string;
  status: string;
  createdAt: string;
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '' });
  
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/leads/analyze-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const { name, company, email } = res.data;
      setNewLead({
        name: name !== 'Unknown' ? name : '',
        company: company !== 'Unknown' ? company : '',
        email: email || ''
      });
    } catch (err) {
      console.error('PDF Analysis Error:', err);
      alert('Failed to analyze PDF. Ensure Gemini API key is valid.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await api.patch(`/leads/${leadId}/status`, { status: newStatus });
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'new': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'contacted': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'proposal_sent': return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'responded': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const fetchLeads = async () => {
    try {
      const res = await api.get('/leads');
      setLeads(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/leads', newLead);
      setShowModal(false);
      setNewLead({ name: '', email: '', company: '' });
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-bold">Leads</h2>
          <p className="text-muted-foreground">Manage your incoming business opportunities.</p>
        </div>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-primary hover:bg-indigo-500 text-white font-bold py-3 px-6 rounded-2xl transition-all shadow-lg flex items-center justify-center gap-2"
          >
            <Plus size={20} />
            <span>Add New Lead</span>
          </button>
        </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input 
              type="text" 
              placeholder="Search leads..." 
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Lead Contact</th>
                <th className="px-6 py-4 font-semibold">Email</th>
                <th className="px-6 py-4 font-semibold">Company</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Created</th>
                <th className="px-6 py-4 font-semibold"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">Loading leads...</td></tr>
              ) : leads.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">No leads found.</td></tr>
              ) : leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <User size={18} />
                      </div>
                      <span className="font-semibold">{lead.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 text-indigo-100 font-medium">
                        <Mail size={14} className="text-indigo-400" />
                        <span className="text-sm">{lead.email || 'No email provided'}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1 ml-6">Primary Contact</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 size={16} />
                      <span>{lead.company}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tight border appearance-none focus:outline-none cursor-pointer hover:brightness-110 transition-all ${getStatusColor(lead.status)}`}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="proposal_sent">Proposal Sent</option>
                      <option value="responded">Responded</option>
                      <option value="closed">Closed</option>
                    </select>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                         onClick={async () => {
                           if (confirm('Convert this lead to a deal?')) {
                             try {
                               await api.post(`/deals/convert/${lead.id}`);
                               fetchLeads();
                             } catch (err) {
                               console.error(err);
                               alert('Failed to convert lead');
                             }
                           }
                         }}
                         className="text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg hover:bg-emerald-500/20 transition-all"
                      >
                        CONVERT
                      </button>
                      <button className="p-2 hover:bg-white/10 rounded-lg transition-colors text-muted-foreground hover:text-white">
                        <MoreVertical size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card w-full max-w-lg rounded-3xl p-8 border-white/10 shadow-3xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Create New Lead</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="mb-8 p-6 bg-indigo-500/5 rounded-2xl border border-dashed border-indigo-500/20 group hover:bg-indigo-500/10 transition-all cursor-pointer relative overflow-hidden">
              <div className="flex items-center gap-4 relative z-10">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isUploading ? 'bg-indigo-500/20' : 'bg-primary/20 text-primary'}`}>
                  {isUploading ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                </div>
                <div>
                  <h4 className="font-bold text-sm">{isUploading ? 'AI is analyzing document...' : 'Populate from PDF'}</h4>
                  <p className="text-xs text-muted-foreground">Auto-fill form fields using AI document analysis</p>
                </div>
              </div>
              <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf" onChange={handlePdfUpload} disabled={isUploading} />
            </div>

            <form onSubmit={handleAddLead} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="John Doe"
                    value={newLead.name}
                    onChange={(e) => setNewLead({...newLead, name: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-1">
                  <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                  <input 
                    type="text" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Security Ops Inc"
                    value={newLead.company}
                    onChange={(e) => setNewLead({...newLead, company: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                <input 
                  type="email" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="john@securityops.com"
                  value={newLead.email}
                  onChange={(e) => setNewLead({...newLead, email: e.target.value})}
                />
              </div>

              <div className="flex gap-4 mt-10">
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
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
