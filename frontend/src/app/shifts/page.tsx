'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import ShiftsCalendar from '@/components/ShiftsCalendar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { useNewIntent } from '@/hooks/useNewIntent';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { GuardRecommendation } from '@/lib/ai-insights';
import { branchParams, BranchSummary } from '@/lib/branches';
import { cn } from '@/lib/utils';
import { Plus, Search, Calendar, CalendarClock, Clock, Users, MapPin, Sparkles, Loader2, CalendarDays, List } from 'lucide-react';

const VIEW_STORAGE_KEY = 'ai-saas-shifts-view';

const selectClass =
  'h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

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
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [unassignTarget, setUnassignTarget] = useState<string | null>(null);
  const [unassigning, setUnassigning] = useState(false);

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VIEW_STORAGE_KEY) : null;
    if (stored === 'list' || stored === 'calendar') setView(stored);
  }, []);

  const changeView = (nextView: 'list' | 'calendar') => {
    setView(nextView);
    localStorage.setItem(VIEW_STORAGE_KEY, nextView);
  };

  const [newShift, setNewShift] = useState({
    siteId: '',
    startTime: '',
    endTime: '',
    requiredGuards: 1,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId, canCreateShift, canAssignShift]);

  useNewIntent(() => {
    if (canCreateShift) setShowModal(true);
  });

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
    } catch (err) {
      console.error('Failed to fetch guard recommendations:', err);
      setRecommendationsError(getApiErrorMessage(err, 'Could not load recommended guards.'));
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
      toast.success('Guard assigned to shift.');
    } catch (err) {
      console.error('Failed to assign guard:', err);
      toast.error(getApiErrorMessage(err, 'Failed to assign guard.'));
    }
  };

  const handleUnassign = async () => {
    if (!unassignTarget) return;
    setUnassigning(true);
    try {
      await api.delete(`v2/shifts/${unassignTarget}/unassign`);
      fetchShifts();
      toast.success('Guard unassigned.');
    } catch (err) {
      console.error('Failed to unassign guard:', err);
      toast.error('Failed to unassign guard.');
    } finally {
      setUnassigning(false);
      setUnassignTarget(null);
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
      toast.success('Shift created.');
    } catch (err) {
      console.error('Failed to create shift:', err);
      toast.error(getApiErrorMessage(err, 'Failed to create shift. Please check your inputs.'));
    }
  };

  const formatDateTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatAttendanceStatus = (status?: Shift['attendanceStatus']) => {
    if (status === 'checked_in') return 'Checked in';
    if (status === 'completed') return 'Completed';
    return 'Not started';
  };

  const attendanceTone = (status?: Shift['attendanceStatus']): 'info' | 'success' | 'neutral' => {
    if (status === 'checked_in') return 'info';
    if (status === 'completed') return 'success';
    return 'neutral';
  };

  const matchesSearch = (shift: Shift) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const siteNameMatch = shift.site?.name?.toLowerCase().includes(query);
    const guardNameMatch = shift.assignments?.some((a) => a.guard.name.toLowerCase().includes(query));
    return Boolean(siteNameMatch || guardNameMatch);
  };

  const filteredShifts = shifts.filter(matchesSearch);

  const scoreTone = (score: number): 'success' | 'info' | 'warning' | 'error' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'error';
  };

  return (
    <DashboardLayout requiredPermissions="shifts.view">
      <PageHeader
        title="Shift Management"
        description="Schedule and manage guard presence at client sites."
        actions={
          <>
            <div className="flex rounded-lg border border-border bg-muted p-1" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => changeView('list')}
                aria-pressed={view === 'list'}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List size={15} />
                <span className="hidden sm:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => changeView('calendar')}
                aria-pressed={view === 'calendar'}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  view === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <CalendarDays size={15} />
                <span className="hidden sm:inline">Calendar</span>
              </button>
            </div>
            {canCreateShift && (
              <Button onClick={() => setShowModal(true)}>
                <Plus size={16} />
                Create Shift
              </Button>
            )}
          </>
        }
      />

      <div className="mb-5 rounded-[var(--radius-lg)] border border-border bg-card p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder="Search by site or guard..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
        </div>
      </div>

      {view === 'calendar' ? (
        <ShiftsCalendar
          shifts={filteredShifts}
          onSelectShift={(shiftId) => {
            const shift = shifts.find((s) => s.id === shiftId);
            if (!shift) return;
            if ((shift.assignments?.length ?? 0) === 0) openAssignModal(shiftId);
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
          {loading ? (
            <LoadingState label="Loading shifts..." />
          ) : shifts.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No shifts scheduled"
              description="Create a shift to put a guard on a site for a time window. Switch to the calendar view to see coverage at a glance."
              action={
                canCreateShift ? (
                  <Button onClick={() => setShowModal(true)}>
                    <Plus size={16} />
                    Create Shift
                  </Button>
                ) : undefined
              }
            />
          ) : filteredShifts.length === 0 ? (
            <EmptyState icon={Search} title="No matching shifts" description="Try a different site or guard name." />
          ) : (
            <div className="overflow-x-auto">
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Site</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Start</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">End</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Guards</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Assigned</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Schedule</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Attendance</TableHead>
                    <TableHead className="px-6 py-3" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.map((shift) => {
                    const assigned = shift.assignments && shift.assignments.length > 0;
                    return (
                      <TableRow key={shift.id}>
                        <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Site">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                              <MapPin size={16} />
                            </div>
                            <span className="font-semibold text-foreground">{shift.site?.name || 'N/A'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Branch">
                          <BranchBadge branch={shift.branch} />
                        </TableCell>
                        <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-nowrap" data-label="Start">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="shrink-0" aria-hidden="true" />
                            {formatDateTime(shift.startTime)}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-nowrap" data-label="End">
                          <div className="flex items-center gap-2">
                            <Clock size={14} className="shrink-0" aria-hidden="true" />
                            {formatDateTime(shift.endTime)}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Guards">
                          <div className="flex items-center gap-2">
                            <Users size={15} className="text-muted-foreground" aria-hidden="true" />
                            <span className="font-medium text-foreground">{shift.requiredGuards}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-nowrap" data-label="Assigned">
                          <span className={assigned ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                            {assigned ? shift.assignments[0].guard.name : 'Unassigned'}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Schedule">
                          <StatusBadge status={shift.status} />
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-nowrap" data-label="Attendance">
                          <div className="space-y-1.5">
                            <StatusBadge
                              label={formatAttendanceStatus(shift.attendanceStatus)}
                              tone={attendanceTone(shift.attendanceStatus)}
                            />
                            <div className="text-xs text-muted-foreground">
                              In: {shift.checkInTime ? formatDateTime(shift.checkInTime) : 'Not recorded'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Out: {shift.checkOutTime ? formatDateTime(shift.checkOutTime) : 'Not recorded'}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 text-right whitespace-nowrap" data-label="Actions">
                          {!canAssignShift ? (
                            <span className="text-xs text-muted-foreground">No actions</span>
                          ) : assigned ? (
                            <Button variant="outline" size="sm" onClick={() => setUnassignTarget(shift.id)}>
                              Unassign
                            </Button>
                          ) : (
                            <Button variant="outline" size="sm" onClick={() => openAssignModal(shift.id)}>
                              Assign Guard
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Create shift */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create new shift</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateShift} className="space-y-4">
            <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Branch" />

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Select site</label>
              <select
                className={selectClass}
                value={newShift.siteId}
                onChange={(e) => setNewShift({ ...newShift, siteId: e.target.value })}
                required
              >
                <option value="">Choose a site...</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Start time</label>
                <Input
                  type="datetime-local"
                  value={newShift.startTime}
                  onChange={(e) => setNewShift({ ...newShift, startTime: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">End time</label>
                <Input
                  type="datetime-local"
                  value={newShift.endTime}
                  onChange={(e) => setNewShift({ ...newShift, endTime: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Required guards</label>
              <Input
                type="number"
                min="1"
                value={Number.isNaN(newShift.requiredGuards) ? '' : newShift.requiredGuards}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNewShift({ ...newShift, requiredGuards: Number.isNaN(val) ? 1 : val });
                }}
                required
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Shift</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign guard */}
      <Dialog open={showAssignModal} onOpenChange={(o) => (o ? setShowAssignModal(true) : resetAssignModal())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign guard to shift</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAssign} className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Sparkles size={16} className="text-primary" aria-hidden="true" />
                  Recommended guards
                </h4>
                {selectedShift && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fetchRecommendations(selectedShift)}
                    disabled={recommendationsLoading}
                  >
                    Refresh
                  </Button>
                )}
              </div>

              {recommendationsLoading ? (
                <div className="rounded-lg border border-border bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
                  <Loader2 className="mx-auto mb-2 animate-spin text-primary" size={20} />
                  Ranking available guards...
                </div>
              ) : recommendationsError ? (
                <ErrorState message={recommendationsError} onRetry={selectedShift ? () => fetchRecommendations(selectedShift) : undefined} />
              ) : recommendations.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
                  No recommended guards. Use manual selection below.
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.slice(0, 5).map((recommendation) => (
                    <button
                      key={recommendation.guard_id}
                      type="button"
                      onClick={() => setSelectedGuard(recommendation.guard_id)}
                      className={cn(
                        'w-full rounded-lg border p-4 text-left transition',
                        selectedGuard === recommendation.guard_id
                          ? 'border-primary/50 bg-primary/[0.06]'
                          : 'border-border bg-card hover:bg-muted',
                      )}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{recommendation.guard_name}</div>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">{recommendation.explanation}</p>
                        </div>
                        <StatusBadge label={String(recommendation.score)} tone={scoreTone(recommendation.score)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {recommendation.reasons.slice(0, 3).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full bg-success-wash px-2.5 py-0.5 text-[11px] font-semibold text-success"
                          >
                            {reason}
                          </span>
                        ))}
                        {recommendation.warnings.slice(0, 2).map((warning) => (
                          <span
                            key={warning}
                            className="rounded-full bg-warning-wash px-2.5 py-0.5 text-[11px] font-semibold text-warning"
                          >
                            {warning}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Select guard</label>
              <select
                className={selectClass}
                value={selectedGuard}
                onChange={(e) => setSelectedGuard(e.target.value)}
                required
              >
                <option value="">Choose a guard...</option>
                {guards.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={resetAssignModal}>
                Cancel
              </Button>
              <Button type="submit">Confirm Assignment</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={unassignTarget !== null}
        onOpenChange={(o) => !o && setUnassignTarget(null)}
        title="Unassign guard?"
        description="The guard will be removed from this shift and it will return to unassigned."
        confirmLabel="Unassign"
        destructive
        loading={unassigning}
        onConfirm={handleUnassign}
      />
    </DashboardLayout>
  );
}
