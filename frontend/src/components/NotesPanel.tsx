'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  Send,
  Trash2,
  UserCircle,
} from 'lucide-react';
import {
  createNote,
  deleteNote,
  getNotes,
  NoteEntityType,
  NoteItem,
} from '@/lib/notes';

interface NotesPanelProps {
  entityId: string;
  entityType: NoteEntityType;
  title?: string;
}

type Toast = {
  message: string;
  type: 'success' | 'error';
};

export default function NotesPanel({
  entityId,
  entityType,
  title = 'Notes',
}: NotesPanelProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<Toast | null>(null);

  const notePayload = useMemo(
    () =>
      entityType === 'lead'
        ? { leadId: entityId, content: content.trim() }
        : { dealId: entityId, content: content.trim() },
    [content, entityId, entityType],
  );

  const showToast = (message: string, type: Toast['type']) => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    let isMounted = true;

    const loadNotes = async () => {
      setLoading(true);
      try {
        const data = await getNotes(entityType, entityId);
        if (isMounted) setNotes(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load notes', error);
        if (isMounted) showToast('Could not load notes.', 'error');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadNotes();

    return () => {
      isMounted = false;
    };
  }, [entityId, entityType]);

  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!content.trim()) {
      showToast('Write a note before adding it.', 'error');
      return;
    }

    setSaving(true);
    try {
      const note = await createNote(notePayload);
      setNotes((current) => [note, ...current]);
      setContent('');
      showToast('Note added.', 'success');
    } catch (error) {
      console.error('Failed to add note', error);
      showToast('Could not add note.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const previousNotes = notes;
    const noteToDelete = notes.find((note) => note.id === noteId);

    setDeletingIds((current) => new Set(current).add(noteId));
    setNotes((current) => current.filter((note) => note.id !== noteId));

    try {
      await deleteNote(noteId);
      showToast('Note deleted.', 'success');
    } catch (error) {
      console.error('Failed to delete note', error);
      setNotes(previousNotes);
      showToast('Could not delete note.', 'error');
    } finally {
      setDeletingIds((current) => {
        const next = new Set(current);
        next.delete(noteId);
        return next;
      });

      if (!noteToDelete) setNotes(previousNotes);
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getCreatorLabel = (note: NoteItem) => {
    if (!note.createdBy) return 'Unknown admin';
    return note.createdBy.name || note.createdBy.email;
  };

  return (
    <section className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      {toast && (
        <div
          className={`absolute left-4 right-4 top-4 z-10 flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-xl backdrop-blur sm:left-auto sm:right-4 ${
            toast.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
              : 'border-rose-500/20 bg-rose-500/10 text-rose-300'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h3 className="flex items-center gap-2 text-xl font-bold text-white">
            <MessageSquareText className="text-indigo-300" size={20} />
            {title}
          </h3>
          <p className="mt-1 text-sm text-slate-400">
            Capture internal context for this {entityType}.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-slate-400">
          {notes.length} {notes.length === 1 ? 'note' : 'notes'}
        </span>
      </div>

      <form onSubmit={handleAddNote} className="mb-5 space-y-3">
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Add a note..."
          rows={4}
          className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-500/20"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || !content.trim()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
          >
            {saving ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
            <span>{saving ? 'Adding...' : 'Add Note'}</span>
          </button>
        </div>
      </form>

      <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={22} />
            Loading notes...
          </div>
        ) : notes.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-sm text-slate-500">
            No notes yet
          </div>
        ) : (
          notes.map((note) => {
            const isDeleting = deletingIds.has(note.id);

            return (
              <article
                key={note.id}
                className={`rounded-2xl border border-white/10 bg-black/20 p-4 transition ${
                  isDeleting ? 'opacity-50' : 'hover:border-indigo-400/30'
                }`}
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-slate-400">
                    <UserCircle className="text-indigo-300" size={16} />
                    <span className="font-semibold text-slate-300">{getCreatorLabel(note)}</span>
                    <span>•</span>
                    <time>{formatDate(note.createdAt)}</time>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteNote(note.id)}
                    disabled={isDeleting}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-500/10 hover:text-rose-300 disabled:cursor-wait"
                    title="Delete note"
                  >
                    {isDeleting ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  </button>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-200">{note.content}</p>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
