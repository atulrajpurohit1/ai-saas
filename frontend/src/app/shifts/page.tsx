'use client';

import { formatDateTime as fmtDateTime } from '@/lib/format';
import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import DateTimeField from '@/components/DateTimeField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import SearchField from '@/components/SearchField';
import { useAuth } from '@/context/AuthContext';
import { useNewIntent } from '@/hooks/useNewIntent';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { GuardRecommendation } from '@/lib/ai-insights';
import { branchParams, BranchSummary } from '@/lib/branches';
import { cn } from '@/lib/utils';
import { Plus, Search, Calendar, CalendarClock, Clock, Users, MapPin, Sparkles, Loader2, CalendarDays, List, X, AlertTriangle, Pencil, Trash2, UserX } from 'lucide-react';
import Link from 'next/link';

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
  email?: string | null;
  deactivatedAt?: string | null;
  /** False when the guard has no portal password and so cannot log in. */
  canSignIn?: boolean;
}

type AttendanceStatus = 'not_started' | 'checked_in' | 'completed';

interface ShiftAssignment {
  id: string;
  guardId: string;
  guard: {
    id: string;
    name: string;
  };
  attendanceStatus?: AttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  /** Derived server-side: assigned, overdue, and still no check-in. */
  noShow?: boolean;
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
  createdAt: string;
  assignments: ShiftAssignment[];
}

interface UnassignTarget {
  shiftId: string;
  guardId: string;
  guardName: string;
}

const isFullyStaffed = (shift: Shift) =>
  (shift.assignments?.length ?? 0) >= shift.requiredGuards;

const hasAttendance = (shift: Shift) =>
  shift.assignments?.some((assignment) => Boolean(assignment.checkInTime)) ?? false;

const noShowCount = (shift: Shift) =>
  shift.assignments?.filter((assignment) => assignment.noShow).length ?? 0;

const startsToday = (shift: Shift) => {
  const start = new Date(shift.startTime);
  const now = new Date();
  return (
    start.getFullYear() === now.getFullYear() &&
    start.getMonth() === now.getMonth() &&
    start.getDate() === now.getDate()
  );
};

/** ISO timestamp -> the 'YYYY-MM-DDTHH:mm' local value DateTimeField takes. */
const toLocalInputValue = (iso: string) => {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
};

export default function ShiftsPage() {
  return (
    <Suspense fallback={null}>
      <ShiftsView />
    </Suspense>
  );
}

function ShiftsView() {
  // The Sites list links here filtered to one site.
  const searchParams = useSearchParams();
  const siteIdFilter = searchParams.get('site_id');
  const { can } = useAuth();
  const canCreateShift = can('shifts.create');
  const canAssignShift = can('shifts.assign');
  const canDeleteShift = can('shifts.delete');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [creatingShift, setCreatingShift] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedGuard, setSelectedGuard] = useState('');
  const [recommendations, setRecommendations] = useState<GuardRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [unassignTarget, setUnassignTarget] = useState<UnassignTarget | null>(null);
  // Set while editing: the create dialog doubles as the edit dialog.
  const [noShowOnly, setNoShowOnly] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);
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
      // Deactivated guards can't be rostered, so don't offer them.
      setGuards((res.data as Guard[]).filter((guard) => !guard.deactivatedAt));
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
      await api.delete(`v2/shifts/${unassignTarget.shiftId}/unassign/${unassignTarget.guardId}`);
      fetchShifts();
      toast.success(`${unassignTarget.guardName} unassigned.`);
    } catch (err) {
      console.error('Failed to unassign guard:', err);
      toast.error(getApiErrorMessage(err, 'Failed to unassign guard.'));
    } finally {
      setUnassigning(false);
      setUnassignTarget(null);
    }
  };

  const openEditModal = (shift: Shift) => {
    if (!canCreateShift) return;
    setEditingShift(shift);
    setNewShift({
      siteId: shift.siteId,
      startTime: toLocalInputValue(shift.startTime),
      endTime: toLocalInputValue(shift.endTime),
      requiredGuards: shift.requiredGuards,
    });
    setShowModal(true);
  };

  const closeShiftModal = () => {
    setShowModal(false);
    setEditingShift(null);
    setNewShift({ siteId: '', startTime: '', endTime: '', requiredGuards: 1 });
  };

  const handleSaveShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateShift) return;
    if (newShift.startTime && newShift.endTime && newShift.endTime <= newShift.startTime) {
      toast.error('End time must be after the start time.');
      return;
    }
    // Guard against a double-submit (double-click, or Enter + click): without
    // this, each submit fired its own POST and created a duplicate shift.
    if (creatingShift) return;
    setCreatingShift(true);
    try {
      if (editingShift) {
        // Once a guard has checked in the backend accepts only the headcount,
        // so don't send times it would reject.
        const payload = hasAttendance(editingShift)
          ? { requiredGuards: newShift.requiredGuards }
          : newShift;
        await api.put(`v2/shifts/${editingShift.id}`, payload);
        toast.success('Shift updated.');
      } else {
        await api.post('v2/shifts', { ...newShift, branch_id: selectedBranchId || null });
        toast.success('Shift created.');
      }
      closeShiftModal();
      fetchShifts();
    } catch (err) {
      console.error('Failed to save shift:', err);
      toast.error(
        getApiErrorMessage(
          err,
          editingShift ? 'Failed to update shift.' : 'Failed to create shift. Please check your inputs.',
        ),
      );
    } finally {
      setCreatingShift(false);
    }
  };

  const handleDeleteShift = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`v2/shifts/${deleteTarget.id}`);
      fetchShifts();
      toast.success('Shift deleted.');
      setDeleteTarget(null);
    } catch (err) {
      console.error('Failed to delete shift:', err);
      toast.error(getApiErrorMessage(err, 'Failed to delete shift.'));
    } finally {
      setDeleting(false);
    }
  };

  const formatDateTime = (dateStr: string) =>
    fmtDateTime(dateStr);

  const formatAttendanceStatus = (status?: AttendanceStatus) => {
    if (status === 'checked_in') return 'Checked in';
    if (status === 'completed') return 'Completed';
    return 'Not started';
  };

  const attendanceTone = (status?: AttendanceStatus): 'info' | 'success' | 'neutral' => {
    if (status === 'checked_in') return 'info';
    if (status === 'completed') return 'success';
    return 'neutral';
  };

  // Attendance arrives per guard; this is the one-line roll-up for the row.
  const staffingSummary = (
    shift: Shift,
  ): { label: string; tone: 'info' | 'success' | 'neutral' | 'error' } | null => {
    const total = shift.assignments?.length ?? 0;
    if (total === 0) return null;
    const missing = noShowCount(shift);
    if (missing > 0) {
      return {
        label: missing === total ? 'No-show' : `${missing} of ${total} no-show`,
        tone: 'error',
      };
    }
    const arrived = shift.assignments.filter(
      (a) => a.attendanceStatus === 'checked_in' || a.attendanceStatus === 'completed',
    ).length;
    const done = shift.assignments.filter((a) => a.attendanceStatus === 'completed').length;
    if (done === total) return { label: total === 1 ? 'Completed' : 'All checked out', tone: 'success' };
    if (arrived === 0) return { label: 'Not started', tone: 'neutral' };
    return { label: total === 1 ? 'Checked in' : `${arrived} of ${total} checked in`, tone: 'info' };
  };

  const selectedShiftRecord = selectedShift ? shifts.find((s) => s.id === selectedShift) ?? null : null;
  const alreadyAssignedIds = new Set(selectedShiftRecord?.assignments.map((a) => a.guardId) ?? []);
  const assignableGuards = guards.filter((guard) => !alreadyAssignedIds.has(guard.id));
  const visibleRecommendations = recommendations.filter((r) => !alreadyAssignedIds.has(r.guard_id));
  const selectedGuardRecord = guards.find((guard) => guard.id === selectedGuard) ?? null;

  const matchesSearch = (shift: Shift) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const siteNameMatch = shift.site?.name?.toLowerCase().includes(query);
    const guardNameMatch = shift.assignments?.some((a) => a.guard.name.toLowerCase().includes(query));
    return Boolean(siteNameMatch || guardNameMatch);
  };

  const filteredShifts = shifts.filter(
    (shift) =>
      matchesSearch(shift) &&
      (!noShowOnly || noShowCount(shift) > 0) &&
      (!siteIdFilter || shift.siteId === siteIdFilter),
  );

  const filteredSiteName = siteIdFilter
    ? shifts.find((shift) => shift.siteId === siteIdFilter)?.site?.name ?? null
    : null;

  // Today's no-shows are the number a supervisor acts on; an unchecked-in
  // shift from last month is history, not an alert.
  const todaysNoShows = shifts
    .filter(startsToday)
    .reduce((total, shift) => total + noShowCount(shift), 0);

  const scoreTone = (score: number): 'success' | 'info' | 'warning' | 'error' => {
    if (score >= 80) return 'success';
    if (score >= 60) return 'info';
    if (score >= 40) return 'warning';
    return 'error';
  };

  return (
    <DashboardLayout requiredModule="FINANCE" requiredPermissions="shifts.view">
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
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by site or guard..."
            className="w-full sm:max-w-sm"
          />
          <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
        </div>

        {siteIdFilter && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/8 px-3 py-1 text-xs font-semibold text-primary">
              <MapPin size={13} aria-hidden="true" />
              {filteredSiteName ?? 'One site'}
            </span>
            <Link href="/shifts" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
              Show all sites
            </Link>
          </div>
        )}

        {/* No-shows are the thing a guard company most needs to see, so the
            count sits above the list and doubles as the filter. */}
        {(todaysNoShows > 0 || noShowOnly) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <button
              type="button"
              onClick={() => setNoShowOnly((current) => !current)}
              aria-pressed={noShowOnly}
              className={cn(
                'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold transition',
                noShowOnly
                  ? 'bg-error text-white'
                  : 'bg-error-wash text-error hover:brightness-95',
              )}
            >
              <UserX size={13} aria-hidden="true" />
              {todaysNoShows} no-show{todaysNoShows === 1 ? '' : 's'} today
            </button>
            {noShowOnly && (
              <button
                type="button"
                onClick={() => setNoShowOnly(false)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Show all shifts
              </button>
            )}
          </div>
        )}
      </div>

      {view === 'calendar' ? (
        <ShiftsCalendar
          shifts={filteredShifts}
          onSelectShift={(shiftId) => {
            const shift = shifts.find((s) => s.id === shiftId);
            if (!shift) return;
            if (!isFullyStaffed(shift)) openAssignModal(shiftId);
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
            <EmptyState
              icon={noShowOnly ? UserX : Search}
              title={noShowOnly ? 'No no-shows' : 'No matching shifts'}
              description={
                noShowOnly
                  ? 'Every assigned guard has checked in.'
                  : siteIdFilter
                    ? 'This site has no shifts matching your search.'
                    : 'Try a different site or guard name.'
              }
            />
          ) : (
            <div>
              <Table className="responsive-table">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="min-w-[15rem] px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Site</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">When</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Staffing</TableHead>
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                    <TableHead className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredShifts.map((shift) => {
                    const assigned = shift.assignments && shift.assignments.length > 0;
                    const summary = staffingSummary(shift);
                    const full = isFullyStaffed(shift);
                    return (
                      <TableRow key={shift.id}>
                        <TableCell className="min-w-[15rem] px-6 py-3.5 whitespace-normal" data-label="Site">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                              <MapPin size={16} />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground">{shift.site?.name || 'N/A'}</span>
                              <div className="mt-1">
                                <BranchBadge branch={shift.branch} />
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 text-sm whitespace-nowrap" data-label="When">
                          <div className="flex items-center gap-2 text-foreground">
                            <Calendar size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                            {formatDateTime(shift.startTime)}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-muted-foreground">
                            <Clock size={14} className="shrink-0" aria-hidden="true" />
                            {formatDateTime(shift.endTime)}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-nowrap" data-label="Staffing">
                          {assigned ? (
                            <ul className="space-y-1.5">
                              {shift.assignments.map((assignment) => (
                                <li key={assignment.id} className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">{assignment.guard.name}</span>
                                  <span
                                    title={
                                      assignment.checkInTime
                                        ? `In ${formatDateTime(assignment.checkInTime)}${
                                            assignment.checkOutTime ? ` \u00b7 Out ${formatDateTime(assignment.checkOutTime)}` : ''
                                          }`
                                        : assignment.noShow
                                          ? 'Assigned but never checked in'
                                          : undefined
                                    }
                                  >
                                    {assignment.noShow ? (
                                      <StatusBadge label="No-show" tone="error" />
                                    ) : (
                                      <StatusBadge
                                        label={formatAttendanceStatus(assignment.attendanceStatus)}
                                        tone={attendanceTone(assignment.attendanceStatus)}
                                      />
                                    )}
                                  </span>
                                  {canAssignShift && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setUnassignTarget({
                                          shiftId: shift.id,
                                          guardId: assignment.guardId,
                                          guardName: assignment.guard.name,
                                        })
                                      }
                                      aria-label={`Unassign ${assignment.guard.name}`}
                                      title={`Unassign ${assignment.guard.name}`}
                                      className="rounded-md p-1 text-muted-foreground transition hover:bg-error-wash hover:text-error focus-visible:ring-2 focus-visible:ring-ring"
                                    >
                                      <X size={14} />
                                    </button>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-muted-foreground">Unassigned</span>
                          )}
                          <div className={cn('mt-1.5 flex items-center gap-1.5 text-xs', full ? 'text-muted-foreground' : 'font-semibold text-warning')}>
                            <Users size={13} aria-hidden="true" />
                            {shift.assignments?.length ?? 0} of {shift.requiredGuards} assigned
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 whitespace-nowrap" data-label="Status">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge status={shift.status} />
                            {summary && <StatusBadge label={summary.label} tone={summary.tone} />}
                          </div>
                        </TableCell>
                        <TableCell className="px-6 py-3.5 text-right whitespace-nowrap" data-label="Action">
                          <div className="flex items-center justify-end gap-2">
                            {canAssignShift && !full && (
                              <Button size="sm" onClick={() => openAssignModal(shift.id)}>
                                Assign Guard
                              </Button>
                            )}
                            {canAssignShift && full && (
                              <span className="text-xs text-muted-foreground">Fully staffed</span>
                            )}
                            {canCreateShift && (
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => openEditModal(shift)}
                                aria-label="Edit shift"
                                title="Edit shift"
                              >
                                <Pencil size={14} />
                              </Button>
                            )}
                            {canDeleteShift && (
                              <Button
                                variant="outline"
                                size="icon-sm"
                                onClick={() => setDeleteTarget(shift)}
                                aria-label="Delete shift"
                                title="Delete shift"
                                className="border-error/20 text-error hover:bg-error-wash hover:text-error"
                              >
                                <Trash2 size={14} />
                              </Button>
                            )}
                            {!canAssignShift && !canCreateShift && !canDeleteShift && (
                              <span className="text-xs text-muted-foreground">No actions</span>
                            )}
                          </div>
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

      {/* Create / edit shift */}
      <Dialog open={showModal} onOpenChange={(open) => (open ? setShowModal(true) : closeShiftModal())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingShift ? 'Edit shift' : 'Create new shift'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveShift} className="space-y-4">
            {editingShift && hasAttendance(editingShift) && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-wash p-3 text-sm text-warning">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  A guard has already checked in, so the site and times are fixed. You can still change how many
                  guards this shift needs.
                </span>
              </div>
            )}
            {!editingShift && (
              <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Branch" />
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Select site</label>
              <select
                className={selectClass}
                value={newShift.siteId}
                onChange={(e) => setNewShift({ ...newShift, siteId: e.target.value })}
                disabled={Boolean(editingShift && hasAttendance(editingShift))}
                required
              >
                <option value="">Choose a site...</option>
                {/* An edited shift's own site may sit outside the current
                    branch filter, so make sure it is always offered. */}
                {editingShift && !sites.some((site) => site.id === editingShift.siteId) && (
                  <option value={editingShift.siteId}>{editingShift.site?.name ?? 'Current site'}</option>
                )}
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <DateTimeField
                label="Start time"
                value={newShift.startTime}
                onChange={(value) => setNewShift({ ...newShift, startTime: value })}
                disabled={Boolean(editingShift && hasAttendance(editingShift))}
                required
              />
              <DateTimeField
                label="End time"
                value={newShift.endTime}
                onChange={(value) => setNewShift({ ...newShift, endTime: value })}
                min={newShift.startTime || undefined}
                disabled={Boolean(editingShift && hasAttendance(editingShift))}
                error={
                  newShift.startTime &&
                  newShift.endTime &&
                  newShift.endTime <= newShift.startTime
                    ? 'End time must be after the start time.'
                    : undefined
                }
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Required guards</label>
              <Input
                type="number"
                min={editingShift ? Math.max(1, editingShift.assignments?.length ?? 1) : 1}
                value={Number.isNaN(newShift.requiredGuards) ? '' : newShift.requiredGuards}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setNewShift({ ...newShift, requiredGuards: Number.isNaN(val) ? 1 : val });
                }}
                required
              />
              {editingShift && (editingShift.assignments?.length ?? 0) > 0 && (
                <p className="text-xs text-muted-foreground">
                  {editingShift.assignments.length} already assigned. Unassign someone before lowering this.
                </p>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={closeShiftModal}>
                Cancel
              </Button>
              <Button type="submit" disabled={creatingShift}>
                {creatingShift
                  ? editingShift
                    ? 'Saving...'
                    : 'Creating...'
                  : editingShift
                    ? 'Save Changes'
                    : 'Create Shift'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign guard */}
      <Dialog open={showAssignModal} onOpenChange={(o) => (o ? setShowAssignModal(true) : resetAssignModal())}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Assign guard to shift</DialogTitle>
            {selectedShiftRecord && (
              <p className="text-sm text-muted-foreground">
                {selectedShiftRecord.site?.name} &middot; {selectedShiftRecord.assignments.length} of{' '}
                {selectedShiftRecord.requiredGuards} guards assigned
                {selectedShiftRecord.assignments.length > 0 && (
                  <> ({selectedShiftRecord.assignments.map((a) => a.guard.name).join(', ')})</>
                )}
              </p>
            )}
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
              ) : visibleRecommendations.length === 0 ? (
                <div className="rounded-lg border border-border bg-muted px-4 py-5 text-center text-sm text-muted-foreground">
                  No recommended guards. Use manual selection below.
                </div>
              ) : (
                <div className="space-y-3">
                  {visibleRecommendations.slice(0, 5).map((recommendation) => (
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
                {assignableGuards.map((guard) => (
                  <option key={guard.id} value={guard.id}>
                    {guard.name}
                    {guard.canSignIn === false ? ' (no portal password)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {selectedGuardRecord && !selectedGuardRecord.email?.trim() && (
              <div className="rounded-lg border border-border bg-muted p-3 text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">No email on file.</span> {selectedGuardRecord.name} will
                not be emailed about this shift. Tell them directly.
              </div>
            )}

            {selectedGuardRecord?.canSignIn === false && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning-wash p-3 text-sm text-warning">
                <AlertTriangle size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-semibold">{selectedGuardRecord.name} can&apos;t sign in yet.</div>
                  <div className="mt-0.5">
                    They can still be assigned, but won&apos;t be able to check in until a portal password is set on{' '}
                    <Link href="/guards" className="font-semibold underline">
                      their profile
                    </Link>
                    .
                  </div>
                </div>
              </div>
            )}

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
        title={`Unassign ${unassignTarget?.guardName ?? 'guard'}?`}
        description="They will be removed from this shift and the slot will open up again."
        confirmLabel="Unassign"
        destructive
        loading={unassigning}
        onConfirm={handleUnassign}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete this shift?"
        description={
          deleteTarget
            ? `${deleteTarget.site?.name ?? 'This shift'} on ${formatDateTime(deleteTarget.startTime)} will be removed` +
              `${(deleteTarget.assignments?.length ?? 0) > 0 ? ', along with its guard assignments' : ''}. ` +
              'A shift with attendance or timesheets recorded cannot be deleted.'
            : ''
        }
        confirmLabel="Delete"
        destructive
        loading={deleting}
        onConfirm={handleDeleteShift}
      />
    </DashboardLayout>
  );
}
