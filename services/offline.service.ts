/**
 * Offline Data Layer — IndexedDB wrapper for local-first storage.
 * Stores: transactions, debts, debt_payments, gift_records, sync_queue, auth_cache
 */

const DB_NAME = 'imoney_offline';
const DB_VERSION = 3;

const STORES = [
    'transactions',
    'debts',
    'debt_payments',
    'gift_records',
    'budgets',
    'sync_queue',
    'auth_cache',
] as const;

export type StoreName = (typeof STORES)[number];

let dbInstance: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
    if (dbInstance) return Promise.resolve(dbInstance);

    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            for (const store of STORES) {
                if (!db.objectStoreNames.contains(store)) {
                    db.createObjectStore(store, { keyPath: 'id' });
                }
            }
        };

        request.onsuccess = () => {
            dbInstance = request.result;

            // Reset instance on close so we reopen next time
            dbInstance.onclose = () => { dbInstance = null; };
            resolve(dbInstance);
        };

        request.onerror = () => reject(request.error);
    });
}

// ------- Generic CRUD helpers -------

export async function getAll<T>(store: StoreName): Promise<T[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result as T[]);
        req.onerror = () => reject(req.error);
    });
}

export async function getById<T>(store: StoreName, id: string): Promise<T | undefined> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly');
        const req = tx.objectStore(store).get(id);
        req.onsuccess = () => resolve(req.result as T | undefined);
        req.onerror = () => reject(req.error);
    });
}

export async function put<T extends { id: string }>(store: StoreName, data: T): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).put(data);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function putAll<T extends { id: string }>(store: StoreName, items: T[]): Promise<void> {
    if (items.length === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        const objectStore = tx.objectStore(store);
        for (const item of items) {
            objectStore.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function deleteById(store: StoreName, id: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

export async function clearStore(store: StoreName): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite');
        tx.objectStore(store).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// ------- Auth cache helpers -------

const AUTH_KEY = 'cached_session';

export interface CachedAuth {
    id: string; // always AUTH_KEY
    userId: string;
    email: string;
    fullName: string;
    accessToken: string;
    refreshToken: string;
    cachedAt: number;
}

export async function cacheAuthSession(user: {
    id: string;
    email?: string;
    user_metadata?: { full_name?: string };
}, session: { access_token: string; refresh_token: string }): Promise<void> {
    const data: CachedAuth = {
        id: AUTH_KEY,
        userId: user.id,
        email: user.email || '',
        fullName: user.user_metadata?.full_name || '',
        accessToken: session.access_token,
        refreshToken: session.refresh_token,
        cachedAt: Date.now(),
    };
    await put('auth_cache', data);
}

export async function getCachedAuth(): Promise<CachedAuth | undefined> {
    return getById<CachedAuth>('auth_cache', AUTH_KEY);
}

export async function clearCachedAuth(): Promise<void> {
    await deleteById('auth_cache', AUTH_KEY);
}
