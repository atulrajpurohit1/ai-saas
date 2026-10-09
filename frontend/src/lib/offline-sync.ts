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

/** What the server says happened to one action, from POST /guard/sync. */
export interface SyncResult {
  id: string;
  actionType: OfflineActionType;
  // synced / rejected are final. failed / pending / in_progress are retried.
  status: 'synced' | 'rejected' | 'failed' | 'pending' | 'in_progress';
  errorMessage?: string | null;
  createdAt: string;
}

/** An action the server refused for good, kept so the guard can see it. */
export interface RejectedAction {
  id: string;
  actionType: OfflineActionType;
  errorMessage: string;
  createdAt: string;
}

const SYNC_QUEUE_KEY = 'guard_offline_sync_queue';
const REJECTED_KEY = 'guard_offline_sync_rejected';

const ACTION_LABELS: Record<OfflineActionType, string> = {
  check_in: 'Check-in',
  check_out: 'Check-out',
  incident_create: 'Incident report',
  patrol_checkpoint_scan: 'Checkpoint scan',
  patrol_run_complete: 'Patrol completion',
};

export function offlineActionLabel(actionType: OfflineActionType) {
  return ACTION_LABELS[actionType] ?? 'Action';
}

function notifyQueueUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('offline_queue_updated'));
  }
}

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
    notifyQueueUpdated();
  }

  static getRejectedActions(): RejectedAction[] {
    if (typeof window === 'undefined') return [];
    try {
      return JSON.parse(localStorage.getItem(REJECTED_KEY) || '[]');
    } catch {
      return [];
    }
  }

  static addRejectedActions(actions: RejectedAction[]) {
    if (actions.length === 0) return;
    const known = new Set(this.getRejectedActions().map((a) => a.id));
    const merged = [...this.getRejectedActions(), ...actions.filter((a) => !known.has(a.id))];
    localStorage.setItem(REJECTED_KEY, JSON.stringify(merged));
    notifyQueueUpdated();
  }

  static clearRejectedActions() {
    localStorage.removeItem(REJECTED_KEY);
    notifyQueueUpdated();
  }
}
