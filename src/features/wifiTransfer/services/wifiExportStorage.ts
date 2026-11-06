import type { IPendingSignboardZip } from "../types/wifiTransfer";

const DB_NAME = "navitronix_offline_export";
const STORE_NAME = "pending_transfer";
const RECORD_KEY = "current_package";
const DB_VERSION = 1;

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error || new Error("Failed to open IndexedDB"));
    };
  });
}

/**
 * Saves or replaces the pending ZIP export in IndexedDB.
 * Enforces single package retention by always using the key 'current_package'.
 */
export async function savePendingExport(
  data: Omit<IPendingSignboardZip, "id">
): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    const record: IPendingSignboardZip = {
      ...data,
      id: RECORD_KEY,
    };

    const putRequest = store.put(record);

    putRequest.onsuccess = () => {
      resolve();
    };

    putRequest.onerror = () => {
      reject(putRequest.error || new Error("Failed to save pending export to IndexedDB"));
    };

    tx.oncomplete = () => {
      db.close();
    };
  });
}

/**
 * Retrieves the current pending ZIP export and its metadata, or null if none exists.
 */
export async function getPendingExport(): Promise<IPendingSignboardZip | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const getRequest = store.get(RECORD_KEY);

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => {
        reject(getRequest.error || new Error("Failed to get pending export from IndexedDB"));
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    return null;
  }
}

/**
 * Clears the pending export record from IndexedDB (called after successful upload or manual discard).
 */
export async function clearPendingExport(): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const delRequest = store.delete(RECORD_KEY);

      delRequest.onsuccess = () => {
        resolve();
      };

      delRequest.onerror = () => {
        reject(delRequest.error || new Error("Failed to clear pending export from IndexedDB"));
      };

      tx.oncomplete = () => {
        db.close();
      };
    });
  } catch {
    // Ignore errors on clear if DB was not initialized
  }
}

/**
 * Quick boolean check to see if an export ZIP is currently available in IndexedDB.
 */
export async function hasPendingExport(): Promise<boolean> {
  const item = await getPendingExport();
  return item !== null;
}

