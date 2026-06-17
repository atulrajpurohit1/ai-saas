import api from '@/lib/api';

export interface FollowUpDraft {
  dealId: string;
  dealName: string;
  to: string | null;
  contactName: string;
  company: string;
  subject: string;
  body: string;
  nextActivity: {
    id: string;
    subject: string;
    dueDate: string;
    description: string | null;
  } | null;
}

export async function getDealFollowUpDraft(dealId: string) {
  const res = await api.get<FollowUpDraft>(`sales-delivery/deals/${dealId}/follow-up-draft`);
  return res.data;
}

export async function sendDealFollowUp(dealId: string) {
  const res = await api.post(`sales-delivery/deals/${dealId}/send-follow-up`);
  return res.data;
}

export async function downloadDealCalendar(dealId: string, filename = 'sales-follow-up.ics') {
  const res = await api.get(`sales-delivery/deals/${dealId}/calendar.ics`, {
    responseType: 'blob',
  });
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
