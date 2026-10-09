'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { OfflineSync, SyncResult } from '@/lib/offline-sync';

interface NetworkContextProps {
  isOnline: boolean;
  syncPending: boolean;
  syncError: string | null;
  triggerSync: () => Promise<void>;
}

const NetworkContext = createContext<NetworkContextProps>({
  isOnline: true,
  syncPending: false,
  syncError: null,
  triggerSync: async () => {},
});

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(true);
  const [syncPending, setSyncPending] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const triggerSync = async () => {
    if (!navigator.onLine) return;

    const pendingActions = OfflineSync.getPendingActions();
    if (pendingActions.length === 0) return;

    setSyncPending(true);
    setSyncError(null);

    try {
      const response = await api.post<SyncResult[]>('/guard/sync', { actions: pendingActions });
      const results = response.data;

      // Only drop actions the server is finished with. A failed one stays
      // queued so the next sync retries it.
      const finished = results.filter((r) => r.status === 'synced' || r.status === 'rejected');
      OfflineSync.removeActions(finished.map((r) => r.id));

      // Refused for good: tell the guard rather than losing it silently.
      OfflineSync.addRejectedActions(
        results
          .filter((r) => r.status === 'rejected')
          .map((r) => ({
            id: r.id,
            actionType: r.actionType,
            errorMessage: r.errorMessage || 'Rejected by the server',
            createdAt: r.createdAt,
          })),
      );

      const unfinished = results.length - finished.length;
      if (unfinished > 0) {
        setSyncError(
          `${unfinished} action${unfinished !== 1 ? 's' : ''} couldn't be saved yet. Tap Retry Sync to try again.`,
        );
      }
    } catch (error: any) {
      console.error('Failed to sync offline actions', error);
      setSyncError('Sync failed. Please try again later.');
    } finally {
      setSyncPending(false);
    }
  };

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => {
      setIsOnline(true);
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, syncPending, syncError, triggerSync }}>
      {children}
    </NetworkContext.Provider>
  );
};
