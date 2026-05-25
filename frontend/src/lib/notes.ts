import api from './api';

export type NoteEntityType = 'lead' | 'deal';

export interface NoteCreator {
  id: string;
  name: string | null;
  email: string;
}

export interface NoteItem {
  id: string;
  content: string;
  leadId: string | null;
  dealId: string | null;
  createdAt: string;
  createdBy: NoteCreator | null;
}

export async function getNotes(type: NoteEntityType, entityId: string) {
  const response = await api.get<NoteItem[]>('notes', {
    params: { type, entityId },
  });

  return response.data;
}

export async function createNote(input: {
  content: string;
  leadId?: string;
  dealId?: string;
}) {
  const response = await api.post<NoteItem>('notes', input);
  return response.data;
}

export async function deleteNote(id: string) {
  await api.delete(`notes/${id}`);
}
