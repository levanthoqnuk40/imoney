
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Transaction, AIAdvice, Budget, ViewType, Debt, DebtType, GiftRecord, GiftDirection, GiftEventType, Category } from './types';
import StatsCard from './components/StatsCard';
import TransactionForm from './components/TransactionForm';
import Dashboard from './components/Dashboard';
import BudgetModal from './components/BudgetModal';
import LoginScreen from './components/LoginScreen';
import TransactionDetail from './components/TransactionDetail';
import CategoryModal from './components/CategoryModal';
import DebtCard from './components/DebtCard';
import DebtForm from './components/DebtForm';
import DebtDetail from './components/DebtDetail';
import GiftCard from './components/GiftCard';
import GiftForm from './components/GiftForm';
import GiftDetail from './components/GiftDetail';
import { getFinancialAdvice } from './services/geminiService';
import { supabase } from './services/supabase.service';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { COLORS, GIFT_EVENT_TYPES, autoCategorize, getCategories, saveCategories, DEFAULT_CATEGORIES } from './constants';
import { User } from '@supabase/supabase-js';
import * as OfflineDB from './services/offline.service';
import * as SyncService from './services/sync.service';
import * as NotificationService from './services/notification.service';
import { NotificationAlert } from './services/notification.service';
import { useNetworkStatus } from './hooks/useNetworkStatus';

// Clean up description metadata and technical codes for mobile
const formatDescription = (desc: string) => {
  if (!desc || desc.trim() === '' || desc.toLowerCase() === 'null') {
    return 'Không có ghi chú';
  }
  
  // Clean transaction references or trace codes
  return desc.split(' ').map(word => {
    // If it's a long alphanumeric code (e.g. VCBFT123456 or Momo cashin ID)
    if (word.length > 12 && /^[a-z0-9]+$/i.test(word)) {
      return word.slice(0, 6) + '...';
    }
    return word;
  }).join(' ');
};

const App: React.FC = () => {
  // Auth state
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [categories, setCategories] = useState<Category[]>(() => getCategories());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isCategoryMgmtOpen, setIsCategoryMgmtOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [aiAdvice, setAiAdvice] = useState<AIAdvice | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [filterMonth, setFilterMonth] = useState<string | null>(null); // 'YYYY-MM' or null
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');

  // Debt management state
  const [debts, setDebts] = useState<Debt[]>([]);
  const [isDebtFormOpen, setIsDebtFormOpen] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [debtFilter, setDebtFilter] = useState<'all' | 'receivable' | 'payable' | 'completed'>('all');

  // Gift money tracking state
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [isGiftFormOpen, setIsGiftFormOpen] = useState(false);
  const [selectedGift, setSelectedGift] = useState<GiftRecord | null>(null);
  const [giftFilter, setGiftFilter] = useState<'all' | GiftEventType>('all');

  // Pending sync count for UI badge
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Notification bell panel state
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const notificationPanelRef = React.useRef<HTMLDivElement>(null);

  // Refresh pending count helper
  const refreshPendingCount = useCallback(async () => {
    const count = await SyncService.getPendingCount();
    setPendingSyncCount(count);
  }, []);

  // Sync handler: process queue + reload all data
  const handleSync = useCallback(async () => {
    const result = await SyncService.processQueue();
    // Reload fresh data from Supabase after sync
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

  // Refs to hold latest load functions (avoids circular deps)
  const loadTransactionsRef = React.useRef<(() => Promise<void>) | null>(null);
  const loadDebtsRef = React.useRef<(() => Promise<void>) | null>(null);
  const loadGiftsRef = React.useRef<(() => Promise<void>) | null>(null);
  const loadBudgetsRef = React.useRef<(() => Promise<void>) | null>(null);
  const loadCategoriesRef = React.useRef<(() => Promise<void>) | null>(null);

  // Network status hook
  const { isOnline, isSyncing, syncResult, dismissSyncResult } = useNetworkStatus({
    onReconnect: handleSync,
  });

  // Check auth state on mount — with offline fallback
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Try online auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          // Cache session for offline use
          await OfflineDB.cacheAuthSession(session.user, session);
          setAuthLoading(false);
          // Initialize local notifications
          await NotificationService.initNotifications();
          return;
        }
      } catch {
        // Network error — try offline cache
      }

      // Fallback: load cached auth when offline
      if (!navigator.onLine) {
        const cached = await OfflineDB.getCachedAuth();
        if (cached) {
          // Create a minimal User-like object for offline use
          setUser({
            id: cached.userId,
            email: cached.email,
            user_metadata: { full_name: cached.fullName },
          } as User);
          // Initialize local notifications even offline
          await NotificationService.initNotifications();
        }
      }
      setAuthLoading(false);
    };

    initAuth();

    // Listen for auth changes (online only)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        setUser(session.user);
        await OfflineDB.cacheAuthSession(session.user, session);
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Handle logout — clear offline cache too
  const handleLogout = async () => {
    await supabase.auth.signOut();
    await OfflineDB.clearCachedAuth();
    setTransactions([]);
    setDebts([]);
    setGifts([]);
    setBudgets([]);
  };

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
            // Update IndexedDB immediately
            OfflineDB.put('transactions', { ...t, category }).then();
          }
        }
      }
      return { ...t, category };
    }));

    if (dbUpdates.length > 0 && navigator.onLine) {
      // Run Supabase updates sequentially in the background to avoid connection exhaustion/rate limiting
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
        setTransactions(processed);
        // Cache to IndexedDB
        await OfflineDB.clearStore('transactions');
        await OfflineDB.putAll('transactions', processed);
      } else {
        // Offline: load from IndexedDB
        const cached = await OfflineDB.getAll<Transaction>('transactions');
        // Sort by date descending (same as Supabase order)
        cached.sort((a, b) => b.date.localeCompare(a.date));
        const processed = await autoCategorizeTransactions(cached, false);
        setTransactions(processed);
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
      // Fallback to IndexedDB on network error
      const cached = await OfflineDB.getAll<Transaction>('transactions');
      cached.sort((a, b) => b.date.localeCompare(a.date));
      const processed = await autoCategorizeTransactions(cached, false);
      setTransactions(processed);
    } finally {
      setIsLoading(false);
    }
  }, [user, autoCategorizeTransactions]);

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
          // Use default categories in state
          setCategories(DEFAULT_CATEGORIES);
          saveCategories(DEFAULT_CATEGORIES);
          await OfflineDB.clearStore('categories');
          await OfflineDB.putAll('categories', DEFAULT_CATEGORIES);
          return;
        }
      }

      // Offline: load from IndexedDB
      const cached = await OfflineDB.getAll<Category>('categories');
      if (cached && cached.length > 0) {
        setCategories(cached);
        saveCategories(cached);
      } else {
        // Fallback to default
        setCategories(DEFAULT_CATEGORIES);
        saveCategories(DEFAULT_CATEGORIES);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      // Fallback to IndexedDB / localStorage on error
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

  // Keep ref in sync
  loadCategoriesRef.current = loadCategories;

  // Handle categories changes (add/edit/delete) with cascade updates for renames
  const handleCategoriesChange = useCallback(async (newCategories: Category[], renameMap?: { oldName: string; newName: string }) => {
    // Save new categories
    setCategories(newCategories);
    saveCategories(newCategories);

    // Sync category changes to Supabase & IndexedDB
    if (user) {
      // 1. Detect inserts, updates, and deletes
      const addedOrUpdated = newCategories.filter(nc => {
        const old = categories.find(oc => oc.id === nc.id);
        return !old || old.name !== nc.name || old.icon !== nc.icon || JSON.stringify(old.keywords) !== JSON.stringify(nc.keywords);
      });

      const deleted = categories.filter(oc => !newCategories.some(nc => nc.id === oc.id));

      // Process added or updated items
      for (const item of addedOrUpdated) {
        const isNew = !categories.some(oc => oc.id === item.id);
        const action = isNew ? 'INSERT' : 'UPDATE';

        // Update IndexedDB immediately
        await OfflineDB.put('categories', item);

        const payload = {
          id: item.id,
          user_id: user.id,
          name: item.name,
          icon: item.icon,
          type: item.type,
          keywords: item.keywords
        };

        if (navigator.onLine) {
          try {
            if (isNew) {
              const { error } = await supabase.from('categories').insert([payload]);
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
            await SyncService.addToQueue({
              table: 'categories',
              action,
              data: payload
            });
            await refreshPendingCount();
          }
        } else {
          // Offline: queue update
          await SyncService.addToQueue({
            table: 'categories',
            action,
            data: payload
          });
          await refreshPendingCount();
        }
      }

      // Process deleted items
      for (const item of deleted) {
        // Delete from IndexedDB
        await OfflineDB.deleteById('categories', item.id);

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
            await SyncService.addToQueue({
              table: 'categories',
              action: 'DELETE',
              data: { id: item.id, user_id: user.id }
            });
            await refreshPendingCount();
          }
        } else {
          // Offline: queue delete
          await SyncService.addToQueue({
            table: 'categories',
            action: 'DELETE',
            data: { id: item.id, user_id: user.id }
          });
          await refreshPendingCount();
        }
      }
    }

    // If a category was renamed, update all associated transactions and budgets
    if (renameMap && user) {
      const { oldName, newName } = renameMap;

      // 1. Cascade update transactions local state
      setTransactions(prev => prev.map(t => 
        t.category === oldName ? { ...t, category: newName } : t
      ));

      // Cascade update transactions in local IndexedDB cache
      try {
        const cachedTxs = await OfflineDB.getAll<Transaction>('transactions');
        const updatedCachedTxs = cachedTxs.map(t => 
          t.category === oldName ? { ...t, category: newName } : t
        );
        await OfflineDB.clearStore('transactions');
        await OfflineDB.putAll('transactions', updatedCachedTxs);

        // Cascade update in Supabase / queue if offline
        if (navigator.onLine) {
          const { error } = await supabase
            .from('transactions')
            .update({ category: newName })
            .eq('category', oldName)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          // Offline: queue updates for affected transactions
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

      // 2. Cascade update budgets local state
      setBudgets(prev => prev.map(b => 
        b.category === oldName ? { ...b, category: newName } : b
      ));

      // Cascade update budgets in local IndexedDB cache
      try {
        const cachedBudgets = await OfflineDB.getAll<Budget>('budgets');
        const updatedCachedBudgets = cachedBudgets.map(b => 
          b.category === oldName ? { ...b, category: newName } : b
        );
        await OfflineDB.clearStore('budgets');
        await OfflineDB.putAll('budgets', updatedCachedBudgets);

        // Cascade update budgets in Supabase / queue if offline
        if (navigator.onLine) {
          const { error } = await supabase
            .from('budgets')
            .update({ category: newName })
            .eq('category', oldName)
            .eq('user_id', user.id);
          if (error) throw error;
        } else {
          // Offline: queue updates for affected budgets
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

  // Keep ref in sync for the sync handler
  loadTransactionsRef.current = loadTransactions;

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

        setBudgets(mapped);
        await OfflineDB.clearStore('budgets');
        await OfflineDB.putAll('budgets', mapped);
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

  // Keep ref in sync
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
          type: d.type as 'receivable' | 'payable',
          person_name: d.person_name,
          original_amount: parseFloat(d.original_amount),
          paid_amount: parseFloat(d.paid_amount || 0),
          remaining_amount: parseFloat(d.original_amount) - parseFloat(d.paid_amount || 0),
          created_date: d.created_date,
          due_date: d.due_date || undefined,
          description: d.description || undefined,
          status: d.status as 'pending' | 'partial' | 'completed'
        }));

        setDebts(mappedDebts);
        await OfflineDB.clearStore('debts');
        await OfflineDB.putAll('debts', mappedDebts);
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

  // Keep ref in sync
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

        setGifts(mappedGifts);
        await OfflineDB.clearStore('gift_records');
        await OfflineDB.putAll('gift_records', mappedGifts);
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

  // Keep ref in sync
  loadGiftsRef.current = loadGifts;

  // Load all data with local-first cache (SWR) when user is authenticated
  useEffect(() => {
    if (user) {
      const initData = async () => {
        try {
          // 1. Instantly load from IndexedDB (local-first)
          const [cachedCats, cachedTxs, cachedBudgets, cachedDebts, cachedGifts] = await Promise.all([
            OfflineDB.getAll<Category>('categories'),
            OfflineDB.getAll<Transaction>('transactions'),
            OfflineDB.getAll<Budget>('budgets'),
            OfflineDB.getAll<Debt>('debts'),
            OfflineDB.getAll<GiftRecord>('gift_records'),
          ]);

          if (cachedCats && cachedCats.length > 0) setCategories(cachedCats);
          if (cachedTxs && cachedTxs.length > 0) {
            cachedTxs.sort((a, b) => b.date.localeCompare(a.date));
            setTransactions(cachedTxs);
          }
          if (cachedBudgets && cachedBudgets.length > 0) setBudgets(cachedBudgets);
          if (cachedDebts && cachedDebts.length > 0) setDebts(cachedDebts);
          if (cachedGifts && cachedGifts.length > 0) setGifts(cachedGifts);

          // Render UI instantly!
          setIsLoading(false);

          // 2. Fetch fresh data from Supabase in the background (parallel)
          if (navigator.onLine) {
            Promise.all([
              loadCategoriesRef.current ? loadCategoriesRef.current() : Promise.resolve(),
              loadTransactionsRef.current ? loadTransactionsRef.current() : Promise.resolve(),
              loadBudgetsRef.current ? loadBudgetsRef.current() : Promise.resolve(),
              loadDebtsRef.current ? loadDebtsRef.current() : Promise.resolve(),
              loadGiftsRef.current ? loadGiftsRef.current() : Promise.resolve(),
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
      // Clean up state on logout
      setCategories(DEFAULT_CATEGORIES);
      setTransactions([]);
      setBudgets([]);
      setDebts([]);
      setGifts([]);
      setIsLoading(false);
    }
  }, [user, refreshPendingCount]);

  // Reschedule all notifications when data changes
  useEffect(() => {
    if (!user || isLoading) return;
    NotificationService.rescheduleAll(debts, budgets, transactions);
  }, [user, debts, budgets, transactions, isLoading]);

  // Realtime subscription: auto-update when Sepay webhook creates new transactions
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
          // Only auto-add if it came from Sepay (avoid duplicating manual adds)
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
            
            // Run auto categorization on the new transaction
            let category = newTx.category;
            if (category === 'Chuyển khoản đi' || category === 'Chuyển khoản nhận' || category === 'Khác') {
              const autoCat = autoCategorize(newTx.description, categories);
              if (autoCat && autoCat.type === newTx.type) {
                category = autoCat.category;
                // Update Supabase and IndexedDB in background
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

  // Clean up old localStorage data (migrated to Supabase/IndexedDB)
  useEffect(() => {
    localStorage.removeItem('finvise_transactions');
    localStorage.removeItem('finvise_budgets');
  }, []);

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
    const categories: Record<string, number> = {};
    transactions
      .filter(t => t.type === 'EXPENSE')
      .forEach(t => {
        categories[t.category] = (categories[t.category] || 0) + t.amount;
      });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
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

  const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
    if (!user) {
      alert('Vui lòng đăng nhập để thêm giao dịch');
      return;
    }

    // Generate a temporary local ID
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

    // Optimistic update: show immediately in UI + save to IndexedDB
    setTransactions(prev => [tx, ...prev]);
    await OfflineDB.put('transactions', tx);

    const supabasePayload = {
      _tempId: tempId,
      user_id: user.id,
      type: newTx.type === 'INCOME' ? 'income' : 'expense',
      amount: newTx.amount,
      category: newTx.category,
      description: newTx.description,
      transaction_date: newTx.date,
      currency: 'VND',
      receipt_url: newTx.receipt_url || null,
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = supabasePayload;
        const { data, error } = await supabase
          .from('transactions')
          .insert([serverData])
          .select()
          .single();

        if (error) throw error;

        // Replace temp item with real server data
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
        await SyncService.addToQueue({ table: 'transactions', action: 'INSERT', data: supabasePayload });
        await refreshPendingCount();
      }
    } else {
      // Offline: queue for later sync
      await SyncService.addToQueue({ table: 'transactions', action: 'INSERT', data: supabasePayload });
      await refreshPendingCount();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    if (!user) return;

    // Optimistic: remove from UI + IndexedDB immediately
    setTransactions(prev => prev.filter(t => t.id !== id));
    await OfflineDB.deleteById('transactions', id);

    if (navigator.onLine && !id.startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Online delete failed, queuing:', error);
        await SyncService.addToQueue({ table: 'transactions', action: 'DELETE', data: { id, user_id: user.id } });
        await refreshPendingCount();
      }
    } else if (!id.startsWith('temp_')) {
      await SyncService.addToQueue({ table: 'transactions', action: 'DELETE', data: { id, user_id: user.id } });
      await refreshPendingCount();
    }
  };

  // Update transaction description and/or category
  const handleUpdateTransaction = async (id: string, description: string, category?: string) => {
    if (!user) return;

    let targetCategory = category;
    const currentTx = transactions.find(t => t.id === id);
    
    // Auto-categorize if no manual category is provided and the description changed
    if (!targetCategory && currentTx) {
      const isDefaultCat = currentTx.category === 'Chuyển khoản đi' || currentTx.category === 'Chuyển khoản nhận' || currentTx.category === 'Khác';
      if (isDefaultCat) {
        const autoCat = autoCategorize(description);
        if (autoCat && autoCat.type === currentTx.type) {
          targetCategory = autoCat.category;
        }
      }
    }

    // Fallback to existing category if still not set
    if (!targetCategory && currentTx) {
      targetCategory = currentTx.category;
    }

    const finalCategory = targetCategory || 'Khác';

    // Optimistic update UI + IndexedDB
    setTransactions(prev => prev.map(t =>
      t.id === id ? { ...t, description, category: finalCategory } : t
    ));
    if (selectedTransaction?.id === id) {
      setSelectedTransaction({ ...selectedTransaction, description, category: finalCategory });
    }

    const existing = await OfflineDB.getById<Transaction>('transactions', id);
    if (existing) {
      await OfflineDB.put('transactions', { ...existing, description, category: finalCategory });
    }

    const updatePayload: Record<string, any> = { description, category: finalCategory };

    if (navigator.onLine && !id.startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('transactions')
          .update(updatePayload)
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Online update failed, queuing:', error);
        await SyncService.addToQueue({ table: 'transactions', action: 'UPDATE', data: { id, user_id: user.id, ...updatePayload } });
        await refreshPendingCount();
      }
    } else if (!id.startsWith('temp_')) {
      await SyncService.addToQueue({ table: 'transactions', action: 'UPDATE', data: { id, user_id: user.id, ...updatePayload } });
      await refreshPendingCount();
    }
  };

  const handleGetAiAdvice = async () => {
    if (transactions.length === 0) return;
    setIsAiLoading(true);
    const advice = await getFinancialAdvice(transactions);
    setAiAdvice(advice);
    setIsAiLoading(false);
  };

  // ============================================
  // BUDGET MANAGEMENT FUNCTIONS
  // ============================================





  const handleSaveBudgets = async (newBudgets: Budget[]) => {
    if (!user) return;

    // Optimistic update + cache
    setBudgets(newBudgets);
    await OfflineDB.clearStore('budgets');
    await OfflineDB.putAll('budgets', newBudgets);

    if (navigator.onLine) {
      try {
        // Delete all existing budgets for this user, then insert new ones
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

        // Reload to get server IDs
        await loadBudgets();
      } catch (error) {
        console.error('Online budget save failed, queuing:', error);
        alert('Lỗi lưu ngân sách trực tiếp, sẽ đồng bộ khi có mạng ổn định.');
        // Queue a DELETE + INSERT batch
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
      // Offline: queue for sync
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
  };

  // ============================================
  // DEBT MANAGEMENT FUNCTIONS
  // ============================================





  // Add new debt
  const handleAddDebt = async (newDebt: {
    type: DebtType;
    person_name: string;
    original_amount: number;
    created_date: string;
    due_date?: string;
    description?: string;
  }) => {
    if (!user) {
      alert('Vui lòng đăng nhập để thêm khoản nợ');
      return;
    }

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

    // Optimistic update
    setDebts(prev => [localDebt, ...prev]);
    await OfflineDB.put('debts', localDebt);
    setIsDebtFormOpen(false);

    const supabasePayload = {
      _tempId: tempId,
      user_id: user.id,
      type: newDebt.type,
      person_name: newDebt.person_name,
      original_amount: newDebt.original_amount,
      created_date: newDebt.created_date,
      due_date: newDebt.due_date || null,
      description: newDebt.description || null,
      status: 'pending',
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = supabasePayload;
        const { error } = await supabase.from('debts').insert([serverData]);
        if (error) throw error;
        await loadDebts(); // Reload to get server-generated IDs
      } catch (error) {
        console.error('Online insert failed, queuing:', error);
        await SyncService.addToQueue({ table: 'debts', action: 'INSERT', data: supabasePayload });
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue({ table: 'debts', action: 'INSERT', data: supabasePayload });
      await refreshPendingCount();
    }
  };

  // Delete debt
  const handleDeleteDebt = async (id: string) => {
    if (!user) return;

    setDebts(prev => prev.filter(d => d.id !== id));
    await OfflineDB.deleteById('debts', id);

    if (navigator.onLine && !id.startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('debts')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Online delete failed, queuing:', error);
        await SyncService.addToQueue({ table: 'debts', action: 'DELETE', data: { id, user_id: user.id } });
        await refreshPendingCount();
      }
    } else if (!id.startsWith('temp_')) {
      await SyncService.addToQueue({ table: 'debts', action: 'DELETE', data: { id, user_id: user.id } });
      await refreshPendingCount();
    }
  };

  // Filter debts
  const filteredDebts = useMemo(() => {
    if (debtFilter === 'completed') {
      return debts.filter(d => d.status === 'completed');
    }
    const activeDebts = debts.filter(d => d.status !== 'completed');
    if (debtFilter === 'all') return activeDebts;
    return activeDebts.filter(d => d.type === debtFilter);
  }, [debts, debtFilter]);

  // Debt summary stats
  const debtStats = useMemo(() => {
    const receivable = debts
      .filter(d => d.type === 'receivable')
      .reduce((sum, d) => sum + d.remaining_amount, 0);
    const payable = debts
      .filter(d => d.type === 'payable')
      .reduce((sum, d) => sum + d.remaining_amount, 0);
    return { receivable, payable, net: receivable - payable };
  }, [debts]);

  // ============================================
  // GIFT MONEY TRACKING FUNCTIONS
  // ============================================





  // Add new gift
  const handleAddGift = async (newGift: {
    direction: GiftDirection;
    person_name: string;
    event_type: GiftEventType;
    amount: number;
    event_date: string;
    note?: string;
  }) => {
    if (!user) {
      alert('Vui lòng đăng nhập');
      return;
    }

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
    setIsGiftFormOpen(false);

    const supabasePayload = {
      _tempId: tempId,
      user_id: user.id,
      direction: newGift.direction,
      person_name: newGift.person_name,
      event_type: newGift.event_type,
      amount: newGift.amount,
      event_date: newGift.event_date,
      note: newGift.note || null,
    };

    if (navigator.onLine) {
      try {
        const { _tempId, ...serverData } = supabasePayload;
        const { error } = await supabase.from('gift_records').insert([serverData]);
        if (error) throw error;
        await loadGifts();
      } catch (error) {
        console.error('Online insert failed, queuing:', error);
        await SyncService.addToQueue({ table: 'gift_records', action: 'INSERT', data: supabasePayload });
        await refreshPendingCount();
      }
    } else {
      await SyncService.addToQueue({ table: 'gift_records', action: 'INSERT', data: supabasePayload });
      await refreshPendingCount();
    }
  };

  // Delete gift
  const handleDeleteGift = async (id: string) => {
    if (!user) return;

    setGifts(prev => prev.filter(g => g.id !== id));
    await OfflineDB.deleteById('gift_records', id);

    if (navigator.onLine && !id.startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('gift_records')
          .delete()
          .eq('id', id)
          .eq('user_id', user.id);
        if (error) throw error;
      } catch (error) {
        console.error('Online delete failed, queuing:', error);
        await SyncService.addToQueue({ table: 'gift_records', action: 'DELETE', data: { id, user_id: user.id } });
        await refreshPendingCount();
      }
    } else if (!id.startsWith('temp_')) {
      await SyncService.addToQueue({ table: 'gift_records', action: 'DELETE', data: { id, user_id: user.id } });
      await refreshPendingCount();
    }
  };

  // Filter gifts
  const filteredGifts = useMemo(() => {
    if (giftFilter === 'all') return gifts;
    return gifts.filter(g => g.event_type === giftFilter);
  }, [gifts, giftFilter]);

  // Gift summary stats
  const giftStats = useMemo(() => {
    const given = gifts
      .filter(g => g.direction === 'given')
      .reduce((sum, g) => sum + g.amount, 0);
    const received = gifts
      .filter(g => g.direction === 'received')
      .reduce((sum, g) => sum + g.amount, 0);
    return { given, received, net: received - given };
  }, [gifts]);

  // Compute active notification alerts for bell icon
  const activeAlerts = useMemo<NotificationAlert[]>(() => {
    if (!user) return [];
    return NotificationService.getActiveAlerts(debts, budgets, transactions);
  }, [user, debts, budgets, transactions]);

  // Close notification panel on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationPanelRef.current && !notificationPanelRef.current.contains(e.target as Node)) {
        setIsNotificationPanelOpen(false);
      }
    };
    if (isNotificationPanelOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationPanelOpen]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">💰</span>
          </div>
          <p className="text-gray-500">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!user) {
    return <LoginScreen onLoginSuccess={() => loadTransactions()} isOnline={isOnline} />;
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden safe-bottom">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <span>📡</span> Đang offline — dữ liệu sẽ đồng bộ khi có mạng
          {pendingSyncCount > 0 && (
            <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">
              {pendingSyncCount} chờ đồng bộ
            </span>
          )}
        </div>
      )}

      {/* Syncing Banner */}
      {isSyncing && (
        <div className="bg-blue-500 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2 sticky top-0 z-50">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          Đang đồng bộ dữ liệu...
        </div>
      )}

      {/* Sync Result Toast */}
      {syncResult && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transition-all ${syncResult.failed > 0 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
          }`}>
          <span>{syncResult.failed > 0 ? '⚠️' : '✅'}</span>
          <span>
            Đã đồng bộ {syncResult.processed} mục
            {syncResult.failed > 0 && ` (${syncResult.failed} lỗi)`}
          </span>
          <button onClick={dismissSyncResult} className="ml-2 hover:opacity-70">
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          {/* Top row */}
          <div className="h-14 sm:h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">💰</span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Quản Lý Tài Chính
              </h1>
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={handleGetAiAdvice}
                disabled={isAiLoading || transactions.length === 0}
                className="flex items-center space-x-1 sm:space-x-2 text-sm font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 p-2 touch-target"
              >
                <svg className={`w-5 h-5 ${isAiLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                </svg>
                <span className="hidden sm:inline">{isAiLoading ? 'Đang phân tích...' : 'Phân tích AI'}</span>
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={notificationPanelRef}>
                <button
                  onClick={() => setIsNotificationPanelOpen(prev => !prev)}
                  className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors touch-target"
                  aria-label="Thông báo"
                >
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activeAlerts.length > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                      {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                    </span>
                  )}
                </button>

                {/* Notification Dropdown Panel */}
                {isNotificationPanelOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                    <div className="px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
                      <h3 className="font-semibold text-sm">🔔 Thông báo</h3>
                      <p className="text-xs text-blue-100">{activeAlerts.length > 0 ? `${activeAlerts.length} cảnh báo` : 'Không có cảnh báo'}</p>
                    </div>

                    <div className="max-h-80 overflow-y-auto">
                      {activeAlerts.length === 0 ? (
                        <div className="px-4 py-8 text-center">
                          <span className="text-3xl block mb-2">✅</span>
                          <p className="text-sm text-gray-500">Tất cả đều ổn!</p>
                          <p className="text-xs text-gray-400 mt-1">Không có nợ đến hạn hay ngân sách vượt mức</p>
                        </div>
                      ) : (
                        activeAlerts.map((alert) => (
                          <div
                            key={alert.id}
                            className={`px-4 py-3 border-b border-gray-50 last:border-b-0 flex items-start gap-3 ${alert.severity === 'danger' ? 'bg-rose-50/50' : 'bg-amber-50/30'
                              }`}
                          >
                            <span className="text-lg mt-0.5 flex-shrink-0">{alert.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold ${alert.severity === 'danger' ? 'text-rose-700' : 'text-amber-700'
                                }`}>
                                {alert.title}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5 truncate">{alert.body}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex-shrink-0 ${alert.severity === 'danger'
                                ? 'bg-rose-100 text-rose-600'
                                : 'bg-amber-100 text-amber-600'
                              }`}>
                              {alert.type.includes('debt') ? 'Nợ' : 'NS'}
                            </span>
                          </div>
                        ))
                      )}
                    </div>

                    {activeAlerts.length > 0 && (
                      <div className="px-4 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-[10px] text-gray-400 text-center">Thông báo sẽ được gửi lúc 6:00 AM và 6:00 PM</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Menu */}
              <div className="relative group">
                <button className="flex items-center space-x-2 p-2 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
                    {user.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <svg className="w-4 h-4 text-gray-400 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg border border-gray-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  <div className="p-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.user_metadata?.full_name || 'Người dùng'}</p>
                    <p className="text-xs text-gray-500 truncate">{user.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-3 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Đăng xuất
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation - Desktop */}
          <div className="hidden sm:flex border-t border-gray-100 -mb-px">
            <button
              onClick={() => setCurrentView('dashboard')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'dashboard'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
                Dashboard
              </span>
            </button>
            <button
              onClick={() => setCurrentView('transactions')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'transactions'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Giao dịch
              </span>
            </button>
            <button
              onClick={() => setCurrentView('debts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'debts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                Dư nợ
                {debts.filter(d => d.status !== 'completed').length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {debts.filter(d => d.status !== 'completed').length}
                  </span>
                )}
              </span>
            </button>
            <button
              onClick={() => setCurrentView('gifts')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${currentView === 'gifts'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
              <span className="flex items-center gap-2">
                🎁 Ghi nhớ
                {gifts.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 text-xs px-1.5 py-0.5 rounded-full">
                    {gifts.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 lg:py-8 safe-bottom">
        {/* Dashboard View */}
        {currentView === 'dashboard' && (
          <Dashboard
            transactions={transactions}
            budgets={budgets}
            onEditBudget={() => setIsBudgetModalOpen(true)}
            onMonthClick={(yearMonth) => {
              setFilterMonth(yearMonth);
              setCurrentView('transactions');
            }}
            categories={categories}
            onTransactionClick={setSelectedTransaction}
          />
        )}

        {/* Transactions View */}
        {currentView === 'transactions' && (
          <div className="space-y-6 lg:space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Lịch sử giao dịch</h2>
                <p className="text-xs text-gray-500 mt-0.5">Quản lý thu chi và xem phân tích dòng tiền</p>
              </div>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              <div className="col-span-2 sm:col-span-1">
                <StatsCard title="Số dư hiện tại" amount={stats.balance} type="balance" />
              </div>
              <div className="col-span-1">
                <StatsCard title="Tổng thu nhập" amount={stats.totalIncome} type="income" />
              </div>
              <div className="col-span-1">
                <StatsCard title="Tổng chi tiêu" amount={stats.totalExpense} type="expense" />
              </div>
            </div>

            <div className="main-layout">
              {/* Main Content: History & AI */}
              <div className="space-y-6 lg:space-y-8">
                {/* AI Insights Section */}
                {aiAdvice && (
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-blue-100 shadow-sm relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <svg className="w-16 sm:w-24 h-16 sm:h-24" fill="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-blue-900 mb-2 flex items-center">
                      <span className="mr-2">✨</span> Lời khuyên từ AI
                    </h2>
                    <p className="text-sm sm:text-base text-blue-800 mb-4">{aiAdvice.summary}</p>
                    <div className="space-y-2">
                      {aiAdvice.tips.map((tip, idx) => (
                        <div key={idx} className="flex items-start bg-white/60 p-3 rounded-xl border border-white/40">
                          <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold mr-3 mt-0.5">
                            {idx + 1}
                          </span>
                          <p className="text-xs sm:text-sm text-gray-700">{tip}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Charts Section */}
                <div className="charts-grid hidden sm:grid">
                  <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Chi tiêu theo mục</h3>
                    <div className="chart-container">
                      {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={pieData}
                              innerRadius="50%"
                              outerRadius="70%"
                              paddingAngle={5}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN') + ' VND'} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                          Chưa có dữ liệu chi tiêu
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="card p-4 sm:p-6">
                    <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-4">Dòng tiền gần đây</h3>
                    <div className="chart-container">
                      {barData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={barData}>
                            <XAxis dataKey="date" fontSize={10} tickMargin={8} />
                            <YAxis hide />
                            <Tooltip formatter={(value: number) => value.toLocaleString('vi-VN')} />
                            <Legend wrapperStyle={{ fontSize: '12px' }} />
                            <Bar dataKey="income" name="Thu" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="expense" name="Chi" fill="#ef4444" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                          Chưa có dữ liệu giao dịch
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Transaction List */}
                <div className="card overflow-hidden">
                  <div className="sticky top-[56px] sm:top-[64px] z-20 bg-white border-b border-gray-100 shadow-sm">
                    <div className="p-4 sm:p-6 flex flex-col gap-4">
                      <div className="flex justify-between items-center">
                        <h3 className="text-base sm:text-lg font-bold text-gray-800">Lịch sử giao dịch</h3>
                        <span className="text-xs sm:text-sm text-gray-500">
                          {(() => {
                            const displayTx = transactions.filter(t => {
                              if (filterMonth && !t.date.startsWith(filterMonth)) return false;
                              if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
                              if (searchTerm) {
                                const q = searchTerm.toLowerCase();
                                return t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.amount.toString().includes(q);
                              }
                              return true;
                            });
                            return `${displayTx.length} giao dịch`;
                          })()}
                        </span>
                      </div>

                      {/* Search and Quick Filters */}
                      <div className="flex flex-col sm:flex-row gap-3">
                        {/* Search input */}
                        <div className="relative flex-1">
                          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                          </span>
                          <input
                            type="text"
                            placeholder="Tìm kiếm giao dịch..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                          />
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Type filter tags */}
                        <div className="w-full sm:w-auto flex bg-gray-100 p-0.5 rounded-xl overflow-x-auto scrollbar-none">
                          <button
                            onClick={() => setTypeFilter('ALL')}
                            className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'ALL'
                                ? 'bg-white text-gray-800 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Tất cả
                          </button>
                          <button
                            onClick={() => setTypeFilter('INCOME')}
                            className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'INCOME'
                                ? 'bg-white text-emerald-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Thu nhập
                          </button>
                          <button
                            onClick={() => setTypeFilter('EXPENSE')}
                            className={`flex-1 sm:flex-initial text-center px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                              typeFilter === 'EXPENSE'
                                ? 'bg-white text-rose-600 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700'
                            }`}
                          >
                            Chi tiêu
                          </button>
                        </div>
                      </div>
                    </div>
                    {/* Month filter banner */}
                    {filterMonth && (
                      <div className="px-4 sm:px-6 py-2 bg-blue-50 border-t border-blue-100 flex items-center justify-between">
                        <span className="text-sm text-blue-700 font-medium">
                          📅 Tháng {parseInt(filterMonth.split('-')[1])}/{filterMonth.split('-')[0]}
                        </span>
                        <button
                          onClick={() => setFilterMonth(null)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors"
                        >
                          Xem tất cả ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    {(() => {
                      const displayTx = transactions.filter(t => {
                        if (filterMonth && !t.date.startsWith(filterMonth)) return false;
                        if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;
                        if (searchTerm) {
                          const q = searchTerm.toLowerCase();
                          return t.category.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.amount.toString().includes(q);
                        }
                        return true;
                      });
                      return displayTx.length > 0 ? (
                        (() => {
                          const grouped: Record<string, typeof transactions> = {};
                          displayTx.forEach(tx => {
                            if (!grouped[tx.date]) grouped[tx.date] = [];
                            grouped[tx.date].push(tx);
                          });
                          return Object.entries(grouped).map(([date, txs]) => {
                            const d = new Date(date);
                            const formatted = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                            return (
                              <div key={date}>
                                <div className="px-4 py-2.5 bg-slate-50 border-y border-slate-100 flex justify-between items-center mt-4 first:mt-0">
                                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                                    <span className="text-sm">📅</span> {formatted}
                                  </span>
                                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-200/60 px-2 py-0.5 rounded-full">
                                    {txs.length} giao dịch
                                  </span>
                                </div>
                                <div className="divide-y divide-gray-50">
                                  {txs.map(tx => {
                                    const cat = categories.find(c => c.name === tx.category);
                                    const emoji = cat?.icon || (tx.type === 'INCOME' ? '💵' : '💸');
                                    return (
                                      <div
                                        key={tx.id}
                                        className="transaction-item group cursor-pointer hover:bg-gray-50"
                                        onClick={() => setSelectedTransaction(tx)}
                                      >
                                        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0 flex-1">
                                          <div className={`w-10 h-10 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-base sm:text-lg ${
                                            tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                          }`}>
                                            {emoji}
                                          </div>
                                          <div className="min-w-0 flex-1">
                                            <p className="font-semibold text-gray-800 text-sm sm:text-base truncate">{tx.category}</p>
                                            <p className="text-xs text-gray-400 truncate">{formatDescription(tx.description)}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center space-x-2 sm:space-x-4 flex-shrink-0 ml-3">
                                          <div className="flex flex-col items-end">
                                            <p className={`font-bold text-right text-sm sm:text-base whitespace-nowrap ${
                                              tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                                            }`}>
                                              {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')}đ
                                            </p>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md mt-0.5 ${
                                              tx.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                                            }`}>
                                              {tx.type === 'INCOME' ? 'THU' : 'CHI'}
                                            </span>
                                          </div>
                                          <button
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx.id); }}
                                            className="transaction-delete-btn text-gray-300 hover:text-rose-500 transition-all touch-target flex items-center justify-center"
                                            aria-label="Xóa giao dịch"
                                          >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                            </svg>
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          });
                        })()
                      ) : (
                        <div className="p-8 sm:p-12 text-center text-gray-400">
                          <div className="text-4xl mb-3">📊</div>
                          <p className="text-sm sm:text-base">
                            {filterMonth ? 'Không có giao dịch trong tháng này' : 'Bạn chưa có giao dịch nào.'}
                          </p>
                          {!filterMonth && <p className="text-xs sm:text-sm mt-1">Hãy nhấn nút bên dưới để thêm mới!</p>}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Mobile Tips Toggle */}
                <div className="tips-toggle-mobile">
                  <button
                    onClick={() => setShowTips(!showTips)}
                    className="w-full card p-4 flex items-center justify-between text-left"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">💡</span>
                      <span className="font-medium text-gray-800">Mẹo tài chính</span>
                    </div>
                    <svg className={`w-5 h-5 text-gray-400 transition-transform ${showTips ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {showTips && (
                    <div className="card mt-2 p-4 space-y-4">
                      <TipItem emoji="💡" color="amber" text="Luôn trích ra 20% thu nhập để tiết kiệm trước khi chi tiêu." />
                      <TipItem emoji="📊" color="blue" text="Phân loại chi tiêu giúp bạn biết tiền đang 'chảy' đi đâu." />
                      <TipItem emoji="🎯" color="emerald" text="Đặt ra mục tiêu tiết kiệm cụ thể cho cuối năm nay." />
                    </div>
                  )}
                </div>
              </div>

              {/* Sidebar Area - Desktop only */}
              <div className="sidebar-tips space-y-8">
                <div className="card p-6">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Mẹo nhanh</h3>
                  <ul className="space-y-4">
                    <TipItem emoji="💡" color="amber" text="Luôn trích ra 20% thu nhập để tiết kiệm trước khi chi tiêu." />
                    <TipItem emoji="📊" color="blue" text="Phân loại chi tiêu giúp bạn biết tiền đang 'chảy' đi đâu." />
                    <TipItem emoji="🎯" color="emerald" text="Đặt ra mục tiêu tiết kiệm cụ thể cho cuối năm nay." />
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Debts View */}
        {currentView === 'debts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Quản lý dư nợ</h2>
                <p className="text-xs text-gray-500 mt-0.5">Theo dõi các khoản người khác nợ mình và mình nợ người khác</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📥</span>
                  <p className="text-xs text-emerald-600 font-medium">Dư nợ có</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">
                  +{debtStats.receivable.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  {debts.filter(d => d.type === 'receivable' && d.status !== 'completed').length} khoản
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📤</span>
                  <p className="text-xs text-rose-600 font-medium">Dư nợ còn</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-rose-700">
                  -{debtStats.payable.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-rose-500 mt-1">
                  {debts.filter(d => d.type === 'payable' && d.status !== 'completed').length} khoản
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💰</span>
                  <p className="text-xs text-blue-600 font-medium">Công nợ ròng</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${debtStats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {debtStats.net >= 0 ? '+' : ''}{debtStats.net.toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>

            {/* Filter Buttons */}
            <div className="w-full max-w-full flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setDebtFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả ({debts.filter(d => d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('receivable')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'receivable'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  }`}
              >
                📥 Người khác nợ mình ({debts.filter(d => d.type === 'receivable' && d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('payable')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'payable'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                  }`}
              >
                📤 Mình nợ người khác ({debts.filter(d => d.type === 'payable' && d.status !== 'completed').length})
              </button>
              <button
                onClick={() => setDebtFilter('completed')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${debtFilter === 'completed'
                  ? 'bg-slate-600 text-white'
                  : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
              >
                ✅ Đã hoàn thành ({debts.filter(d => d.status === 'completed').length})
              </button>
            </div>

            {/* Debt List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  Danh sách khoản nợ
                </h3>
                <button
                  onClick={() => setIsDebtFormOpen(true)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm mới
                </button>
              </div>

              {filteredDebts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredDebts.map(debt => (
                    <DebtCard
                      key={debt.id}
                      debt={debt}
                      onClick={() => setSelectedDebt(debt)}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">💳</div>
                  <p className="text-gray-600 mb-2">
                    {debtFilter === 'all'
                      ? 'Chưa có khoản nợ nào'
                      : debtFilter === 'receivable'
                        ? 'Chưa có ai nợ bạn'
                        : debtFilter === 'payable'
                          ? 'Bạn chưa nợ ai'
                          : 'Chưa có khoản nợ nào đã hoàn thành'
                    }
                  </p>
                  {debtFilter !== 'completed' && (
                    <button
                      onClick={() => setIsDebtFormOpen(true)}
                      className="text-blue-600 font-medium hover:text-blue-700"
                    >
                      Thêm khoản nợ ngay
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Gifts View */}
        {currentView === 'gifts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Sổ tay ghi nhớ quà tặng</h2>
                <p className="text-xs text-gray-500 mt-0.5">Ghi nhớ tiền hiếu hỉ, quà tặng đã trao đi hoặc nhận lại</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="card p-4 bg-gradient-to-br from-rose-50 to-rose-100 border-rose-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📤</span>
                  <p className="text-xs text-rose-600 font-medium">Tiền đưa</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-rose-700">
                  -{giftStats.given.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-rose-500 mt-1">
                  {gifts.filter(g => g.direction === 'given').length} lần
                </p>
              </div>
              <div className="card p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📥</span>
                  <p className="text-xs text-emerald-600 font-medium">Tiền nhận</p>
                </div>
                <p className="text-lg sm:text-xl font-bold text-emerald-700">
                  +{giftStats.received.toLocaleString('vi-VN')}đ
                </p>
                <p className="text-xs text-emerald-500 mt-1">
                  {gifts.filter(g => g.direction === 'received').length} lần
                </p>
              </div>
              <div className={`card p-4 bg-gradient-to-br ${giftStats.net >= 0 ? 'from-emerald-50 to-emerald-100 border-emerald-200' : 'from-rose-50 to-rose-100 border-rose-200'} col-span-2 sm:col-span-1`}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">📊</span>
                  <p className="text-xs text-gray-600 font-medium">Chênh lệch</p>
                </div>
                <p className={`text-lg sm:text-xl font-bold ${giftStats.net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {giftStats.net >= 0 ? '+' : ''}{giftStats.net.toLocaleString('vi-VN')}đ
                </p>
              </div>
            </div>

            {/* Filter by Event Type */}
            <div className="w-full max-w-full flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setGiftFilter('all')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${giftFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
              >
                Tất cả ({gifts.length})
              </button>
              {Object.entries(GIFT_EVENT_TYPES).map(([key, { label, icon }]) => {
                const count = gifts.filter(g => g.event_type === key).length;
                if (count === 0 && giftFilter !== key) return null;
                return (
                  <button
                    key={key}
                    onClick={() => setGiftFilter(key as GiftEventType)}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${giftFilter === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {icon} {label} ({count})
                  </button>
                );
              })}
            </div>

            {/* Gift List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-bold text-gray-800">
                  Lịch sử ghi nhớ
                </h3>
                <button
                  onClick={() => setIsGiftFormOpen(true)}
                  className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm mới
                </button>
              </div>

              {filteredGifts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredGifts.map(gift => (
                    <GiftCard
                      key={gift.id}
                      gift={gift}
                      onClick={() => setSelectedGift(gift)}
                    />
                  ))}
                </div>
              ) : (
                <div className="card p-8 text-center">
                  <div className="text-4xl mb-3">🎁</div>
                  <p className="text-gray-600 mb-2">
                    {giftFilter === 'all'
                      ? 'Chưa có ghi nhớ nào'
                      : `Chưa có sự kiện ${GIFT_EVENT_TYPES[giftFilter]?.label || ''} nào`
                    }
                  </p>
                  <button
                    onClick={() => setIsGiftFormOpen(true)}
                    className="text-blue-600 font-medium hover:text-blue-700"
                  >
                    Thêm ghi nhớ ngay
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Desktop FAB */}
      <div className="hidden sm:block fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
        <button
          onClick={() => setIsFormOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 group"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 transform group-hover:rotate-90 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
          </svg>
          <span className="font-bold text-sm sm:text-base">Thêm Giao Dịch</span>
        </button>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-100 sm:hidden z-40">
        <div className="flex items-center justify-around py-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <button
            onClick={() => setCurrentView('dashboard')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'dashboard' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'dashboard' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Tổng quan
            </span>
          </button>

          <button
            onClick={() => setCurrentView('transactions')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'transactions' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'transactions' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Giao dịch
            </span>
          </button>

          <button
            onClick={() => {
              if (currentView === 'debts') setIsDebtFormOpen(true);
              else if (currentView === 'gifts') setIsGiftFormOpen(true);
              else setIsFormOpen(true);
            }}
            className="flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full shadow-lg shadow-blue-500/30 -mt-5 text-white active:scale-95 transition-transform"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path>
            </svg>
          </button>

          <button
            onClick={() => setCurrentView('debts')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'debts' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'debts' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Dư nợ
            </span>
          </button>

          <button
            onClick={() => setCurrentView('gifts')}
            className="flex flex-col items-center justify-center flex-1 py-1"
          >
            <div className={`flex items-center justify-center w-12 h-7 rounded-full transition-all ${
              currentView === 'gifts' ? 'bg-blue-50 text-blue-600 scale-105' : 'text-gray-400'
            }`}>
              <span className="text-base">🎁</span>
            </div>
            <span className={`text-[10px] mt-1 transition-all ${
              currentView === 'gifts' ? 'text-blue-600 font-bold' : 'text-gray-400 font-medium'
            }`}>
              Ghi nhớ
            </span>
          </button>
        </div>
      </div>

      {/* Modal Form */}
      {isFormOpen && (
        <TransactionForm
          onAdd={handleAddTransaction}
          onClose={() => setIsFormOpen(false)}
          categories={categories}
          onOpenCategoryMgmt={() => setIsCategoryMgmtOpen(true)}
        />
      )}

      {/* Budget Modal */}
      {isBudgetModalOpen && (
        <BudgetModal
          budgets={budgets}
          onSave={handleSaveBudgets}
          onClose={() => setIsBudgetModalOpen(false)}
          categories={categories}
          onOpenCategoryMgmt={() => setIsCategoryMgmtOpen(true)}
        />
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
        <TransactionDetail
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
          onDelete={handleDeleteTransaction}
          onUpdateTransaction={handleUpdateTransaction}
          categories={categories}
        />
      )}

      {/* Category Management Modal */}
      {isCategoryMgmtOpen && (
        <CategoryModal
          categories={categories}
          transactions={transactions}
          budgets={budgets}
          onCategoriesChange={handleCategoriesChange}
          onClose={() => setIsCategoryMgmtOpen(false)}
        />
      )}

      {/* Debt Form Modal */}
      {isDebtFormOpen && (
        <DebtForm
          onSubmit={handleAddDebt}
          onClose={() => setIsDebtFormOpen(false)}
        />
      )}

      {/* Debt Detail Modal */}
      {selectedDebt && (
        <DebtDetail
          debt={selectedDebt}
          onClose={() => setSelectedDebt(null)}
          onUpdate={() => {
            loadDebts();
            setSelectedDebt(null);
          }}
          onDelete={handleDeleteDebt}
        />
      )}

      {/* Gift Form Modal */}
      {isGiftFormOpen && (
        <GiftForm
          onSubmit={handleAddGift}
          onClose={() => setIsGiftFormOpen(false)}
          allGifts={gifts}
        />
      )}

      {/* Gift Detail Modal */}
      {selectedGift && (
        <GiftDetail
          gift={selectedGift}
          allGifts={gifts}
          onClose={() => setSelectedGift(null)}
          onDelete={handleDeleteGift}
        />
      )}
    </div>
  );
};

// Tip Item Component – uses static class map to avoid Tailwind purge issues
const TIP_COLOR_MAP: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-600',
  blue: 'bg-blue-100 text-blue-600',
  emerald: 'bg-emerald-100 text-emerald-600',
};

const TipItem: React.FC<{ emoji: string; color: string; text: string }> = ({ emoji, color, text }) => (
  <li className="flex items-start">
    <span className={`${TIP_COLOR_MAP[color] || 'bg-gray-100 text-gray-600'} p-2 rounded-lg mr-3 flex-shrink-0`}>{emoji}</span>
    <p className="text-sm text-gray-600">{text}</p>
  </li>
);

export default App;
