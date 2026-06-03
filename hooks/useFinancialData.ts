import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import {
  Transaction,
  Budget,
  Category,
  Debt,
  GiftRecord,
  AIAdvice,
  GiftDirection,
  GiftEventType,
  DebtType,
  SyncPayload,
  ExpenseEvent,
  ExpenseParticipant,
  ExpenseSplit,
  Repayment,
  ExpenseEventStatus
} from '../types';
import { supabase } from '../services/supabase.service';
import * as OfflineDB from '../services/offline.service';
import * as SyncService from '../services/sync.service';
import * as NotificationService from '../services/notification.service';
import { NotificationAlert } from '../services/notification.service';
import { useNetworkStatus } from './useNetworkStatus';
import { autoCategorize, getCategories, saveCategories, DEFAULT_CATEGORIES } from '../constants';
import { getFinancialAdvice } from '../services/geminiService';

const generateUUID = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function useFinancialData(user: User | null) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => getCategories());
  const [debts, setDebts] = useState<Debt[]>([]);
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [expenseEvents, setExpenseEvents] = useState<ExpenseEvent[]>([]);
  const [expenseParticipants, setExpenseParticipants] = useState<ExpenseParticipant[]>([]);
  const [expenseSplits, setExpenseSplits] = useState<ExpenseSplit[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AI Insights State
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Pending sync count for UI badge
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Refs to hold latest load functions (avoids circular deps in network reconnect effect)
  const loadTransactionsRef = useRef<(() => Promise<void>) | null>(null);
  const loadDebtsRef = useRef<(() => Promise<void>) | null>(null);
  const loadGiftsRef = useRef<(() => Promise<void>) | null>(null);
  const loadBudgetsRef = useRef<(() => Promise<void>) | null>(null);
  const loadCategoriesRef = useRef<(() => Promise<void>) | null>(null);
  const loadExpenseDataRef = useRef<(() => Promise<void>) | null>(null);

  // Refresh pending count helper
  const refreshPendingCount = useCallback(async () => {
    const count = await SyncService.getPendingCount();
    setPendingSyncCount(count);
  }, []);

  // A helper to merge remote data with local items currently in the sync queue
  const getMergedLocalAndRemote = useCallback(async <T extends { id: string }>(
    tableName: string,
    remoteItems: T[]
  ): Promise<T[]> => {
    try {
      const pendingItems = await SyncService.getPendingItems();
      const pendingIds = new Set(
        pendingItems
          .filter(item => item.table === tableName && (item.action === 'INSERT' || item.action === 'UPDATE'))
          .map(item => item.data.id)
      );

      if (pendingIds.size === 0) {
        return remoteItems;
      }

      const localItems = await OfflineDB.getAll<T>(tableName as any);
      const unsyncedItems = localItems.filter(item => pendingIds.has(item.id));
      
      const remoteIds = new Set(remoteItems.map(item => item.id));
      return [
        ...remoteItems,
        ...unsyncedItems.filter(item => !remoteIds.has(item.id))
      ];
    } catch (err) {
      console.warn(`Failed to merge local and remote for table ${tableName}:`, err);
      return remoteItems;
    }
  }, []);

  // Process queue and show UI alert if there are sync errors
  const processQueueAndLog = useCallback(async (context: string) => {
    try {
      const result = await SyncService.processQueue();
      if (result && result.errors && result.errors.length > 0) {
        console.error(`[Sync Queue Errors - ${context}]:`, result.errors);
        alert(`Lỗi đồng bộ dữ liệu (${context}):\n${result.errors.join('\n')}`);
      }
      return result;
    } catch (err) {
      console.error(`Failed to process sync queue during ${context}:`, err);
    }
  }, []);

  // Sync handler: process queue + reload all data
  const handleSync = useCallback(async () => {
    const result = await SyncService.processQueue();
    if (result && result.errors && result.errors.length > 0) {
      console.error('[Sync Queue Errors - handleSync]:', result.errors);
      alert(`Lỗi đồng bộ dữ liệu (Đồng bộ tự động/thủ công):\n${result.errors.join('\n')}`);
    }
    if (user) {
      await Promise.all([
        loadTransactionsRef.current?.(),
        loadDebtsRef.current?.(),
        loadGiftsRef.current?.(),
        loadBudgetsRef.current?.(),
      ]);
    }
    await refreshPendingCount();
    return result;
  }, [user, refreshPendingCount]);

  // Network status hook
  const { isOnline, isSyncing, syncResult, dismissSyncResult } = useNetworkStatus({
    onReconnect: handleSync,
  });

  // Helper to run auto-categorization on a list of transactions
  const autoCategorizeTransactions = useCallback(async (rawTxList: Transaction[], updateDb: boolean) => {
    if (rawTxList.length === 0) return [];
    
    const dbUpdates: { id: string; category: string }[] = [];

    const processed = await Promise.all(rawTxList.map(async t => {
      let category = t.category;
      if (category === 'Chuyển khoản đi' || category === 'Chuyển khoản nhận' || category === 'Khác') {
        const autoCat = autoCategorize(t.description, categories);
        if (autoCat && autoCat.type === t.type) {
          category = autoCat.category;
          if (updateDb && !t.id.startsWith('temp_')) {
            dbUpdates.push({ id: t.id, category });
            OfflineDB.put('transactions', { ...t, category }).then();
          }
        }
      }
      return { ...t, category };
    }));

    if (dbUpdates.length > 0 && navigator.onLine) {
      (async () => {
        for (const item of dbUpdates) {
          try {
            await supabase.from('transactions').update({ category: item.category }).eq('id', item.id);
            await new Promise(resolve => setTimeout(resolve, 150)); // 150ms throttle delay
          } catch (err) {
            console.error('Error auto-updating category in background DB:', err);
          }
        }
      })();
    }

    return processed;
  }, [categories]);

  // Load transactions — online: fetch from Supabase + cache; offline: read IndexedDB
  const loadTransactions = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('user_id', user.id)
          .order('transaction_date', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedTransactions: Transaction[] = (data || []).map(t => ({
          id: t.id,
          amount: parseFloat(t.amount),
          category: t.category || 'Khác',
          description: t.description || '',
          date: t.transaction_date,
          type: t.type === 'income' ? 'INCOME' : 'EXPENSE',
          receipt_url: t.receipt_url || undefined
        }));

        const processed = await autoCategorizeTransactions(mappedTransactions, true);
        const merged = await getMergedLocalAndRemote('transactions', processed);
        setTransactions(merged);
        await OfflineDB.clearStore('transactions');
        await OfflineDB.putAll('transactions', merged);
      } else {
        const cached = await OfflineDB.getAll<Transaction>('transactions');
        cached.sort((a, b) => b.date.localeCompare(a.date));
        const processed = await autoCategorizeTransactions(cached, false);
        setTransactions(processed);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      const cached = await OfflineDB.getAll<Transaction>('transactions');
      cached.sort((a, b) => b.date.localeCompare(a.date));
      const processed = await autoCategorizeTransactions(cached, false);
      setTransactions(processed);
    } finally {
      setIsLoading(false);
    }
  }, [user, autoCategorizeTransactions]);

  loadTransactionsRef.current = loadTransactions;

  // Load categories from Supabase (or fallback to IndexedDB / localStorage)
  const loadCategories = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        if (data && data.length > 0) {
          const fetchedCategories: Category[] = data.map(c => ({
            id: c.id,
            name: c.name,
            icon: c.icon,
            type: c.type as 'INCOME' | 'EXPENSE',
            keywords: c.keywords || []
          }));
          setCategories(fetchedCategories);
          saveCategories(fetchedCategories);
          await OfflineDB.clearStore('categories');
          await OfflineDB.putAll('categories', fetchedCategories);
          return;
        } else {
          // If no categories in Supabase (new user), upload default categories
          const { error: insertError } = await supabase
            .from('categories')
            .insert(
              DEFAULT_CATEGORIES.map(c => ({
                id: c.id,
                user_id: user.id,
                name: c.name,
                icon: c.icon,
                type: c.type,
                keywords: c.keywords
              }))
            );
          if (insertError) {
            console.error('Failed to upload default categories:', insertError);
          }
          setCategories(DEFAULT_CATEGORIES);
          saveCategories(DEFAULT_CATEGORIES);
          await OfflineDB.clearStore('categories');
          await OfflineDB.putAll('categories', DEFAULT_CATEGORIES);
          return;
        }
      }

      const cached = await OfflineDB.getAll<Category>('categories');
      if (cached && cached.length > 0) {
        setCategories(cached);
        saveCategories(cached);
      } else {
        setCategories(DEFAULT_CATEGORIES);
        saveCategories(DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      const cached = await OfflineDB.getAll<Category>('categories');
      if (cached && cached.length > 0) {
        setCategories(cached);
        saveCategories(cached);
      } else {
        const localSaved = getCategories();
        setCategories(localSaved);
      }
    }
  }, [user]);

  loadCategoriesRef.current = loadCategories;

  // Handle categories changes (add/edit/delete) with cascade updates for renames
  const handleCategoriesChange = useCallback(async (newCategories: Category[], renameMap?: { oldName: string; newName: string }) => {
    setCategories(newCategories);
    saveCategories(newCategories);

    if (user) {
      const addedOrUpdated = newCategories.filter(nc => {
        const old = categories.find(oc => oc.id === nc.id);
        return !old || old.name !== nc.name || old.icon !== nc.icon || JSON.stringify(old.keywords) !== JSON.stringify(nc.keywords);
      });

      const deleted = categories.filter(oc => !newCategories.some(nc => nc.id === oc.id));

      // Process added or updated items
      for (const item of addedOrUpdated) {
        const isNew = !categories.some(oc => oc.id === item.id);
        const action = isNew ? 'INSERT' : 'UPDATE';

        await OfflineDB.put('categories', item);

        const payload: SyncPayload = {
          table: 'categories',
          action: isNew ? 'INSERT' : 'UPDATE',
          data: {
            id: item.id,
            user_id: user.id,
            name: item.name,
            icon: item.icon,
            type: item.type,
            keywords: item.keywords
          }
        };

        if (navigator.onLine) {
          try {
            if (isNew) {
              const { error } = await supabase.from('categories').insert([payload.data]);
              if (error) throw error;
            } else {
              const { error } = await supabase
                .from('categories')
                .update({ name: item.name, icon: item.icon, type: item.type, keywords: item.keywords })
                .eq('id', item.id)
                .eq('user_id', user.id);
              if (error) throw error;
            }
          } catch (err) {
            console.error(`Failed to online sync category ${action}, queuing:`, err);
            await SyncService.addToQueue(payload);
            await refreshPendingCount();
          }
        } else {
          await SyncService.addToQueue(payload);
          await refreshPendingCount();
        }
      }

      // Process deleted items
      for (const item of deleted) {
        await OfflineDB.deleteById('categories', item.id);

        const payload: SyncPayload = {
          table: 'categories',
          action: 'DELETE',
          data: { id: item.id, user_id: user.id }
        };

        if (navigator.onLine) {
          try {
            const { error } = await supabase
              .from('categories')
              .delete()
              .eq('id', item.id)
              .eq('user_id', user.id);
            if (error) throw error;
          } catch (err) {
            console.error('Failed to online delete category, queuing:', err);
            await SyncService.addToQueue(payload);
            await refreshPendingCount();
          }
        } else {
          await SyncService.addToQueue(payload);
          await refreshPendingCount();
        }
      }
    }

    // Cascade update transaction and budget categories if renamed
    if (renameMap && user) {
      const { oldName, newName } = renameMap;

      setTransactions(prev => prev.map(t => 
        t.category === oldName ? { ...t, category: newName } : t
      ));

      try {
        const cachedTxs = await OfflineDB.getAll<Transaction>('transactions');
        const updatedCachedTxs = cachedTxs.map(t => 
          t.category === oldName ? { ...t, category: newName } : t
        );
        await OfflineDB.clearStore('transactions');
        await OfflineDB.putAll('transactions', updatedCachedTxs);

        if (navigator.onLine) {
          const { error } = await supabase
            .from('transactions')
            .update({ category: newName })
            .eq('category', oldName)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          const affected = cachedTxs.filter(t => t.category === oldName);
          for (const tx of affected) {
            await SyncService.addToQueue({
              table: 'transactions',
              action: 'UPDATE',
              data: { id: tx.id, user_id: user.id, category: newName }
            });
          }
          await refreshPendingCount();
        }
      } catch (err) {
        console.error('Failed to cascade update transaction categories:', err);
      }

      setBudgets(prev => prev.map(b => 
        b.category === oldName ? { ...b, category: newName } : b
      ));

      try {
        const cachedBudgets = await OfflineDB.getAll<Budget>('budgets');
        const updatedCachedBudgets = cachedBudgets.map(b => 
          b.category === oldName ? { ...b, category: newName } : b
        );
        await OfflineDB.clearStore('budgets');
        await OfflineDB.putAll('budgets', updatedCachedBudgets);

        if (navigator.onLine) {
          const { error } = await supabase
            .from('budgets')
            .update({ category: newName })
            .eq('category', oldName)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          const affected = cachedBudgets.filter(b => b.category === oldName);
          for (const b of affected) {
            await SyncService.addToQueue({
              table: 'budgets',
              action: 'UPDATE',
              data: { id: b.id, user_id: user.id, category: newName }
            });
          }
          await refreshPendingCount();
        }
      } catch (err) {
        console.error('Failed to cascade update budget categories:', err);
      }
    }
  }, [user, categories, refreshPendingCount]);

  // Load budgets — online: Supabase + cache; offline: IndexedDB
  const loadBudgets = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('budgets')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        const mapped: Budget[] = (data || []).map(b => ({
          id: b.id,
          category: b.category,
          limit: parseFloat(b.budget_limit),
          period: b.period || 'monthly',
        }));

        const merged = await getMergedLocalAndRemote('budgets', mapped);
        setBudgets(merged);
        await OfflineDB.clearStore('budgets');
        await OfflineDB.putAll('budgets', merged);
      } else {
        const cached = await OfflineDB.getAll<Budget>('budgets');
        setBudgets(cached);
      }
    } catch (error) {
      console.error('Error loading budgets:', error);
      const cached = await OfflineDB.getAll<Budget>('budgets');
      setBudgets(cached);
    }
  }, [user]);

  loadBudgetsRef.current = loadBudgets;

  // Load debts — online: Supabase + cache; offline: IndexedDB
  const loadDebts = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('debts')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        const mappedDebts: Debt[] = (data || []).map(d => ({
          id: d.id,
          user_id: d.user_id,
          type: d.type as DebtType,
          person_name: d.person_name,
          original_amount: parseFloat(d.original_amount),
          paid_amount: parseFloat(d.paid_amount || 0),
          remaining_amount: parseFloat(d.original_amount) - parseFloat(d.paid_amount || 0),
          created_date: d.created_date,
          due_date: d.due_date || undefined,
          description: d.description || undefined,
          status: d.status as 'pending' | 'partial' | 'completed'
        }));

        const merged = await getMergedLocalAndRemote('debts', mappedDebts);
        setDebts(merged);
        await OfflineDB.clearStore('debts');
        await OfflineDB.putAll('debts', merged);
      } else {
        const cached = await OfflineDB.getAll<Debt>('debts');
        setDebts(cached);
      }
    } catch (error) {
      console.error('Error loading debts:', error);
      const cached = await OfflineDB.getAll<Debt>('debts');
      setDebts(cached);
    }
  }, [user]);

  loadDebtsRef.current = loadDebts;

  // Load gifts — online: Supabase + cache; offline: IndexedDB
  const loadGifts = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data, error } = await supabase
          .from('gift_records')
          .select('*')
          .eq('user_id', user.id)
          .order('event_date', { ascending: false });

        if (error) throw error;

        const mappedGifts: GiftRecord[] = (data || []).map(g => ({
          id: g.id,
          user_id: g.user_id,
          direction: g.direction as GiftDirection,
          person_name: g.person_name,
          event_type: g.event_type as GiftEventType,
          amount: parseFloat(g.amount),
          event_date: g.event_date,
          note: g.note || undefined
        }));

        const merged = await getMergedLocalAndRemote('gift_records', mappedGifts);
        setGifts(merged);
        await OfflineDB.clearStore('gift_records');
        await OfflineDB.putAll('gift_records', merged);
      } else {
        const cached = await OfflineDB.getAll<GiftRecord>('gift_records');
        setGifts(cached);
      }
    } catch (error) {
      console.error('Error loading gifts:', error);
      const cached = await OfflineDB.getAll<GiftRecord>('gift_records');
      setGifts(cached);
    }
  }, [user]);

  loadGiftsRef.current = loadGifts;

  // Load expense events, participants, splits, repayments — local first, sync online
  const loadExpenseData = useCallback(async () => {
    if (!user) return;

    try {
      if (navigator.onLine) {
        const { data: eventsData, error: eventsErr } = await supabase
          .from('expense_events')
          .select('*')
          .eq('user_id', user.id)
          .order('event_date', { ascending: false });

        if (eventsErr) throw eventsErr;

        const mappedEvents: ExpenseEvent[] = (eventsData || []).map(e => ({
          id: e.id,
          user_id: e.user_id,
          title: e.title,
          event_date: e.event_date,
          total_amount: parseFloat(e.total_amount),
          split_method: e.split_method as 'equal' | 'custom',
          due_date: e.due_date || undefined,
          description: e.description || undefined,
          status: e.status as 'open' | 'partial' | 'settled',
          transaction_id: e.transaction_id || undefined,
          receipt_url: e.receipt_url || undefined,
        }));

        const eventIds = mappedEvents.map(e => e.id);
        let mappedParticipants: ExpenseParticipant[] = [];
        let mappedSplits: ExpenseSplit[] = [];
        let mappedRepayments: Repayment[] = [];

        if (eventIds.length > 0) {
          const { data: pData, error: pErr } = await supabase
            .from('expense_participants')
            .select('*')
            .in('event_id', eventIds);
          if (pErr) throw pErr;

          mappedParticipants = (pData || []).map(p => ({
            id: p.id,
            event_id: p.event_id,
            display_name: p.display_name,
            phone_number: p.phone_number || undefined,
            is_owner: p.is_owner,
            note: p.note || undefined,
          }));

          const { data: sData, error: sErr } = await supabase
            .from('expense_splits')
            .select('*')
            .in('event_id', eventIds);
          if (sErr) throw sErr;

          mappedSplits = (sData || []).map(s => ({
            id: s.id,
            event_id: s.event_id,
            participant_id: s.participant_id,
            amount_due: parseFloat(s.amount_due),
            note: s.note || undefined,
          }));

          const { data: rData, error: rErr } = await supabase
            .from('repayments')
            .select('*')
            .in('event_id', eventIds)
            .order('repayment_date', { ascending: false });
          if (rErr) throw rErr;

          mappedRepayments = (rData || []).map(r => ({
            id: r.id,
            event_id: r.event_id,
            participant_id: r.participant_id,
            repayment_date: r.repayment_date,
            amount: parseFloat(r.amount),
            payment_method: r.payment_method || undefined,
            reference_no: r.reference_no || undefined,
            note: r.note || undefined,
          }));
        }

        const mergedEvents = await getMergedLocalAndRemote('expense_events', mappedEvents);
        const mergedParticipants = await getMergedLocalAndRemote('expense_participants', mappedParticipants);
        const mergedSplits = await getMergedLocalAndRemote('expense_splits', mappedSplits);
        const mergedRepayments = await getMergedLocalAndRemote('repayments', mappedRepayments);

        setExpenseEvents(mergedEvents);
        setExpenseParticipants(mergedParticipants);
        setExpenseSplits(mergedSplits);
        setRepayments(mergedRepayments);

        await OfflineDB.clearStore('expense_events');
        await OfflineDB.clearStore('expense_participants');
        await OfflineDB.clearStore('expense_splits');
        await OfflineDB.clearStore('repayments');

        await OfflineDB.putAll('expense_events', mergedEvents);
        await OfflineDB.putAll('expense_participants', mergedParticipants);
        await OfflineDB.putAll('expense_splits', mergedSplits);
        await OfflineDB.putAll('repayments', mergedRepayments);
      } else {
        const cachedEvents = await OfflineDB.getAll<ExpenseEvent>('expense_events');
        const cachedParticipants = await OfflineDB.getAll<ExpenseParticipant>('expense_participants');
        const cachedSplits = await OfflineDB.getAll<ExpenseSplit>('expense_splits');
        const cachedRepayments = await OfflineDB.getAll<Repayment>('repayments');

        setExpenseEvents(cachedEvents);
        setExpenseParticipants(cachedParticipants);
        setExpenseSplits(cachedSplits);
        setRepayments(cachedRepayments);
      }
    } catch (error) {
      console.error('Error loading expense data:', error);
      const cachedEvents = await OfflineDB.getAll<ExpenseEvent>('expense_events');
      const cachedParticipants = await OfflineDB.getAll<ExpenseParticipant>('expense_participants');
      const cachedSplits = await OfflineDB.getAll<ExpenseSplit>('expense_splits');
      const cachedRepayments = await OfflineDB.getAll<Repayment>('repayments');

      setExpenseEvents(cachedEvents);
      setExpenseParticipants(cachedParticipants);
      setExpenseSplits(cachedSplits);
      setRepayments(cachedRepayments);
    }
  }, [user]);

  loadExpenseDataRef.current = loadExpenseData;

  // Initialize data: Load offline first, then fetch fresh in background
  useEffect(() => {
    if (user) {
      const initData = async () => {
        try {
          const [cachedCats, cachedTxs, cachedBudgets, cachedDebts, cachedGifts, cachedEvts, cachedPars, cachedSplits, cachedReps] = await Promise.all([
            OfflineDB.getAll<Category>('categories'),
            OfflineDB.getAll<Transaction>('transactions'),
            OfflineDB.getAll<Budget>('budgets'),
            OfflineDB.getAll<Debt>('debts'),
            OfflineDB.getAll<GiftRecord>('gift_records'),
            OfflineDB.getAll<ExpenseEvent>('expense_events'),
            OfflineDB.getAll<ExpenseParticipant>('expense_participants'),
            OfflineDB.getAll<ExpenseSplit>('expense_splits'),
            OfflineDB.getAll<Repayment>('repayments'),
          ]);

          if (cachedCats && cachedCats.length > 0) setCategories(cachedCats);
          if (cachedTxs && cachedTxs.length > 0) {
            cachedTxs.sort((a, b) => b.date.localeCompare(a.date));
            setTransactions(cachedTxs);
          }
          if (cachedBudgets && cachedBudgets.length > 0) setBudgets(cachedBudgets);
          if (cachedDebts && cachedDebts.length > 0) setDebts(cachedDebts);
          if (cachedGifts && cachedGifts.length > 0) setGifts(cachedGifts);
          if (cachedEvts && cachedEvts.length > 0) setExpenseEvents(cachedEvts);
          if (cachedPars && cachedPars.length > 0) setExpenseParticipants(cachedPars);
          if (cachedSplits && cachedSplits.length > 0) setExpenseSplits(cachedSplits);
          if (cachedReps && cachedReps.length > 0) setRepayments(cachedReps);

          setIsLoading(false);

          if (navigator.onLine) {
            Promise.all([
              loadCategoriesRef.current ? loadCategoriesRef.current() : Promise.resolve(),
              loadTransactionsRef.current ? loadTransactionsRef.current() : Promise.resolve(),
              loadBudgetsRef.current ? loadBudgetsRef.current() : Promise.resolve(),
              loadDebtsRef.current ? loadDebtsRef.current() : Promise.resolve(),
              loadGiftsRef.current ? loadGiftsRef.current() : Promise.resolve(),
              loadExpenseDataRef.current ? loadExpenseDataRef.current() : Promise.resolve(),
            ]).catch(err => console.error('Failed to reload fresh data in background:', err));
          }
        } catch (err) {
          console.error('Error during local-first data load:', err);
          setIsLoading(false);
        }
      };

      initData();
      refreshPendingCount();
    } else {
      // Clear data on logout
      setCategories(DEFAULT_CATEGORIES);
      setTransactions([]);
      setBudgets([]);
      setDebts([]);
      setGifts([]);
      setExpenseEvents([]);
      setExpenseParticipants([]);
      setExpenseSplits([]);
      setRepayments([]);
      setIsLoading(false);
    }
  }, [user, refreshPendingCount]);

  // Reschedule all local notifications when data changes
  useEffect(() => {
    if (!user || isLoading) return;
    NotificationService.rescheduleAll(debts, budgets, transactions);
  }, [user, debts, budgets, transactions, isLoading]);

  // Realtime subscription: auto-update when webhook creates new transactions (e.g. Sepay)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('transactions-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const t = payload.new;
          if (t.source === 'sepay') {
            const newTx: Transaction = {
              id: t.id,
              amount: parseFloat(t.amount),
              category: t.category || 'Khác',
              description: t.description || '',
              date: t.transaction_date,
              type: t.type === 'income' ? 'INCOME' : 'EXPENSE',
              receipt_url: t.receipt_url || undefined,
            };
            
            let category = newTx.category;
            if (category === 'Chuyển khoản đi' || category === 'Chuyển khoản nhận' || category === 'Khác') {
              const autoCat = autoCategorize(newTx.description, categories);
              if (autoCat && autoCat.type === newTx.type) {
                category = autoCat.category;
                supabase.from('transactions').update({ category }).eq('id', newTx.id).then(({ error }) => {
                  if (error) console.error('Error auto-updating realtime category in DB:', error);
                });
                OfflineDB.put('transactions', { ...newTx, category }).then();
              }
            }
            
            setTransactions((prev) => [{ ...newTx, category }, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, categories]);

  // Actions
  const handleAddTransaction = useCallback(async (newTx: Omit<Transaction, 'id'>) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const tx: Transaction = {
      id: tempId,
      amount: newTx.amount,
      category: newTx.category,
      description: newTx.description,
      date: newTx.date,
      type: newTx.type,
      receipt_url: newTx.receipt_url || undefined,
    };

    setTransactions(prev => [tx, ...prev]);
    await OfflineDB.put('transactions', tx);

    const syncItem: SyncPayload = {
      table: 'transactions',
      action: 'INSERT',
      data: {
        _tempId: tempId,
        user_id: user.id,
        type: newTx.type === 'INCOME' ? 'income' : 'expense',
        amount: newTx.amount,
        category: newTx.category,
        description: newTx.description,
        transaction_date: newTx.date,
        currency: 'VND',
        receipt_url: newTx.receipt_url || null,
      }
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = syncItem.data;
        const { data, error } = await supabase
          .from('transactions')
          .insert([serverData])
          .select()
          .single();

        if (error) throw error;

        const serverTx: Transaction = {
          id: data.id,
          amount: parseFloat(data.amount),
          category: data.category || 'Khác',
          description: data.description || '',
          date: data.transaction_date,
          type: newTx.type,
          receipt_url: data.receipt_url || undefined,
        };
        setTransactions(prev => prev.map(t => t.id === tempId ? serverTx : t));
        await OfflineDB.deleteById('transactions', tempId);
        await OfflineDB.put('transactions', serverTx);
      } catch (error) {
        console.error('Online insert failed, queuing for sync:', error);
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue(syncItem);
      await refreshPendingCount();
    }
  }, [user, refreshPendingCount]);

  const handleDeleteTransaction = useCallback(async (id: string) => {
    if (!user) return;

    setTransactions(prev => prev.filter(t => t.id !== id));
    await OfflineDB.deleteById('transactions', id);

    if (!id.startsWith('temp_')) {
      const syncItem: SyncPayload = {
        table: 'transactions',
        action: 'DELETE',
        data: { id, user_id: user.id }
      };

      if (navigator.onLine) {
        try {
          const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        } catch (error) {
          console.error('Online delete failed, queuing:', error);
          await SyncService.addToQueue(syncItem);
          await refreshPendingCount();
        }
      } else {
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    }
  }, [user, refreshPendingCount]);

  const handleUpdateTransaction = useCallback(async (id: string, description: string, category?: string) => {
    if (!user) return;

    let targetCategory = category;
    const currentTx = transactions.find(t => t.id === id);
    
    if (!targetCategory && currentTx) {
      const isDefaultCat = currentTx.category === 'Chuyển khoản đi' || currentTx.category === 'Chuyển khoản nhận' || currentTx.category === 'Khác';
      if (isDefaultCat) {
        const autoCat = autoCategorize(description);
        if (autoCat && autoCat.type === currentTx.type) {
          targetCategory = autoCat.category;
        }
      }
    }

    if (!targetCategory && currentTx) {
      targetCategory = currentTx.category;
    }

    const finalCategory = targetCategory || 'Khác';

    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, description, category: finalCategory } : t
    ));

    const existing = await OfflineDB.getById<Transaction>('transactions', id);
    if (existing) {
      await OfflineDB.put('transactions', { ...existing, description, category: finalCategory });
    }

    if (!id.startsWith('temp_')) {
      const syncItem: SyncPayload = {
        table: 'transactions',
        action: 'UPDATE',
        data: { id, user_id: user.id, description, category: finalCategory }
      };

      if (navigator.onLine) {
        try {
          const { error } = await supabase
            .from('transactions')
            .update({ description, category: finalCategory })
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        } catch (error) {
          console.error('Online update failed, queuing:', error);
          await SyncService.addToQueue(syncItem);
          await refreshPendingCount();
        }
      } else {
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    }
  }, [user, transactions, refreshPendingCount]);

  const handleSaveBudgets = useCallback(async (newBudgets: Budget[]) => {
    if (!user) return;

    setBudgets(newBudgets);
    await OfflineDB.clearStore('budgets');
    await OfflineDB.putAll('budgets', newBudgets);

    if (navigator.onLine) {
      try {
        const { error: deleteError } = await supabase
          .from('budgets')
          .delete()
          .eq('user_id', user.id);
        if (deleteError) throw deleteError;

        if (newBudgets.length > 0) {
          const { error: insertError } = await supabase
            .from('budgets')
            .insert(newBudgets.map(b => ({
              user_id: user.id,
              category: b.category,
              budget_limit: b.limit,
              period: b.period,
            })));
          if (insertError) throw insertError;
        }
        await loadBudgets();
      } catch (error) {
        console.error('Online budget save failed, queuing:', error);
        
        await SyncService.addToQueue({
          table: 'budgets',
          action: 'DELETE',
          data: { user_id: user.id },
        });
        for (const b of newBudgets) {
          await SyncService.addToQueue({
            table: 'budgets',
            action: 'INSERT',
            data: {
              _tempId: b.id,
              user_id: user.id,
              category: b.category,
              budget_limit: b.limit,
              period: b.period,
            },
          });
        }
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue({
        table: 'budgets',
        action: 'DELETE',
        data: { user_id: user.id },
      });
      for (const b of newBudgets) {
        await SyncService.addToQueue({
          table: 'budgets',
          action: 'INSERT',
          data: {
            _tempId: b.id,
            user_id: user.id,
            category: b.category,
            budget_limit: b.limit,
            period: b.period,
          },
        });
      }
      await refreshPendingCount();
    }
  }, [user, loadBudgets, refreshPendingCount]);

  const handleAddDebt = useCallback(async (newDebt: {
    type: DebtType;
    person_name: string;
    original_amount: number;
    created_date: string;
    due_date?: string;
    description?: string;
  }) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const localDebt: Debt = {
      id: tempId,
      user_id: user.id,
      type: newDebt.type,
      person_name: newDebt.person_name,
      original_amount: newDebt.original_amount,
      paid_amount: 0,
      remaining_amount: newDebt.original_amount,
      created_date: newDebt.created_date,
      due_date: newDebt.due_date,
      description: newDebt.description,
      status: 'pending',
    };

    setDebts(prev => [localDebt, ...prev]);
    await OfflineDB.put('debts', localDebt);

    const syncItem: SyncPayload = {
      table: 'debts',
      action: 'INSERT',
      data: {
        _tempId: tempId,
        user_id: user.id,
        type: newDebt.type,
        person_name: newDebt.person_name,
        original_amount: newDebt.original_amount,
        created_date: newDebt.created_date,
        due_date: newDebt.due_date || null,
        description: newDebt.description || null,
        status: 'pending',
      }
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = syncItem.data;
        const { error } = await supabase.from('debts').insert([serverData]);
        if (error) throw error;
        await loadDebts();
      } catch (error) {
        console.error('Online insert failed, queuing:', error);
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue(syncItem);
      await refreshPendingCount();
    }
  }, [user, loadDebts, refreshPendingCount]);

  const handleDeleteDebt = useCallback(async (id: string) => {
    if (!user) return;

    setDebts(prev => prev.filter(d => d.id !== id));
    await OfflineDB.deleteById('debts', id);

    if (!id.startsWith('temp_')) {
      const syncItem: SyncPayload = {
        table: 'debts',
        action: 'DELETE',
        data: { id, user_id: user.id }
      };

      if (navigator.onLine) {
        try {
          const { error } = await supabase
            .from('debts')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        } catch (error) {
          console.error('Online delete failed, queuing:', error);
          await SyncService.addToQueue(syncItem);
          await refreshPendingCount();
        }
      } else {
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    }
  }, [user, refreshPendingCount]);

  const handleAddGift = useCallback(async (newGift: {
    direction: GiftDirection;
    person_name: string;
    event_type: GiftEventType;
    amount: number;
    event_date: string;
    note?: string;
  }) => {
    if (!user) return;

    const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const localGift: GiftRecord = {
      id: tempId,
      user_id: user.id,
      direction: newGift.direction,
      person_name: newGift.person_name,
      event_type: newGift.event_type,
      amount: newGift.amount,
      event_date: newGift.event_date,
      note: newGift.note,
    };

    setGifts(prev => [localGift, ...prev]);
    await OfflineDB.put('gift_records', localGift);

    const syncItem: SyncPayload = {
      table: 'gift_records',
      action: 'INSERT',
      data: {
        _tempId: tempId,
        user_id: user.id,
        direction: newGift.direction,
        person_name: newGift.person_name,
        event_type: newGift.event_type,
        amount: newGift.amount,
        event_date: newGift.event_date,
        note: newGift.note || null,
      }
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = syncItem.data;
        const { error } = await supabase.from('gift_records').insert([serverData]);
        if (error) throw error;
        await loadGifts();
      } catch (error) {
        console.error('Online insert failed, queuing:', error);
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue(syncItem);
      await refreshPendingCount();
    }
  }, [user, loadGifts, refreshPendingCount]);

  const handleDeleteGift = useCallback(async (id: string) => {
    if (!user) return;

    setGifts(prev => prev.filter(g => g.id !== id));
    await OfflineDB.deleteById('gift_records', id);

    if (!id.startsWith('temp_')) {
      const syncItem: SyncPayload = {
        table: 'gift_records',
        action: 'DELETE',
        data: { id, user_id: user.id }
      };

      if (navigator.onLine) {
        try {
          const { error } = await supabase
            .from('gift_records')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);
          if (error) throw error;
        } catch (error) {
          console.error('Online delete failed, queuing:', error);
          await SyncService.addToQueue(syncItem);
          await refreshPendingCount();
        }
      } else {
        await SyncService.addToQueue(syncItem);
        await refreshPendingCount();
      }
    }
  }, [user, refreshPendingCount]);

  const handleAddExpenseEvent = useCallback(async (
    eventData: Omit<ExpenseEvent, 'id' | 'user_id' | 'status'> & { receiptFile?: File | null; receiptPreview?: string | null },
    participantsInput: Omit<ExpenseParticipant, 'id' | 'event_id'>[],
    splitsInput: { participantIndex: number; amountDue: number }[],
    ownerCategory?: string
  ) => {
    if (!user) return;

    const { receiptFile, receiptPreview, ...eventFields } = eventData;
    const eventId = generateUUID();
    
    // Create participants with correct ID and event_id
    const localParticipants: ExpenseParticipant[] = participantsInput.map((p, idx) => ({
      id: generateUUID(),
      event_id: eventId,
      display_name: p.display_name,
      phone_number: p.phone_number,
      is_owner: p.is_owner,
      note: p.note
    }));

    // Create splits with correct participant_id
    const localSplits: ExpenseSplit[] = splitsInput.map((s, idx) => {
      const p = localParticipants[s.participantIndex];
      return {
        id: generateUUID(),
        event_id: eventId,
        participant_id: p.id,
        amount_due: s.amountDue
      };
    });

    // Find owner split
    const ownerParticipant = localParticipants.find(p => p.is_owner);
    const ownerSplit = ownerParticipant ? localSplits.find(s => s.participant_id === ownerParticipant.id) : null;
    const ownerSplitAmount = ownerSplit ? ownerSplit.amount_due : 0;

    let linkedTxId: string | undefined = undefined;

    if (ownerSplitAmount > 0) {
      linkedTxId = generateUUID();
      const personalTx: Transaction = {
        id: linkedTxId,
        amount: ownerSplitAmount,
        category: ownerCategory || 'Ăn uống',
        description: `[Chi hộ] ${eventFields.title}`,
        date: eventFields.event_date,
        type: 'EXPENSE'
      };

      // Add personal transaction
      setTransactions(prev => [personalTx, ...prev]);
      await OfflineDB.put('transactions', personalTx);

      // Queue transaction sync
      await SyncService.addToQueue({
        table: 'transactions',
        action: 'INSERT',
        data: {
          id: linkedTxId,
          _tempId: linkedTxId,
          user_id: user.id,
          type: 'expense',
          amount: ownerSplitAmount,
          category: ownerCategory || 'Ăn uống',
          description: `[Chi hộ] ${eventFields.title}`,
          transaction_date: eventFields.event_date,
          currency: 'VND'
        }
      });
    }

    const localEvent: ExpenseEvent = {
      id: eventId,
      user_id: user.id,
      title: eventFields.title,
      event_date: eventFields.event_date,
      total_amount: eventFields.total_amount,
      split_method: eventFields.split_method,
      due_date: eventFields.due_date,
      description: eventFields.description,
      status: 'open',
      transaction_id: linkedTxId,
      receipt_url: receiptPreview || undefined
    };

    // Update local state
    setExpenseEvents(prev => [localEvent, ...prev]);
    setExpenseParticipants(prev => [...prev, ...localParticipants]);
    setExpenseSplits(prev => [...prev, ...localSplits]);

    // Save to IndexedDB
    await OfflineDB.put('expense_events', localEvent);
    await OfflineDB.putAll('expense_participants', localParticipants);
    await OfflineDB.putAll('expense_splits', localSplits);

    // Queue sync items
    await SyncService.addToQueue({
      table: 'expense_events',
      action: 'INSERT',
      data: {
        id: eventId,
        _tempId: eventId,
        user_id: user.id,
        title: localEvent.title,
        event_date: localEvent.event_date,
        total_amount: localEvent.total_amount,
        split_method: localEvent.split_method,
        due_date: localEvent.due_date || null,
        description: localEvent.description || null,
        status: localEvent.status,
        transaction_id: localEvent.transaction_id || null,
        receipt_url: localEvent.receipt_url || null
      },
      pendingReceiptBase64: receiptFile && receiptPreview ? receiptPreview : undefined,
      pendingReceiptFileName: receiptFile ? receiptFile.name : undefined
    });

    for (const p of localParticipants) {
      await SyncService.addToQueue({
        table: 'expense_participants',
        action: 'INSERT',
        data: {
          id: p.id,
          _tempId: p.id,
          event_id: eventId,
          display_name: p.display_name,
          phone_number: p.phone_number || null,
          is_owner: p.is_owner,
          note: p.note || null
        }
      });
    }

    for (const s of localSplits) {
      await SyncService.addToQueue({
        table: 'expense_splits',
        action: 'INSERT',
        data: {
          id: s.id,
          _tempId: s.id,
          event_id: eventId,
          participant_id: s.participant_id,
          amount_due: s.amount_due,
          note: s.note || null
        }
      });
    }

    if (navigator.onLine) {
      await processQueueAndLog('Thêm khoản chi hộ');
      if (loadExpenseDataRef.current) {
        loadExpenseDataRef.current().catch(err => console.error('Error reloading after add:', err));
      }
    }
    await refreshPendingCount();
  }, [user, refreshPendingCount]);

  const handleUpdateExpenseEvent = useCallback(async (
    eventId: string,
    eventData: Omit<ExpenseEvent, 'id' | 'user_id' | 'status'> & { receiptFile?: File | null; receiptPreview?: string | null },
    participantsInput: Omit<ExpenseParticipant, 'id' | 'event_id'>[],
    splitsInput: { participantIndex: number; amountDue: number }[],
    ownerCategory?: string
  ) => {
    if (!user) return;

    const { receiptFile, receiptPreview, ...eventFields } = eventData;

    // 1. Get old participants to preserve IDs where display_name and is_owner match
    const oldParticipants = expenseParticipants.filter(p => p.event_id === eventId);
    
    // Map new participants to new objects, preserving ID if name matches
    const localParticipants: ExpenseParticipant[] = participantsInput.map(p => {
      const match = oldParticipants.find(old => old.display_name === p.display_name && old.is_owner === p.is_owner);
      return {
        id: match ? match.id : generateUUID(),
        event_id: eventId,
        display_name: p.display_name,
        phone_number: p.phone_number,
        is_owner: p.is_owner,
        note: p.note
      };
    });

    // 2. Create splits with correct participant_id
    const localSplits: ExpenseSplit[] = splitsInput.map(s => {
      const p = localParticipants[s.participantIndex];
      return {
        id: generateUUID(),
        event_id: eventId,
        participant_id: p.id,
        amount_due: s.amountDue
      };
    });

    // 3. Find owner split and update linked transaction
    const ownerParticipant = localParticipants.find(p => p.is_owner);
    const ownerSplit = ownerParticipant ? localSplits.find(s => s.participant_id === ownerParticipant.id) : null;
    const ownerSplitAmount = ownerSplit ? ownerSplit.amount_due : 0;

    // Find if the event had a linked transaction
    const existingEvent = expenseEvents.find(e => e.id === eventId);
    let linkedTxId = existingEvent?.transaction_id;

    if (ownerSplitAmount > 0) {
      if (linkedTxId) {
        // Update existing transaction
        const updatedTx: Transaction = {
          id: linkedTxId,
          amount: ownerSplitAmount,
          category: ownerCategory || 'Ăn uống',
          description: `[Chi hộ] ${eventFields.title}`,
          date: eventFields.event_date,
          type: 'EXPENSE'
        };
        setTransactions(prev => prev.map(t => t.id === linkedTxId ? updatedTx : t));
        await OfflineDB.put('transactions', updatedTx);

        // Queue update sync
        await SyncService.addToQueue({
          table: 'transactions',
          action: 'UPDATE',
          data: {
            id: linkedTxId,
            user_id: user.id,
            amount: ownerSplitAmount,
            category: ownerCategory || 'Ăn uống',
            description: `[Chi hộ] ${eventFields.title}`,
            transaction_date: eventFields.event_date
          }
        });
      } else {
        // Create new linked transaction
        linkedTxId = generateUUID();
        const personalTx: Transaction = {
          id: linkedTxId,
          amount: ownerSplitAmount,
          category: ownerCategory || 'Ăn uống',
          description: `[Chi hộ] ${eventFields.title}`,
          date: eventFields.event_date,
          type: 'EXPENSE'
        };
        setTransactions(prev => [personalTx, ...prev]);
        await OfflineDB.put('transactions', personalTx);

        await SyncService.addToQueue({
          table: 'transactions',
          action: 'INSERT',
          data: {
            id: linkedTxId,
            _tempId: linkedTxId,
            user_id: user.id,
            type: 'expense',
            amount: ownerSplitAmount,
            category: ownerCategory || 'Ăn uống',
            description: `[Chi hộ] ${eventFields.title}`,
            transaction_date: eventFields.event_date,
            currency: 'VND'
          }
        });
      }
    } else if (linkedTxId) {
      // Owner share became 0, delete linked transaction
      setTransactions(prev => prev.filter(t => t.id !== linkedTxId));
      await OfflineDB.deleteById('transactions', linkedTxId);
      await SyncService.addToQueue({
        table: 'transactions',
        action: 'DELETE',
        data: { id: linkedTxId, user_id: user.id }
      });
      linkedTxId = undefined;
    }

    // Determine status of the event based on new splits and repayments
    const eventRepayments = repayments.filter(r => r.event_id === eventId);
    let totalPaid = eventRepayments.reduce((sum, r) => sum + r.amount, 0);
    let totalReceivable = localSplits
      .filter(s => {
        const p = localParticipants.find(p => p.id === s.participant_id);
        return p && !p.is_owner;
      })
      .reduce((sum, s) => sum + s.amount_due, 0);

    const status = totalPaid >= totalReceivable && totalReceivable > 0
      ? 'settled'
      : totalPaid > 0
        ? 'partial'
        : 'open';

    const updatedEvent: ExpenseEvent = {
      id: eventId,
      user_id: user.id,
      title: eventFields.title,
      event_date: eventFields.event_date,
      total_amount: eventFields.total_amount,
      split_method: eventFields.split_method,
      due_date: eventFields.due_date,
      description: eventFields.description,
      status: status,
      transaction_id: linkedTxId,
      receipt_url: receiptPreview || undefined
    };

    // Update local state
    setExpenseEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e));
    
    // Replace participants: filter out old, add new
    setExpenseParticipants(prev => [
      ...prev.filter(p => p.event_id !== eventId),
      ...localParticipants
    ]);

    // Replace splits: filter out old, add new
    setExpenseSplits(prev => [
      ...prev.filter(s => s.event_id !== eventId),
      ...localSplits
    ]);

    // Update IndexedDB
    await OfflineDB.put('expense_events', updatedEvent);
    
    // Delete removed participants
    const newParticipantIds = new Set(localParticipants.map(p => p.id));
    for (const p of oldParticipants) {
      if (!newParticipantIds.has(p.id)) {
        await OfflineDB.deleteById('expense_participants', p.id);
        // Queue delete for participant
        await SyncService.addToQueue({
          table: 'expense_participants',
          action: 'DELETE',
          data: { id: p.id }
        });
      }
    }
    await OfflineDB.putAll('expense_participants', localParticipants);
    
    // For splits, we clear and recreate
    const remainingSplits = expenseSplits.filter(s => s.event_id !== eventId);
    await OfflineDB.clearStore('expense_splits');
    await OfflineDB.putAll('expense_splits', [...remainingSplits, ...localSplits]);

    // Queue sync items
    await SyncService.addToQueue({
      table: 'expense_events',
      action: 'UPDATE',
      data: {
        id: eventId,
        user_id: user.id,
        title: updatedEvent.title,
        event_date: updatedEvent.event_date,
        total_amount: updatedEvent.total_amount,
        split_method: updatedEvent.split_method,
        due_date: updatedEvent.due_date || null,
        description: updatedEvent.description || null,
        status: updatedEvent.status,
        transaction_id: updatedEvent.transaction_id || null,
        receipt_url: updatedEvent.receipt_url || null
      },
      pendingReceiptBase64: receiptFile && receiptPreview ? receiptPreview : undefined,
      pendingReceiptFileName: receiptFile ? receiptFile.name : undefined
    });

    const oldParticipantIds = new Set(oldParticipants.map(p => p.id));
    for (const p of localParticipants) {
      if (oldParticipantIds.has(p.id)) {
        await SyncService.addToQueue({
          table: 'expense_participants',
          action: 'UPDATE',
          data: {
            id: p.id,
            display_name: p.display_name,
            phone_number: p.phone_number || null,
            note: p.note || null
          }
        });
      } else {
        await SyncService.addToQueue({
          table: 'expense_participants',
          action: 'INSERT',
          data: {
            id: p.id,
            _tempId: p.id,
            event_id: eventId,
            display_name: p.display_name,
            phone_number: p.phone_number || null,
            is_owner: p.is_owner,
            note: p.note || null
          }
        });
      }
    }

    const oldSplits = expenseSplits.filter(s => s.event_id === eventId);
    for (const s of oldSplits) {
      await SyncService.addToQueue({
        table: 'expense_splits',
        action: 'DELETE',
        data: { id: s.id }
      });
    }

    for (const s of localSplits) {
      await SyncService.addToQueue({
        table: 'expense_splits',
        action: 'INSERT',
        data: {
          id: s.id,
          _tempId: s.id,
          event_id: eventId,
          participant_id: s.participant_id,
          amount_due: s.amount_due,
          note: s.note || null
        }
      });
    }

    if (navigator.onLine) {
      await processQueueAndLog('Cập nhật khoản chi hộ');
      if (loadExpenseDataRef.current) {
        loadExpenseDataRef.current().catch(err => console.error('Error reloading after update:', err));
      }
    }
    await refreshPendingCount();
  }, [user, expenseEvents, expenseParticipants, expenseSplits, repayments, refreshPendingCount, processQueueAndLog]);

  const handleDeleteExpenseEvent = useCallback(async (eventId: string) => {
    if (!user) return;

    // Find the event to check for a linked transaction
    const event = expenseEvents.find(e => e.id === eventId);
    
    // Delete linked transaction if it exists
    if (event && event.transaction_id) {
      setTransactions(prev => prev.filter(t => t.id !== event.transaction_id));
      await OfflineDB.deleteById('transactions', event.transaction_id);
      
      if (!event.transaction_id.startsWith('temp_')) {
        await SyncService.addToQueue({
          table: 'transactions',
          action: 'DELETE',
          data: { id: event.transaction_id, user_id: user.id }
        });
      }
    }

    // Update local state
    setExpenseEvents(prev => prev.filter(e => e.id !== eventId));
    setExpenseParticipants(prev => prev.filter(p => p.event_id !== eventId));
    setExpenseSplits(prev => prev.filter(s => s.event_id !== eventId));
    setRepayments(prev => prev.filter(r => r.event_id !== eventId));

    // Delete from IndexedDB
    await OfflineDB.deleteById('expense_events', eventId);
    
    const remainingParticipants = expenseParticipants.filter(p => p.event_id !== eventId);
    await OfflineDB.clearStore('expense_participants');
    if (remainingParticipants.length > 0) await OfflineDB.putAll('expense_participants', remainingParticipants);

    const remainingSplits = expenseSplits.filter(s => s.event_id !== eventId);
    await OfflineDB.clearStore('expense_splits');
    if (remainingSplits.length > 0) await OfflineDB.putAll('expense_splits', remainingSplits);

    const remainingRepayments = repayments.filter(r => r.event_id !== eventId);
    await OfflineDB.clearStore('repayments');
    if (remainingRepayments.length > 0) await OfflineDB.putAll('repayments', remainingRepayments);

    // Queue sync deletes
    if (!eventId.startsWith('temp_')) {
      await SyncService.addToQueue({
        table: 'expense_events',
        action: 'DELETE',
        data: { id: eventId, user_id: user.id }
      });
    }

    if (navigator.onLine) {
      await processQueueAndLog('Xóa khoản chi hộ');
    }
    await refreshPendingCount();
  }, [user, expenseEvents, expenseParticipants, expenseSplits, repayments, refreshPendingCount]);

  const handleAddRepayment = useCallback(async (repaymentData: Omit<Repayment, 'id'>) => {
    if (!user) return;

    const tempId = generateUUID();
    const newRepayment: Repayment = {
      id: tempId,
      event_id: repaymentData.event_id,
      participant_id: repaymentData.participant_id,
      repayment_date: repaymentData.repayment_date,
      amount: repaymentData.amount,
      payment_method: repaymentData.payment_method,
      reference_no: repaymentData.reference_no,
      note: repaymentData.note
    };

    // Update local state
    const updatedRepayments = [newRepayment, ...repayments];
    setRepayments(updatedRepayments);
    await OfflineDB.put('repayments', newRepayment);

    // Recalculate event status
    const event = expenseEvents.find(e => e.id === repaymentData.event_id);
    if (event) {
      const eParticipants = expenseParticipants.filter(p => p.event_id === event.id);
      const eSplits = expenseSplits.filter(s => s.event_id === event.id);
      
      const settlements = eParticipants.map(participant => {
        const split = eSplits.find(s => s.participant_id === participant.id);
        const amountDue = split ? split.amount_due : 0;
        
        const amountPaid = updatedRepayments
          .filter(r => r.event_id === event.id && r.participant_id === participant.id)
          .reduce((sum, curr) => sum + curr.amount, 0);
          
        return {
          isOwner: participant.is_owner,
          amountDue,
          amountPaid
        };
      });

      const friendSettlements = settlements.filter(s => !s.isOwner);
      const allFriendsPaid = friendSettlements.every(s => s.amountPaid >= s.amountDue);
      const anyFriendPaid = friendSettlements.some(s => s.amountPaid > 0);

      let newStatus: ExpenseEventStatus = 'open';
      if (allFriendsPaid) {
        newStatus = 'settled';
      } else if (anyFriendPaid) {
        newStatus = 'partial';
      }

      if (event.status !== newStatus) {
        const updatedEvent = { ...event, status: newStatus };
        setExpenseEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        await OfflineDB.put('expense_events', updatedEvent);
      }
    }

    // Queue repayment insertion
    await SyncService.addToQueue({
      table: 'repayments',
      action: 'INSERT',
      data: {
        id: tempId,
        _tempId: tempId,
        event_id: repaymentData.event_id,
        participant_id: repaymentData.participant_id,
        repayment_date: repaymentData.repayment_date,
        amount: repaymentData.amount,
        payment_method: repaymentData.payment_method || null,
        reference_no: repaymentData.reference_no || null,
        note: repaymentData.note || null
      }
    });

    if (navigator.onLine) {
      await processQueueAndLog('Ghi nhận hoàn trả');
      if (loadExpenseDataRef.current) {
        loadExpenseDataRef.current().catch(err => console.error('Error reloading after repayment:', err));
      }
    }
    await refreshPendingCount();
  }, [user, repayments, expenseEvents, expenseParticipants, expenseSplits, refreshPendingCount]);

  const handleDeleteRepayment = useCallback(async (repaymentId: string) => {
    if (!user) return;

    const repaymentToDelete = repayments.find(r => r.id === repaymentId);
    if (!repaymentToDelete) return;

    const updatedRepayments = repayments.filter(r => r.id !== repaymentId);
    setRepayments(updatedRepayments);
    await OfflineDB.deleteById('repayments', repaymentId);

    // Recalculate event status
    const event = expenseEvents.find(e => e.id === repaymentToDelete.event_id);
    if (event) {
      const eParticipants = expenseParticipants.filter(p => p.event_id === event.id);
      const eSplits = expenseSplits.filter(s => s.event_id === event.id);
      
      const settlements = eParticipants.map(participant => {
        const split = eSplits.find(s => s.participant_id === participant.id);
        const amountDue = split ? split.amount_due : 0;
        
        const amountPaid = updatedRepayments
          .filter(r => r.event_id === event.id && r.participant_id === participant.id)
          .reduce((sum, curr) => sum + curr.amount, 0);
          
        return {
          isOwner: participant.is_owner,
          amountDue,
          amountPaid
        };
      });

      const friendSettlements = settlements.filter(s => !s.isOwner);
      const allFriendsPaid = friendSettlements.every(s => s.amountPaid >= s.amountDue);
      const anyFriendPaid = friendSettlements.some(s => s.amountPaid > 0);

      let newStatus: ExpenseEventStatus = 'open';
      if (allFriendsPaid) {
        newStatus = 'settled';
      } else if (anyFriendPaid) {
        newStatus = 'partial';
      }

      if (event.status !== newStatus) {
        const updatedEvent = { ...event, status: newStatus };
        setExpenseEvents(prev => prev.map(e => e.id === event.id ? updatedEvent : e));
        await OfflineDB.put('expense_events', updatedEvent);
      }
    }

    if (!repaymentId.startsWith('temp_')) {
      await SyncService.addToQueue({
        table: 'repayments',
        action: 'DELETE',
        data: { id: repaymentId }
      });
    }

    if (navigator.onLine) {
      await processQueueAndLog('Xóa khoản hoàn trả');
    }
    await refreshPendingCount();
  }, [user, repayments, expenseEvents, expenseParticipants, expenseSplits, refreshPendingCount]);

  const handleGetAiAdvice = useCallback(async () => {
    if (transactions.length === 0) return;
    setIsAiLoading(true);
    try {
      const advice = await getFinancialAdvice(transactions);
      setAiAdvice(advice);
    } catch (err) {
      console.error('Gemini API advisor failed:', err);
    } finally {
      setIsAiLoading(false);
    }
  }, [transactions]);

  const clearAllData = useCallback(() => {
    setTransactions([]);
    setDebts([]);
    setGifts([]);
    setBudgets([]);
    setCategories(DEFAULT_CATEGORIES);
    setExpenseEvents([]);
    setExpenseParticipants([]);
    setExpenseSplits([]);
    setRepayments([]);
    setAiAdvice(null);
  }, []);

  // Computed states
  const stats = useMemo(() => {
    const income = transactions.filter(t => t.type === 'INCOME').reduce((acc, curr) => acc + curr.amount, 0);
    const expense = transactions.filter(t => t.type === 'EXPENSE').reduce((acc, curr) => acc + curr.amount, 0);
    return {
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    };
  }, [transactions]);

  const pieData = useMemo(() => {
    const summary: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        summary[t.category] = (summary[t.category] || 0) + t.amount;
      });
    return Object.entries(summary).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const barData = useMemo(() => {
    const dates: Record<string, { income: number; expense: number }> = {};
    transactions.slice(-10).forEach(t => {
      const date = t.date;
      if (!dates[date]) dates[date] = { income: 0, expense: 0 };
      if (t.type === 'INCOME') dates[date].income += t.amount;
      else dates[date].expense += t.amount;
    });
    return Object.entries(dates).map(([date, values]) => ({ date, ...values }));
  }, [transactions]);

  const debtStats = useMemo(() => {
    const receivable = debts
      .filter(d => d.type === 'receivable')
      .reduce((sum, d) => sum + d.remaining_amount, 0);
    const payable = debts
      .filter(d => d.type === 'payable')
      .reduce((sum, d) => sum + d.remaining_amount, 0);
    return { receivable, payable, net: receivable - payable };
  }, [debts]);

  const giftStats = useMemo(() => {
    const given = gifts
      .filter(g => g.direction === 'given')
      .reduce((sum, g) => sum + g.amount, 0);
    const received = gifts
      .filter(g => g.direction === 'received')
      .reduce((sum, g) => sum + g.amount, 0);
    return { given, received, net: received - given };
  }, [gifts]);

  const activeAlerts = useMemo<NotificationAlert[]>(() => {
    if (!user) return [];
    return NotificationService.getActiveAlerts(debts, budgets, transactions);
  }, [user, debts, budgets, transactions]);

  return {
    transactions,
    budgets,
    categories,
    debts,
    gifts,
    expenseEvents,
    expenseParticipants,
    expenseSplits,
    repayments,
    isLoading,
    pendingSyncCount,
    aiAdvice,
    isAiLoading,
    isOnline,
    isSyncing,
    syncResult,
    dismissSyncResult,
    stats,
    pieData,
    barData,
    debtStats,
    giftStats,
    activeAlerts,
    loadDebts,
    loadGifts,
    handleAddTransaction,
    handleDeleteTransaction,
    handleUpdateTransaction,
    handleSaveBudgets,
    handleAddDebt,
    handleDeleteDebt,
    handleAddGift,
    handleDeleteGift,
    handleCategoriesChange,
    handleGetAiAdvice,
    handleSync,
    clearAllData,
    handleAddExpenseEvent,
    handleUpdateExpenseEvent,
    handleDeleteExpenseEvent,
    handleAddRepayment,
    handleDeleteRepayment,
  };
}
