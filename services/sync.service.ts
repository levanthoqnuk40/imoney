/**
 * Sync Queue Service — manages offline operations queue
 * and synchronises them to Supabase when online.
 */

import { supabase, StorageService } from './supabase.service';
import * as OfflineDB from './offline.service';
import { SyncPayload } from '../types';

export type SyncQueueItem = {
    id: string;
    timestamp: number;
    retryCount: number;
    pendingReceiptBase64?: string;
    pendingReceiptFileName?: string;
} & SyncPayload;

const MAX_RETRIES = 3;

// ------- Queue operations -------

export async function addToQueue(
    item: SyncPayload & { pendingReceiptBase64?: string; pendingReceiptFileName?: string },
): Promise<void> {
    const queueItem: SyncQueueItem = {
        ...item,
        id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
    } as SyncQueueItem;
    await OfflineDB.put('sync_queue', queueItem);
}

export async function getPendingCount(): Promise<number> {
    const items = await OfflineDB.getAll<SyncQueueItem>('sync_queue');
    return items.length;
}

export async function getPendingItems(): Promise<SyncQueueItem[]> {
    const items = await OfflineDB.getAll<SyncQueueItem>('sync_queue');
    return items.sort((a, b) => a.timestamp - b.timestamp);
}

// ------- Process queue -------

export interface SyncResult {
    processed: number;
    failed: number;
    errors: string[];
}

export async function processQueue(): Promise<SyncResult> {
    const items = await getPendingItems();
    const result: SyncResult = { processed: 0, failed: 0, errors: [] };

    for (const item of items) {
        try {
            await processSingleItem(item);
            // Remove from queue on success
            await OfflineDB.deleteById('sync_queue', item.id);
            result.processed++;
        } catch (error: any) {
            item.retryCount++;
            if (item.retryCount >= MAX_RETRIES) {
                // Give up — keep in queue but log the error
                result.errors.push(`[${item.table}/${item.action}] ${error.message}`);
                result.failed++;
                // Update retry count in queue
                await OfflineDB.put('sync_queue', item);
            } else {
                // Will retry next time
                await OfflineDB.put('sync_queue', item);
                result.failed++;
            }
        }
    }

    return result;
}

async function processSingleItem(item: SyncQueueItem): Promise<void> {
    const { table, action, data } = item;

    if (action === 'INSERT') {
        const insertData = { ...data } as any;

        // Handle pending receipt upload
        if (item.pendingReceiptBase64 && item.pendingReceiptFileName) {
            try {
                const blob = base64ToBlob(item.pendingReceiptBase64);
                const file = new File([blob], item.pendingReceiptFileName, { type: blob.type });
                const url = await StorageService.uploadReceipt(file);
                if (url) {
                    insertData.receipt_url = url;
                }
            } catch {
                console.warn('Failed to upload queued receipt, inserting without it');
            }
        }

        // Remove client-side temp id — Supabase will generate one
        if ('_tempId' in insertData) {
            delete insertData._tempId;
        }

        const { error } = await supabase.from(table).insert([insertData]);
        if (error) throw error;
    } else if (action === 'UPDATE') {
        const updateData = data as any;
        const { id: recordId, user_id, ...updateFields } = updateData;
        const query = supabase.from(table).update(updateFields).eq('id', recordId);
        if (user_id) query.eq('user_id', user_id);
        const { error } = await query;
        if (error) throw error;
    } else if (action === 'DELETE') {
        const deleteData = data as any;
        let query = supabase.from(table).delete();
        if (deleteData.id) {
            query = query.eq('id', deleteData.id);
        }
        if (deleteData.user_id) {
            query = query.eq('user_id', deleteData.user_id);
        }
        const { error } = await query;
        if (error && !error.message.includes('not found')) throw error;
    }
}

// ------- Helpers -------

function base64ToBlob(base64: string): Blob {
    // base64 can be "data:image/jpeg;base64,xxxxx" or raw
    const parts = base64.split(',');
    const mime = parts.length > 1 ? parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg' : 'image/jpeg';
    const raw = atob(parts.length > 1 ? parts[1] : parts[0]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return new Blob([arr], { type: mime });
}
