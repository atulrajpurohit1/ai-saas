'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, User, Mail, Phone, Building, Edit2, Folder, FileText, Download, Trash2, Loader2, X } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  createdAt: string;
  users: { email: string }[];
}

interface SharedDocument {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: ''
  });

  // Document management state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', url: '', description: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [docError, setDocError] = useState('');

  const fetchClients = async () => {
    try {
      const res = await api.get('clients');
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (clientId: string) => {
    setDocLoading(true);
    try {
      const res = await api.get(`documents?clientId=${clientId}`);
      setDocuments(Array.isArray(res.data) ? res.data : []);
      setDocError('');
    } catch (err) {
      console.error(err);
      setDocError('Could not load shared documents.');
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await api.put(`clients/${isEditing}`, formData);
      } else {
        await api.post('clients', formData);
      }
      setShowModal(false);
      resetForm();
      fetchClients();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the client.');
    }
  };

  const handleCreateUser = async (client: Client) => {
    if (!confirm(`Create portal login for ${client.email}? A secure temporary password will be generated.`)) return;
    try {
      const res = await api.post(`clients/${client.id}/create-user`, { email: client.email });
      alert(`Client portal login created! Temporary password: ${res.data.temporaryPassword}`);
      fetchClients();
    } catch (err) {
      console.error(err);
      alert('Failed to create user. It may already exist.');
    }
  };

  const handleShareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsUploading(true);
    setDocError('');
    try {
      await api.post('documents', {
        name: newDoc.name.trim(),
        url: newDoc.url.trim(),
        description: newDoc.description.trim() || undefined,
        clientId: selectedClient.id,
      });
      setNewDoc({ name: '', url: '', description: '' });
      fetchDocuments(selectedClient.id);
    } catch (err: unknown) {
      console.error(err);
      setDocError((err as ApiError).response?.data?.message || 'Could not share this document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDocument = async (docId: string) => {
    if (!confirm('Are you sure you want to remove this document?')) return;
    try {
      await api.delete(`documents/${docId}`);
      if (selectedClient) fetchDocuments(selectedClient.id);
    } catch (err: unknown) {
      console.error(err);
      setDocError((err as ApiError).response?.data?.message || 'Could not remove this document.');
    }
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name,
      companyName: client.companyName || '',
      email: client.email,
      phone: client.phone || ''
    });
    setIsEditing(client.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({ name: '', companyName: '', email: '', phone: '' });
    setIsEditing(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 text-left">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Client Management</h2>
          <p className="text-slate-400 font-medium">Manage your client relationships and contact details.</p>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }}
          className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-7 py-3.5 font-bold text-white shadow-lg shadow-indigo-600/20 transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform" />
          <span>Add New Client</span>
        </button>
      </div>

      <div className="glass-card rounded-[2rem] overflow-hidden border border-white/5 bg-[#0a0a14]/60">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search clients..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-white placeholder:text-slate-600"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] border-b border-white/5">
                <th className="px-8 py-5">Client / Company</th>
                <th className="px-8 py-5">Contact Info</th>
                <th className="px-8 py-5 text-center">Status</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-white">
              {loading ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 animate-pulse">Loading clients...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">No clients found. Add your first client above.</td></tr>
              ) : clients.map((client) => (
                <tr key={client.id} className="hover:bg-white/5 transition-all group">
                  <td className="px-8 py-6" data-label="Client">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                        <User size={22} />
                      </div>
                      <div>
                        <div className="font-bold text-lg">{client.name}</div>
                        <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-1">
                          <Building size={12} className="text-indigo-400/60" />
                          {client.companyName || 'No Company'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6" data-label="Contact">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-sm text-slate-400 font-medium">
                        <Mail size={14} className="text-indigo-400/70" />
                        {client.email}
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-2.5 text-sm text-slate-400 font-medium">
                          <Phone size={14} className="text-indigo-400/70" />
                          {client.phone}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center" data-label="Status">
                    {client.users && client.users.length > 0 ? (
                      <span className="text-[10px] font-extrabold text-emerald-400 bg-emerald-400/10 px-3 py-1.5 rounded-full border border-emerald-400/20 tracking-widest uppercase">PORTAL ACTIVE</span>
                    ) : (
                      <button 
                        onClick={() => handleCreateUser(client)}
                        className="text-[10px] font-extrabold text-indigo-400 bg-indigo-400/10 px-3 py-1.5 rounded-full border border-indigo-400/20 hover:bg-indigo-400/20 tracking-widest uppercase transition-all"
                      >
                        ENABLE PORTAL
                      </button>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right" data-label="Actions">
                    <div className="flex items-center justify-start gap-2 md:justify-end">
                      <button 
                        onClick={() => { setSelectedClient(client); setShowDocsModal(true); fetchDocuments(client.id); }}
                        className="p-3 hover:bg-white/10 rounded-xl transition-all text-indigo-400 hover:text-indigo-300 border border-transparent hover:border-white/5"
                        title="Manage Documents"
                      >
                        <Folder size={20} />
                      </button>
                      <button 
                        onClick={() => handleEdit(client)}
                        className="p-3 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white border border-transparent hover:border-white/5"
                        title="Edit Client"
                      >
                        <Edit2 size={20} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCUMENT MANAGEMENT MODAL */}
      {showDocsModal && selectedClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card flex max-h-[calc(100dvh-2rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[2rem] border-white/10 bg-[#0e0e1a] shadow-3xl sm:rounded-[2.5rem]">
            <div className="flex items-start justify-between gap-4 border-b border-white/5 p-5 sm:p-8">
              <div>
                <h3 className="text-2xl font-bold text-white">Documents: {selectedClient.name}</h3>
                <p className="text-sm text-muted-foreground">Share and manage files for this client.</p>
              </div>
              <button onClick={() => setShowDocsModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
              <div className="space-y-4 overflow-y-auto border-r border-white/5 p-5 custom-scrollbar sm:p-8">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4">Shared Documents</h4>
                {docLoading ? (
                  <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-indigo-500" /></div>
                ) : docError ? (
                  <div className="py-12 px-4 text-center text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-3xl">
                    <p className="text-sm font-medium">{docError}</p>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground border-2 border-dashed border-white/5 rounded-3xl">
                    <FileText className="mx-auto mb-4 opacity-20" size={48} />
                    <p className="text-sm italic">No documents shared yet.</p>
                  </div>
                ) : documents.map((doc) => (
                  <div key={doc.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <FileText size={20} />
                      </div>
                      <div>
                        <div className="text-sm font-bold text-white">{doc.name}</div>
                        <div className="text-[10px] text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">
                        <Download size={16} />
                      </a>
                      <button onClick={() => handleRemoveDocument(doc.id)} className="p-2 hover:bg-rose-500/10 rounded-lg text-rose-400 hover:text-rose-300">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-y-auto bg-black/20 p-5 sm:p-8">
                <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-6">Share New Document</h4>
                {docError && (
                  <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {docError}
                  </div>
                )}
                <form onSubmit={handleShareDocument} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Document Name</label>
                    <input 
                      type="text" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm text-white"
                      placeholder="e.g. Service Agreement"
                      value={newDoc.name}
                      onChange={(e) => setNewDoc({...newDoc, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">File URL / Link</label>
                    <input 
                      type="url" 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm font-mono text-white"
                      placeholder="https://example.com/file.pdf"
                      value={newDoc.url}
                      onChange={(e) => setNewDoc({...newDoc, url: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Description (Optional)</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:outline-none focus:ring-1 focus:ring-primary text-sm resize-none h-24 text-white"
                      placeholder="Brief note about this document..."
                      value={newDoc.description}
                      onChange={(e) => setNewDoc({...newDoc, description: e.target.value})}
                    ></textarea>
                  </div>
                  <button 
                    type="submit" 
                    disabled={isUploading}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 mt-4"
                  >
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    <span>Share Document</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 bg-[#0e0e1a] p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">{isEditing ? 'Edit Client' : 'Add New Client'}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  placeholder="e.g. Robert Fox"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                <input 
                  type="text" 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  placeholder="e.g. Acme Corp"
                  value={formData.companyName}
                  onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Email Address</label>
                  <input 
                    type="email" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                    placeholder="robert@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
                  <input 
                    type="tel" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                    placeholder="+1 (555) 000-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:gap-4">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10">
                  Cancel
                </button>
                <button type="submit" className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-600/20">
                  {isEditing ? 'Save Changes' : 'Add Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
