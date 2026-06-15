export type OfflineActionType =
  | 'check_in'
  | 'check_out'
  | 'incident_create'
  | 'patrol_checkpoint_scan'
  | 'patrol_run_complete';

export interface OfflineAction {
  id: string;
  actionType: OfflineActionType;
  payload: Record<string, any>;
  createdAt: string;
}

const SYNC_QUEUE_KEY = 'guard_offline_sync_queue';

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class OfflineSync {
  static getPendingActions(): OfflineAction[] {
    if (typeof window === 'undefined') return [];
    const queueStr = localStorage.getItem(SYNC_QUEUE_KEY);
    if (!queueStr) return [];
    try {
      return JSON.parse(queueStr);
    } catch (e) {
      console.error('Failed to parse offline sync queue', e);
      return [];
    }
  }

  static enqueueAction(actionType: OfflineActionType, payload: Record<string, any>): OfflineAction {
    const queue = this.getPendingActions();
    const action: OfflineAction = {
      id: createId(),
      actionType,
      payload,
      createdAt: new Date().toISOString(),
    };
    queue.push(action);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
    
    // Dispatch custom event to notify UI
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_queue_updated'));
    }
    
    return action;
  }

  static removeActions(actionIds: string[]) {
    const queue = this.getPendingActions();
    const updatedQueue = queue.filter(a => !actionIds.includes(a.id));
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(updatedQueue));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_queue_updated'));
    }
  }

  static clearQueue() {
    localStorage.removeItem(SYNC_QUEUE_KEY);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('offline_queue_updated'));
    }
  }
}
