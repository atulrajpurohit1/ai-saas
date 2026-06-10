'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Plus, Search, Navigation, Edit2, ListOrdered, ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { PatrolRoute, getPatrolRoutes, createPatrolRoute, updatePatrolRoute, getPatrolRoute, attachRouteCheckpoints, Checkpoint, getCheckpoints } from '@/lib/patrols';

interface Site {
  id: string;
  name: string;
}

interface AttachedCheckpointState {
  checkpoint_id: string;
  name: string;
  sequence_order: number;
}

export default function PatrolRoutesPage() {
  const [routes, setRoutes] = useState<PatrolRoute[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Route details form
  const [formData, setFormData] = useState({
    name: '',
    site_id: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });

  // Checkpoint management modal state
  const [selectedRouteForCheckpoints, setSelectedRouteForCheckpoints] = useState<PatrolRoute | null>(null);
  const [availableCheckpoints, setAvailableCheckpoints] = useState<Checkpoint[]>([]);
  const [attachedCheckpoints, setAttachedCheckpoints] = useState<AttachedCheckpointState[]>([]);
  const [savingCheckpoints, setSavingCheckpoints] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [routesRes, sitesRes] = await Promise.all([
        getPatrolRoutes(selectedSiteFilter || undefined),
        api.get<Site[]>('sites'),
      ]);
      setRoutes(routesRes);
      setSites(sitesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedSiteFilter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!formData.site_id) {
        alert('Please select a site');
        return;
      }

      if (isEditing) {
        await updatePatrolRoute(isEditing, {
          name: formData.name,
          description: formData.description || undefined,
          status: formData.status,
        });
      } else {
        await createPatrolRoute({
          name: formData.name,
          site_id: formData.site_id,
          description: formData.description || undefined,
        });
      }
      setShowModal(false);
      resetForm();
      fetchData();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the route.');
    }
  };

  const handleEdit = (route: PatrolRoute) => {
    setFormData({
      name: route.name,
      site_id: route.siteId,
      description: route.description || '',
      status: route.status,
    });
    setIsEditing(route.id);
    setShowModal(true);
  };

  const handleManageCheckpoints = async (route: PatrolRoute) => {
    setSelectedRouteForCheckpoints(route);
    setAttachedCheckpoints([]);
    setAvailableCheckpoints([]);
    try {
      // 1. Fetch checkpoints belonging to this site
      const siteCheckpoints = await getCheckpoints(route.siteId);
      setAvailableCheckpoints(siteCheckpoints.filter(c => c.status === 'active'));

      // 2. Fetch full route checkpoints
      const routeDetail = await getPatrolRoute(route.id);
      if (routeDetail.checkpoints) {
        const mapped = routeDetail.checkpoints.map(rcp => ({
          checkpoint_id: rcp.checkpointId,
          name: rcp.checkpoint?.name || 'Unknown Checkpoint',
          sequence_order: rcp.sequenceOrder,
        }));
        setAttachedCheckpoints(mapped);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to load checkpoints for route');
    }
  };

  const addCheckpointToRoute = (cp: Checkpoint) => {
    if (attachedCheckpoints.some(acp => acp.checkpoint_id === cp.id)) {
      return; // Already attached
    }
    const newAttached = [
      ...attachedCheckpoints,
      {
        checkpoint_id: cp.id,
        name: cp.name,
        sequence_order: attachedCheckpoints.length,
      },
    ];
    setAttachedCheckpoints(newAttached);
  };

  const removeCheckpointFromRoute = (checkpointId: string) => {
    const filtered = attachedCheckpoints.filter(acp => acp.checkpoint_id !== checkpointId);
    // Re-sequence
    const resequenced = filtered.map((acp, idx) => ({
      ...acp,
      sequence_order: idx,
    }));
    setAttachedCheckpoints(resequenced);
  };

  const moveCheckpoint = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === attachedCheckpoints.length - 1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    const newAttached = [...attachedCheckpoints];

    // Swap items
    const temp = newAttached[index];
    newAttached[index] = newAttached[targetIndex];
    newAttached[targetIndex] = temp;

    // Resequence
    const resequenced = newAttached.map((acp, idx) => ({
      ...acp,
      sequence_order: idx,
    }));

    setAttachedCheckpoints(resequenced);
  };

  const saveAttachedCheckpoints = async () => {
    if (!selectedRouteForCheckpoints) return;
    try {
      setSavingCheckpoints(true);
      await attachRouteCheckpoints(selectedRouteForCheckpoints.id, {
        checkpoints: attachedCheckpoints.map(acp => ({
          checkpoint_id: acp.checkpoint_id,
          sequence_order: acp.sequence_order,
        })),
      });
      setSelectedRouteForCheckpoints(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Failed to save route checkpoints.');
    } finally {
      setSavingCheckpoints(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      site_id: selectedSiteFilter || (sites[0]?.id || ''),
      description: '',
      status: 'active',
    });
    setIsEditing(null);
  };

  const filteredRoutes = routes.filter((route) => {
    return !searchQuery || route.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Patrol Routes</h2>
          <p className="text-muted-foreground">Define and sequence checkpoint check routes for your sites.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>Create Patrol Route</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Search routes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-muted-foreground shrink-0">Filter Site:</label>
              <select
                value={selectedSiteFilter}
                onChange={(e) => setSelectedSiteFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-xl py-2 px-3 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="" className="bg-[#0e0e1a]">All Sites</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id} className="bg-[#0e0e1a]">
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Patrol Route</th>
                <th className="px-6 py-4 font-semibold">Site</th>
                <th className="px-6 py-4 font-semibold">Checkpoints</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    Loading routes...
                  </td>
                </tr>
              ) : filteredRoutes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    No routes found.
                  </td>
                </tr>
              ) : (
                filteredRoutes.map((route) => (
                  <tr key={route.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4" data-label="Route">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <Navigation size={18} />
                        </div>
                        <div>
                          <span className="font-semibold block">{route.name}</span>
                          {route.description && (
                            <span className="text-xs text-muted-foreground block max-w-xs truncate">
                              {route.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Site">
                      <span className="text-sm font-medium">{route.site?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Checkpoints">
                      <span className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-0.5 text-xs font-bold text-indigo-400">
                        {route.checkpoints?.length || 0} Checkpoints
                      </span>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Status">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          route.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {route.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleManageCheckpoints(route)}
                          className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/10 rounded-xl transition-all text-xs font-bold text-indigo-400 border border-indigo-500/20 hover:border-indigo-400"
                          title="Manage checkpoints sequence"
                        >
                          <ListOrdered size={14} />
                          <span>Checkpoints</span>
                        </button>
                        <button
                          onClick={() => handleEdit(route)}
                          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300"
                          title="Edit route details"
                        >
                          <Edit2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE/EDIT ROUTE MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {isEditing ? 'Edit Patrol Route' : 'Create Patrol Route'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Route Name</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Perimeter Check Route"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Site</label>
                <select
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.site_id}
                  onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                  disabled={!!isEditing}
                  required
                >
                  <option value="" disabled className="bg-[#0e0e1a]">Select Site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id} className="bg-[#0e0e1a]">
                      {site.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Description (Optional)</label>
                <textarea
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-none"
                  placeholder="e.g. Security check around building A, B, and parking lot."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {isEditing && (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                  >
                    <option value="active" className="bg-[#0e0e1a]">Active</option>
                    <option value="inactive" className="bg-[#0e0e1a]">Inactive</option>
                  </select>
                </div>
              )}

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
                  {isEditing ? 'Save Changes' : 'Create Route'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MANAGE CHECKPOINTS SEQUENCE MODAL */}
      {selectedRouteForCheckpoints && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-4xl overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8 flex flex-col">
            <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-2xl font-bold">Manage Route Checkpoints</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Route: <span className="font-semibold text-white">{selectedRouteForCheckpoints.name}</span> ({selectedRouteForCheckpoints.site?.name})
                </p>
              </div>
              <button
                onClick={() => setSelectedRouteForCheckpoints(null)}
                className="text-muted-foreground hover:text-white transition-colors"
              >
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-[300px] overflow-y-auto flex-1 pb-4">
              {/* AVAILABLE CHECKPOINTS */}
              <div className="border border-white/5 rounded-2xl p-4 bg-white/5 flex flex-col">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Available Checkpoints</h4>
                <div className="space-y-2 overflow-y-auto max-h-[350px] flex-1 pr-2">
                  {availableCheckpoints.filter(cp => !attachedCheckpoints.some(acp => acp.checkpoint_id === cp.id)).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No more checkpoints available for this site.</p>
                  ) : (
                    availableCheckpoints
                      .filter(cp => !attachedCheckpoints.some(acp => acp.checkpoint_id === cp.id))
                      .map(cp => (
                        <div key={cp.id} className="flex justify-between items-center p-3 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 transition-all">
                          <div>
                            <span className="font-semibold text-sm block">{cp.name}</span>
                            {cp.description && <span className="text-xs text-muted-foreground">{cp.description}</span>}
                          </div>
                          <button
                            onClick={() => addCheckpointToRoute(cp)}
                            className="bg-primary hover:bg-indigo-500 text-white font-bold text-xs py-1.5 px-3 rounded-lg transition-all"
                          >
                            Add
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* ATTACHED CHECKPOINTS SEQUENCE */}
              <div className="border border-white/5 rounded-2xl p-4 bg-white/5 flex flex-col">
                <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Route Checkpoints & Order</h4>
                <div className="space-y-2 overflow-y-auto max-h-[350px] flex-1 pr-2">
                  {attachedCheckpoints.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No checkpoints added to this route yet.</p>
                  ) : (
                    attachedCheckpoints.map((acp, index) => (
                      <div key={acp.checkpoint_id} className="flex items-center gap-3 p-3 rounded-xl border border-indigo-500/20 bg-indigo-500/5 transition-all">
                        <span className="font-mono font-bold text-indigo-400 text-sm w-5 text-center">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <span className="font-semibold text-sm block truncate">{acp.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => moveCheckpoint(index, 'up')}
                            disabled={index === 0}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white disabled:opacity-20 transition-all"
                            title="Move Up"
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            onClick={() => moveCheckpoint(index, 'down')}
                            disabled={index === attachedCheckpoints.length - 1}
                            className="p-1.5 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-white disabled:opacity-20 transition-all"
                            title="Move Down"
                          >
                            <ArrowDown size={14} />
                          </button>
                          <button
                            onClick={() => removeCheckpointFromRoute(acp.checkpoint_id)}
                            className="p-1.5 hover:bg-red-500/20 rounded-lg text-red-400 hover:text-red-300 transition-all"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-white/5 pt-4 flex gap-4">
              <button
                type="button"
                onClick={() => setSelectedRouteForCheckpoints(null)}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveAttachedCheckpoints}
                disabled={savingCheckpoints}
                className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {savingCheckpoints ? 'Saving...' : 'Save Sequence'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
