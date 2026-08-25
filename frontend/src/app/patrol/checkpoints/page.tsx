'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { Plus, Search, MapPin, MapPinOff, Edit2, QrCode, Crosshair, Loader2 } from 'lucide-react';
import { Checkpoint, getCheckpoints, createCheckpoint, updateCheckpoint } from '@/lib/patrols';
import { requestCurrentLocation, geolocationErrorMessage } from '@/lib/geolocation';

interface Site {
  id: string;
  name: string;
}

export default function CheckpointsPage() {
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedSiteFilter, setSelectedSiteFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    site_id: '',
    description: '',
    location_note: '',
    qr_code_value: '',
    status: 'active' as 'active' | 'inactive',
    latitude: '',
    longitude: '',
    geofence_radius_meters: '',
  });
  const [locatingForForm, setLocatingForForm] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [cpsRes, sitesRes] = await Promise.all([
        getCheckpoints(selectedSiteFilter || undefined),
        api.get<Site[]>('sites'),
      ]);
      setCheckpoints(cpsRes);
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
        toast.error('Please select a site');
        return;
      }

      const hasLat = formData.latitude.trim() !== '';
      const hasLng = formData.longitude.trim() !== '';
      if (hasLat !== hasLng) {
        toast.error('Enter both latitude and longitude, or leave both blank.');
        return;
      }

      const geofenceFields = hasLat
        ? {
            latitude: Number(formData.latitude),
            longitude: Number(formData.longitude),
            geofence_radius_meters: formData.geofence_radius_meters.trim()
              ? Number(formData.geofence_radius_meters)
              : undefined,
          }
        : {};

      if (isEditing) {
        await updateCheckpoint(isEditing, {
          name: formData.name,
          description: formData.description || undefined,
          location_note: formData.location_note || undefined,
          qr_code_value: formData.qr_code_value || undefined,
          status: formData.status,
          ...(hasLat ? geofenceFields : { clear_geofence: true }),
        });
      } else {
        await createCheckpoint({
          name: formData.name,
          site_id: formData.site_id,
          description: formData.description || undefined,
          location_note: formData.location_note || undefined,
          qr_code_value: formData.qr_code_value || undefined,
          ...geofenceFields,
        });
      }
      setShowModal(false);
      resetForm();
      fetchData();
      toast.success(isEditing ? 'Checkpoint updated.' : 'Checkpoint created.');
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'An error occurred while saving the checkpoint.'));
    }
  };

  const handleUseCurrentLocation = async () => {
    setLocatingForForm(true);
    const result = await requestCurrentLocation();
    setLocatingForForm(false);

    if (result.status !== 'success') {
      toast.error(geolocationErrorMessage(result.status));
      return;
    }

    setFormData((current) => ({
      ...current,
      latitude: result.latitude.toFixed(6),
      longitude: result.longitude.toFixed(6),
      geofence_radius_meters: current.geofence_radius_meters || '50',
    }));
    toast.success(`Location captured (±${Math.round(result.accuracy)}m accuracy).`);
  };

  const handleEdit = (cp: Checkpoint) => {
    setFormData({
      name: cp.name,
      site_id: cp.siteId,
      description: cp.description || '',
      location_note: cp.locationNote || '',
      qr_code_value: cp.qrCodeValue || '',
      status: cp.status,
      latitude: cp.latitude !== null ? String(cp.latitude) : '',
      longitude: cp.longitude !== null ? String(cp.longitude) : '',
      geofence_radius_meters: cp.geofenceRadiusMeters !== null ? String(cp.geofenceRadiusMeters) : '',
    });
    setIsEditing(cp.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      site_id: selectedSiteFilter || (sites[0]?.id || ''),
      description: '',
      location_note: '',
      qr_code_value: '',
      status: 'active',
      latitude: '',
      longitude: '',
      geofence_radius_meters: '',
    });
    setIsEditing(null);
  };

  const filteredCheckpoints = checkpoints.filter((cp) => {
    const matchesSearch = !searchQuery || cp.name.toLowerCase().includes(searchQuery.toLowerCase()) || (cp.qrCodeValue && cp.qrCodeValue.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Checkpoints</h2>
          <p className="text-muted-foreground">Manage physical checkpoints that guards scan during patrols.</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>Create Checkpoint</span>
        </button>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
            <div className="relative w-full sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
              <input
                type="text"
                placeholder="Search checkpoints or QR values..."
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
                <th className="px-6 py-4 font-semibold">Checkpoint</th>
                <th className="px-6 py-4 font-semibold">Site</th>
                <th className="px-6 py-4 font-semibold">QR Code</th>
                <th className="px-6 py-4 font-semibold">Location Details</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    Loading checkpoints...
                  </td>
                </tr>
              ) : filteredCheckpoints.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No checkpoints found.
                  </td>
                </tr>
              ) : (
                filteredCheckpoints.map((cp) => (
                  <tr key={cp.id} className="hover:bg-white/5 transition-colors group">
                    <td className="px-6 py-4" data-label="Checkpoint">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                          <MapPin size={18} />
                        </div>
                        <div>
                          <span className="font-semibold block">{cp.name}</span>
                          {cp.description && (
                            <span className="text-xs text-muted-foreground block max-w-xs truncate">
                              {cp.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Site">
                      <span className="text-sm font-medium">{cp.site?.name || 'Unknown'}</span>
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="QR Code">
                      {cp.qrCodeValue ? (
                        <div className="flex items-center gap-1.5 text-xs font-mono bg-white/5 border border-white/10 px-2 py-1 rounded-lg w-fit text-emerald-400">
                          <QrCode size={12} />
                          <span className="max-w-[150px] truncate">{cp.qrCodeValue}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground font-mono">None</span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Location Details">
                      <span className="text-sm text-muted-foreground block">
                        {cp.locationNote || 'No location notes'}
                      </span>
                      {cp.latitude !== null && cp.longitude !== null ? (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
                          <MapPin size={11} />
                          GPS geofence ({cp.geofenceRadiusMeters}m)
                        </span>
                      ) : (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          <MapPinOff size={11} />
                          No GPS configured
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 align-middle" data-label="Status">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          cp.status === 'active'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}
                      >
                        {cp.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                      <button
                        onClick={() => handleEdit(cp)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300"
                        title="Edit checkpoint"
                      >
                        <Edit2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">
                {isEditing ? 'Edit Checkpoint' : 'Create Checkpoint'}
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
                <label className="text-sm font-medium text-muted-foreground">Checkpoint Name</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Back Gate A"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Associated Site</label>
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
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. Next to fire hose container"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Location Notes / GPS (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. First floor loading dock near door 4"
                  value={formData.location_note}
                  onChange={(e) => setFormData({ ...formData, location_note: e.target.value })}
                />
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm font-medium text-muted-foreground">GPS Geofence (Optional)</label>
                  <button
                    type="button"
                    onClick={() => void handleUseCurrentLocation()}
                    disabled={locatingForForm}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-indigo-300 transition hover:bg-white/10 disabled:opacity-50"
                  >
                    {locatingForForm ? <Loader2 className="animate-spin" size={12} /> : <Crosshair size={12} />}
                    Use my location
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  When set, guards must be physically within the radius to have this checkpoint marked as location-verified.
                </p>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Latitude"
                    value={formData.latitude}
                    onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                  />
                  <input
                    type="number"
                    step="any"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Longitude"
                    value={formData.longitude}
                    onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                  />
                  <input
                    type="number"
                    min={5}
                    max={2000}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Radius (m)"
                    value={formData.geofence_radius_meters}
                    onChange={(e) => setFormData({ ...formData, geofence_radius_meters: e.target.value })}
                  />
                </div>
                {formData.latitude && (
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, latitude: '', longitude: '', geofence_radius_meters: '' })}
                    className="text-xs font-semibold text-slate-500 hover:text-rose-300"
                  >
                    Clear geofence
                  </button>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">QR Code / Scan Value (Optional)</label>
                <input
                  type="text"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. CP-SITEA-GATE-01"
                  value={formData.qr_code_value}
                  onChange={(e) => setFormData({ ...formData, qr_code_value: e.target.value })}
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
                  {isEditing ? 'Save Changes' : 'Create Checkpoint'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
