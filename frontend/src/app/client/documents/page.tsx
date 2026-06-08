'use client';

import React, { useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { Folder, FileText, Download, Clock, Search, Loader2 } from 'lucide-react';

interface SharedDocument {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
}

export default function ClientDocumentsPage() {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const res = await api.get('client-portal/documents');
        setDocuments(Array.isArray(res.data) ? res.data : []);
        setError('');
      } catch (err) {
        console.error('Failed to fetch documents', err);
        setError('Could not load shared documents. Please refresh or sign in again.');
      } finally {
        setLoading(false);
      }
    };
    fetchDocuments();
  }, []);

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <ClientLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Shared Documents</h2>
          <p className="text-slate-400 font-medium">Access files and resources shared by your account manager.</p>
        </div>
      </div>

      <div className="glass-card bg-[#0a0a14]/60 border border-white/5 rounded-[2rem] overflow-hidden mb-8">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Search documents..." 
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <Loader2 className="animate-spin mx-auto mb-4" size={32} />
              <p>Loading your documents...</p>
            </div>
          ) : error ? (
            <div className="py-16 px-6 text-center text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-3xl">
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : filteredDocs.length === 0 ? (
            <div className="py-20 text-center text-slate-500">
              <Folder className="mx-auto mb-4 opacity-20" size={48} />
              <p>{search ? 'No documents match your search.' : 'No documents have been shared with you yet.'}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredDocs.map((doc) => (
                <div 
                  key={doc.id} 
                  className="group rounded-3xl border border-white/5 bg-white/5 p-5 transition-all hover:border-indigo-500/30 hover:bg-white/10 sm:p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                      <FileText size={24} />
                    </div>
                    <a 
                      href={doc.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="p-3 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-indigo-600 transition-all shadow-xl"
                    >
                      <Download size={20} />
                    </a>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-1">{doc.name}</h3>
                  {doc.description && <p className="text-sm text-slate-400 mb-4 line-clamp-2">{doc.description}</p>}
                  
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-auto">
                    <Clock size={12} />
                    <span>Shared on {new Date(doc.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
