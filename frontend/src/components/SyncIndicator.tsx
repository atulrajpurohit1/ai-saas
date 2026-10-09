'use client';

import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { OfflineSync, RejectedAction, offlineActionLabel } from '@/lib/offline-sync';

export function SyncIndicator() {
  const { isOnline, syncPending, syncError, triggerSync } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);
  const [rejected, setRejected] = useState<RejectedAction[]>([]);

  const updateCount = () => {
    setPendingCount(OfflineSync.getPendingActions().length);
    setRejected(OfflineSync.getRejectedActions());
  };

  useEffect(() => {
    updateCount();
    window.addEventListener('offline_queue_updated', updateCount);
    return () => window.removeEventListener('offline_queue_updated', updateCount);
  }, []);

  if (pendingCount === 0 && rejected.length === 0 && isOnline) {
    return null; // Hidden when everything is fine
  }

  return (
    <div className="surface-card fixed bottom-4 left-3 right-3 z-50 flex max-w-sm flex-col gap-3 px-4 py-3 text-sm shadow-lg sm:left-auto sm:right-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-success' : 'bg-error'}`} />
            <span className="font-semibold text-foreground">{isOnline ? 'Online' : 'Offline'}</span>
          </div>
          {pendingCount > 0 && (
            <span className="text-muted-foreground">
              {pendingCount} action{pendingCount !== 1 ? 's' : ''} saved offline
            </span>
          )}
          {syncError && <span className="text-error">{syncError}</span>}
          {syncPending && <span className="text-info">Syncing…</span>}
        </div>

        {isOnline && pendingCount > 0 && !syncPending && (
          <button
            onClick={triggerSync}
            className="min-h-9 rounded-[var(--radius-sm)] bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
          >
            Retry Sync
          </button>
        )}
      </div>

      {rejected.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <span className="font-semibold text-error">
            {rejected.length} offline action{rejected.length !== 1 ? 's were' : ' was'} not saved
          </span>
          <ul className="flex flex-col gap-1 text-muted-foreground">
            {rejected.map((action) => (
              <li key={action.id}>
                {offlineActionLabel(action.actionType)} ({new Date(action.createdAt).toLocaleString()}):{' '}
                {action.errorMessage}
              </li>
            ))}
          </ul>
          <span className="text-muted-foreground">Tell your supervisor if any of these still need recording.</span>
          <button
            onClick={() => OfflineSync.clearRejectedActions()}
            className="min-h-9 w-fit rounded-[var(--radius-sm)] border border-border px-3 py-1.5 text-xs font-semibold text-foreground transition hover:bg-muted"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
