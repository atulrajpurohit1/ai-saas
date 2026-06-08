'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { GuardRecommendation } from '@/lib/ai-insights';
import { branchParams, BranchSummary } from '@/lib/branches';
import { Plus, Search, Calendar, Clock, Users, MapPin, Sparkles, AlertTriangle, Loader2 } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  branchId?: string | null;
}

interface Guard {
  id: string;
  name: string;
}

interface Shift {
  id: string;
  siteId: string;
  site: { name: string };
  branchId?: string | null;
  branch?: BranchSummary | null;
  startTime: string;
  endTime: string;
  requiredGuards: number;
  status: string;
  attendanceStatus?: 'not_started' | 'checked_in' | 'completed';
  checkInTime?: string | null;
  checkOutTime?: string | null;
  createdAt: string;
  assignments: {
    id: string;
    guard: {
      name: string;
    };
  }[];
}

export default function ShiftsPage() {
  const { can } = useAuth();
  const canCreateShift = can('shifts.create');
  const canAssignShift = can('shifts.assign');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedGuard, setSelectedGuard] = useState('');
  const [recommendations, setRecommendations] = useState<GuardRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [newShift, setNewShift] = useState({
    siteId: '',
    startTime: '',
    endTime: '',
    requiredGuards: 1
  });

  const fetchShifts = async () => {
    try {
      const res = await api.get('v2/shifts', { params: branchParams(selectedBranchId) });
      setShifts(res.data);
    } catch (err) {
      console.error('Failed to fetch shifts:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSites = async () => {
    try {
      const res = await api.get('sites', { params: branchParams(selectedBranchId) });
      setSites(res.data);
    } catch (err) {
      console.error('Failed to fetch sites:', err);
    }
  };

  const fetchGuards = async () => {
    try {
      const res = await api.get('v2/guards', { params: branchParams(selectedBranchId) });
      setGuards(res.data);
    } catch (err) {
      console.error('Failed to fetch guards:', err);
    }
  };

  useEffect(() => {
    fetchShifts();
    if (canCreateShift) fetchSites();
    if (canAssignShift) fetchGuards();
  }, [selectedBranchId, canCreateShift, canAssignShift]);

  const resetAssignModal = () => {
    setShowAssignModal(false);
    setSelectedGuard('');
    setSelectedShift(null);
    setRecommendations([]);
    setRecommendationsError('');
    setRecommendationsLoading(false);
  };

  const fetchRecommendations = async (shiftId: string) => {
    setRecommendationsLoading(true);
    setRecommendationsError('');
    try {
      const res = await api.get<GuardRecommendation[]>(`v2/shifts/${shiftId}/recommend-guards`);
      setRecommendations(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('Failed to fetch guard recommendations:', err);
      setRecommendationsError(err.response?.data?.message || 'Could not load recommended guards.');
      setRecommendations([]);
    } finally {
      setRecommendationsLoading(false);
    }
  };

  const openAssignModal = (shiftId: string) => {
    if (!canAssignShift) return;
    setSelectedShift(shiftId);
    setSelectedGuard('');
    setShowAssignModal(true);
    fetchRecommendations(shiftId);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShift || !selectedGuard) return;

    try {
      await api.put(`v2/shifts/${selectedShift}/assign`, { guardId: selectedGuard });
      resetAssignModal();
      fetchShifts();
    } catch (err: any) {
      console.error('Failed to assign guard:', err);
      const message = err.response?.data?.message || 'Failed to assign guard.';
      alert(message);
    }
  };

  const handleUnassign = async (shiftId: string) => {
    if (!confirm('Are you sure you want to unassign the guard from this shift?')) return;

    try {
      await api.delete(`v2/shifts/${shiftId}/unassign`);
      fetchShifts();
    } catch (err) {
      console.error('Failed to unassign guard:', err);
      alert('Failed to unassign guard.');
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateShift) return;
    try {
      await api.post('v2/shifts', { ...newShift, branch_id: selectedBranchId || null });
      setShowModal(false);
      setNewShift({ siteId: '', startTime: '', endTime: '', requiredGuards: 1 });
      fetchShifts();
    } catch (err) {
      console.error('Failed to create shift:', err);
      alert('Failed to create shift. Please check your inputs.');
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAttendanceStatus = (status?: Shift['attendanceStatus']) => {
    if (status === 'checked_in') return 'Checked in';
    if (status === 'completed') return 'Completed';
    return 'Not started';
  };

  const attendanceBadgeClass = (status?: Shift['attendanceStatus']) => {
    if (status === 'checked_in') return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    if (status === 'completed') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  };

  const scoreBadgeClass = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
    if (score >= 60) return 'bg-sky-500/10 text-sky-300 border-sky-500/20';
    if (score >= 40) return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
    return 'bg-rose-500/10 text-rose-300 border-rose-500/20';
  };

  return (
    <DashboardLayout requiredPermissions="shifts.view">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Shift Management</h2>
          <p className="text-muted-foreground">Schedule and manage guard presence at client sites.</p>
        </div>
        {canCreateShift && (
          <button 
            onClick={() => setShowModal(true)}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
          >
            <Plus size={20} />
            <span>Create Shift</span>
          </button>
        )}
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
              <input 
                type="text" 
                placeholder="Search shifts..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Site</th>
                <th className="px-6 py-4 font-semibold">Branch</th>
                <th className="px-6 py-4 font-semibold">Start Time</th>
                <th className="px-6 py-4 font-semibold">End Time</th>
                <th className="px-6 py-4 font-semibold">Guards</th>
                <th className="px-6 py-4 font-semibold">Assigned Guard</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Attendance</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">Loading shifts...</td></tr>
              ) : shifts.length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">No shifts scheduled yet.</td></tr>
              ) : shifts.filter(shift => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                const siteNameMatch = shift.site?.name?.toLowerCase().includes(query);
                const guardNameMatch = shift.assignments?.some(a => a.guard.name.toLowerCase().includes(query));
                return siteNameMatch || guardNameMatch;
              }).length === 0 ? (
                <tr><td colSpan={9} className="px-6 py-10 text-center text-muted-foreground">No shifts match your search.</td></tr>
              ) : shifts.filter(shift => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                const siteNameMatch = shift.site?.name?.toLowerCase().includes(query);
                const guardNameMatch = shift.assignments?.some(a => a.guard.name.toLowerCase().includes(query));
                return siteNameMatch || guardNameMatch;
              }).map((shift) => (
                <tr key={shift.id} className="hover:bg-white/5 transition-colors group">
                  <td className="px-6 py-4" data-label="Site">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <MapPin size={18} />
                      </div>
                      <span className="font-semibold">{shift.site?.name || 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4" data-label="Branch">
                    <BranchBadge branch={shift.branch} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" data-label="Start">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Calendar size={14} className="text-indigo-400 shrink-0" />
                      <span>{formatDateTime(shift.startTime)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" data-label="End">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Clock size={14} className="text-indigo-400 shrink-0" />
                      <span>{formatDateTime(shift.endTime)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4" data-label="Guards">
                    <div className="flex items-center gap-2">
                       <Users size={16} className="text-muted-foreground" />
                       <span className="font-medium">{shift.requiredGuards}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" data-label="Assigned">
                    <span className={`font-medium ${shift.assignments && shift.assignments.length > 0 ? 'text-indigo-300' : 'text-muted-foreground'}`}>
                      {shift.assignments && shift.assignments.length > 0 
                        ? shift.assignments[0].guard.name 
                        : 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-label="Status">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${shift.status === 'assigned' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                      {shift.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap" data-label="Attendance">
                    <div className="space-y-1.5">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${attendanceBadgeClass(shift.attendanceStatus)}`}>
                        {formatAttendanceStatus(shift.attendanceStatus)}
                      </span>
                      <div className="text-xs text-muted-foreground">
                        In: {shift.checkInTime ? formatDateTime(shift.checkInTime) : 'Not recorded'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Out: {shift.checkOutTime ? formatDateTime(shift.checkOutTime) : 'Not recorded'}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right whitespace-nowrap" data-label="Actions">
                    {!canAssignShift ? (
                      <span className="text-xs font-semibold text-slate-500">No actions</span>
                    ) : shift.assignments && shift.assignments.length > 0 ? (
                       <button 
                         onClick={() => handleUnassign(shift.id)}
                         className="text-xs bg-red-500/10 hover:bg-red-500/20 text-red-500 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                       >
                         Unassign
                       </button>
                    ) : (
                       <button 
                         onClick={() => openAssignModal(shift.id)}
                         className="text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap"
                       >
                         Assign Guard
                       </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Create New Shift</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4">
              <BranchSelect
                value={selectedBranchId}
                onChange={setSelectedBranchId}
                label="Branch"
              />

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Select Site</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  value={newShift.siteId}
                  onChange={(e) => setNewShift({...newShift, siteId: e.target.value})}
                  required
                >
                  <option value="" className="bg-[#0e0e1a]">Choose a site...</option>
                  {sites.map(site => (
                    <option key={site.id} value={site.id} className="bg-[#0e0e1a]">{site.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Start Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                    value={newShift.startTime}
                    onChange={(e) => setNewShift({...newShift, startTime: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">End Time</label>
                  <input 
                    type="datetime-local" 
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                    value={newShift.endTime}
                    onChange={(e) => setNewShift({...newShift, endTime: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Required Guards</label>
                <input 
                  type="number" 
                  min="1"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  value={isNaN(newShift.requiredGuards) ? '' : newShift.requiredGuards}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setNewShift({...newShift, requiredGuards: isNaN(val) ? 1 : val});
                  }}
                  required
                />
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
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
                  Create Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">Assign Guard to Shift</h3>
              <button 
                onClick={resetAssignModal} 
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="flex items-center gap-2 text-sm font-bold text-white">
                    <Sparkles size={16} className="text-sky-300" />
                    Recommended Guards
                  </h4>
                  {selectedShift && (
                    <button
                      type="button"
                      onClick={() => fetchRecommendations(selectedShift)}
                      disabled={recommendationsLoading}
                      className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 disabled:opacity-60"
                    >
                      Refresh
                    </button>
                  )}
                </div>

                {recommendationsLoading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-2 animate-spin text-sky-300" size={20} />
                    Ranking available guards...
                  </div>
                ) : recommendationsError ? (
                  <div className="flex items-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    <AlertTriangle size={16} />
                    {recommendationsError}
                  </div>
                ) : recommendations.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-5 text-center text-sm text-muted-foreground">
                    No recommended guards found. Use manual selection below.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recommendations.slice(0, 5).map((recommendation) => (
                      <button
                        key={recommendation.guard_id}
                        type="button"
                        onClick={() => setSelectedGuard(recommendation.guard_id)}
                        className={`w-full rounded-2xl border p-4 text-left transition ${
                          selectedGuard === recommendation.guard_id
                            ? 'border-sky-400/50 bg-sky-400/10'
                            : 'border-white/10 bg-white/[0.03] hover:bg-white/[0.06]'
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate font-bold text-white">{recommendation.guard_name}</div>
                            <p className="mt-1 text-sm leading-5 text-slate-400">{recommendation.explanation}</p>
                          </div>
                          <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-black ${scoreBadgeClass(recommendation.score)}`}>
                            {recommendation.score}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {recommendation.reasons.slice(0, 3).map((reason) => (
                            <span key={reason} className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200">
                              {reason}
                            </span>
                          ))}
                          {recommendation.warnings.slice(0, 2).map((warning) => (
                            <span key={warning} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200">
                              {warning}
                            </span>
                          ))}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Select Guard</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 text-white"
                  value={selectedGuard}
                  onChange={(e) => setSelectedGuard(e.target.value)}
                  required
                >
                  <option value="" className="bg-[#0e0e1a]">Choose a guard...</option>
                  {guards.map(guard => (
                    <option key={guard.id} value={guard.id} className="bg-[#0e0e1a]">{guard.name}</option>
                  ))}
                </select>
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:gap-4">
                <button 
                  type="button"
                  onClick={resetAssignModal}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20"
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
