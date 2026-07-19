/**
 * Offline queue for fault reports — mobile (Expo).
 * When a tenant creates a fault report while offline, it's queued locally
 * and synced when the network reconnects.
 *
 * Uses AsyncStorage (Expo) or localStorage (web) for persistence.
 */

const QUEUE_KEY = 'domovnik_offline_queue';

interface QueuedReport {
  id: string;
  timestamp: string;
  payload: {
    description: string;
    category: string;
    photoUrl?: string;
  };
}

let queue: QueuedReport[] = [];
let isSyncing = false;

async function loadQueue(): Promise<QueuedReport[]> {
  try {
    // In React Native (Expo), use AsyncStorage
    // For web fallback, use localStorage
    const stored = typeof localStorage !== 'undefined'
      ? localStorage.getItem(QUEUE_KEY)
      : null;

    if (stored) {
      queue = JSON.parse(stored);
    }
  } catch {
    queue = [];
  }
  return queue;
}

async function saveQueue(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
    // In Expo: await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Silently fail — data will be retried on next sync
  }
}

/**
 * Enqueue a fault report for later submission.
 */
export async function enqueueReport(report: Omit<QueuedReport, 'id' | 'timestamp'>): Promise<void> {
  await loadQueue();
  queue.push({
    id: crypto.randomUUID?.() ?? Math.random().toString(36).slice(2),
    timestamp: new Date().toISOString(),
    payload: report.payload,
  });
  await saveQueue();
}

/**
 * Sync all queued reports to the server.
 * Called when the network comes back online.
 */
export async function syncQueue(apiBaseUrl: string, authToken: string): Promise<number> {
  if (isSyncing) return 0;
  isSyncing = true;

  await loadQueue();
  let synced = 0;

  for (const item of [...queue]) {
    try {
      const response = await fetch(`${apiBaseUrl}/repair-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify(item.payload),
      });

      if (response.ok) {
        queue = queue.filter((q) => q.id !== item.id);
        synced++;
        await saveQueue();
      }
    } catch {
      // Network error — stop syncing, retry later
      break;
    }
  }

  isSyncing = false;
  return synced;
}

/**
 * Listen for network state changes (Expo).
 * In a real Expo app:
 *   import NetInfo from '@react-native-community/netinfo';
 *   NetInfo.addEventListener(state => { if (state.isConnected) syncQueue(...); });
 */
export function setupAutoSync(apiBaseUrl: string, getToken: () => string): void {
  // Platform-specific network listener would go here
  // For web: window.addEventListener('online', () => syncQueue(apiBaseUrl, getToken()));
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      syncQueue(apiBaseUrl, getToken());
    });
  }
}

export { queue, loadQueue };