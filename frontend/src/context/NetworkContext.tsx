'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '@/lib/api';
import { OfflineSync } from '@/lib/offline-sync';

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

  const triggerSync = async () => {
    if (!navigator.onLine) return;

    const pendingActions = OfflineSync.getPendingActions();
    if (pendingActions.length === 0) return;

    setSyncPending(true);
    setSyncError(null);

    try {
      const response = await api.post('/guard/sync', { actions: pendingActions });
      const syncedIds = response.data.map((r: any) => r.id);
      OfflineSync.removeActions(syncedIds);
    } catch (error: any) {
      console.error('Failed to sync offline actions', error);
      setSyncError('Sync failed. Please try again later.');
    } finally {
      setSyncPending(false);
    }
  };

  return (
    <NetworkContext.Provider value={{ isOnline, syncPending, syncError, triggerSync }}>
      {children}
    </NetworkContext.Provider>
  );
};
