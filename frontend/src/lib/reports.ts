import api from './api';

export type ReportStatus = 'draft' | 'published';

export interface GuardReportSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  assignmentStatus: string;
  attendanceStatus: 'not_started' | 'checked_in' | 'completed';
  checkInTime: string | null;
  checkOutTime: string | null;
  totalWorkedHours: number;
}

export interface ShiftReportSummary {
  id: string;
  status: string;
  startTime: string;
  endTime: string;
  assignedGuards: GuardReportSummary[];
}

export interface IncidentReportSummary {
  id: string;
  title: string;
  description: string;
  severity: string;
  occurredAt: string;
  attachmentUrl: string | null;
  guard: {
    id: string;
    name: string;
  };
  shift: {
    id: string;
    startTime: string;
    endTime: string;
  };
}

export interface DailyReportSummary {
  reportDate: string;
  site: {
    id: string;
    name: string;
    address: string;
    instructions: string | null;
  };
  client: {
    id: string;
    name: string;
    companyName: string | null;
  };
  totals: {
    shifts: number;
    assignedGuards: number;
    completedAttendances: number;
    checkedInAttendances: number;
    missedAttendances: number;
    totalWorkedHours: number;
    approvedIncidents: number;
  };
  shifts: ShiftReportSummary[];
  incidents: IncidentReportSummary[];
}

export interface DailyServiceReport {
  id: string;
  tenantId: string;
  clientId: string;
  siteId: string;
  reportDate: string;
  status: ReportStatus;
  createdAt: string;
  publishedAt: string | null;
  summary: DailyReportSummary | { raw: string };
  client: {
    id: string;
    name: string;
    companyName: string | null;
    email: string;
  } | null;
  site: {
    id: string;
    name: string;
    address: string;
  } | null;
}

export function isDailyReportSummary(summary: DailyServiceReport['summary']): summary is DailyReportSummary {
  return Boolean(summary && 'totals' in summary && 'shifts' in summary && 'incidents' in summary);
}

export async function getAdminReports() {
  const response = await api.get<DailyServiceReport[]>('reports');
  return response.data;
}

export async function getAdminReport(id: string) {
  const response = await api.get<DailyServiceReport>(`reports/${id}`);
  return response.data;
}

export async function generateDailyReport(input: { site_id: string; report_date: string }) {
  const response = await api.post<DailyServiceReport>('reports/generate-daily', input);
  return response.data;
}

export async function publishDailyReport(id: string) {
  const response = await api.post<DailyServiceReport>(`reports/${id}/publish`);
  return response.data;
}

export async function getClientReports() {
  const response = await api.get<DailyServiceReport[]>('client/reports');
  return response.data;
}

export async function getClientReport(id: string) {
  const response = await api.get<DailyServiceReport>(`client/reports/${id}`);
  return response.data;
}
