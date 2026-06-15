'use client';

import React, { useEffect, useState } from 'react';
import { useNetwork } from '@/context/NetworkContext';
import { OfflineSync } from '@/lib/offline-sync';

export function SyncIndicator() {
  const { isOnline, syncPending, syncError, triggerSync } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);

  const updateCount = () => {
    setPendingCount(OfflineSync.getPendingActions().length);
  };

  useEffect(() => {
    updateCount();
    window.addEventListener('offline_queue_updated', updateCount);
    return () => window.removeEventListener('offline_queue_updated', updateCount);
  }, []);

  if (pendingCount === 0 && isOnline) {
    return null; // Hidden when everything is fine
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-gray-900 text-white px-4 py-3 rounded-lg shadow-xl flex items-center gap-4 text-sm max-w-sm">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
        </div>
        {pendingCount > 0 && (
          <span className="text-gray-300">
            {pendingCount} action{pendingCount !== 1 ? 's' : ''} saved offline
          </span>
        )}
        {syncError && <span className="text-red-400">{syncError}</span>}
        {syncPending && <span className="text-blue-400">Syncing...</span>}
      </div>
      
      {isOnline && pendingCount > 0 && !syncPending && (
        <button
          onClick={triggerSync}
          className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-xs transition-colors"
        >
          Retry Sync
        </button>
      )}
    </div>
  );
}
