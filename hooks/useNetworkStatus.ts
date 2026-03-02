import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook to track online/offline status.
 * Returns { isOnline, isSyncing, syncResult } and triggers
 * a callback when transitioning from offline → online.
 */

export interface SyncResult {
    processed: number;
    failed: number;
    errors: string[];
}

interface UseNetworkStatusOptions {
    onReconnect?: () => Promise<SyncResult | void>;
}

export function useNetworkStatus(options?: UseNetworkStatusOptions) {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
    const wasOffline = useRef(!navigator.onLine);

    const handleOnline = useCallback(async () => {
        setIsOnline(true);

        // Only trigger sync if we were previously offline
        if (wasOffline.current && options?.onReconnect) {
            setIsSyncing(true);
            setSyncResult(null);
            try {
                const result = await options.onReconnect();
                if (result) setSyncResult(result);
            } catch (err) {
                console.error('Sync on reconnect failed:', err);
            } finally {
                setIsSyncing(false);
            }
        }
        wasOffline.current = false;
    }, [options?.onReconnect]);

    const handleOffline = useCallback(() => {
        setIsOnline(false);
        wasOffline.current = true;
    }, []);

    useEffect(() => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [handleOnline, handleOffline]);

    const dismissSyncResult = useCallback(() => setSyncResult(null), []);

    return { isOnline, isSyncing, syncResult, dismissSyncResult };
}
