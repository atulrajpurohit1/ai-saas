import api from './api';

export type TimesheetStatus = 'pending' | 'approved' | 'rejected' | 'corrected';

export interface Timesheet {
  id: string;
  tenantId: string;
  guardId: string;
  shiftId: string;
  siteId: string;
  clientId: string | null;
  checkInTime: string;
  checkOutTime: string;
  totalHours: number;
  status: TimesheetStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  guard: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  shift: {
    id: string;
    startTime: string;
    endTime: string;
    status: string;
  } | null;
  site: {
    id: string;
    name: string;
    address: string;
  } | null;
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
  } | null;
}

export interface CorrectTimesheetInput {
  total_hours: number;
  check_in_time?: string;
  check_out_time?: string;
  correction_reason?: string;
}

export async function getTimesheets(status?: TimesheetStatus) {
  const response = await api.get<Timesheet[]>('timesheets', {
    params: status ? { status } : undefined,
  });
  return response.data;
}

export async function getTimesheet(id: string) {
  const response = await api.get<Timesheet>(`timesheets/${id}`);
  return response.data;
}

export async function approveTimesheet(id: string) {
  const response = await api.post<Timesheet>(`timesheets/${id}/approve`);
  return response.data;
}

export async function rejectTimesheet(id: string, rejectionReason: string) {
  const response = await api.post<Timesheet>(`timesheets/${id}/reject`, {
    rejection_reason: rejectionReason,
  });
  return response.data;
}

export async function correctTimesheet(id: string, input: CorrectTimesheetInput) {
  const response = await api.put<Timesheet>(`timesheets/${id}/correct`, input);
  return response.data;
}
