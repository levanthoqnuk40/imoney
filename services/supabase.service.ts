import { createClient } from '@supabase/supabase-js';

// Supabase Configuration - using environment variables for security
// IMPORTANT: Never hardcode credentials in source code
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create Supabase client with explicit public schema
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    db: {
        schema: 'public'
    }
});

// ============================================
// USER OPERATIONS
// ============================================

export interface User {
    id?: string;
    email: string;
    full_name: string;
    role?: string;
    department?: string;
    created_at?: string;
    updated_at?: string;
}

export const UserService = {
    // Get all users
    async getAll() {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    },

    // Get user by ID
    async getById(id: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // Get user by email
    async getByEmail(email: string) {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('email', email)
            .single();

        if (error) throw error;
        return data;
    },

    // Create new user
    async create(user: User) {
        const { data, error } = await supabase
            .from('users')
            .insert([user])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Update user
    async update(id: string, updates: Partial<User>) {
        const { data, error } = await supabase
            .from('users')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Delete user
    async delete(id: string) {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    }
};

// ============================================
// TRANSACTION OPERATIONS
// ============================================

export interface Transaction {
    id?: string;
    user_id: string;
    type: 'income' | 'expense';
    amount: number;
    currency?: string;
    category?: string;
    description?: string;
    transaction_date: string;
    created_at?: string;
    updated_at?: string;
}

export const TransactionService = {
    // Get all transactions
    async getAll(userId?: string) {
        let query = supabase
            .from('transactions')
            .select('*')
            .order('transaction_date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Get transaction by ID
    async getById(id: string) {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    },

    // Get transactions by date range
    async getByDateRange(startDate: string, endDate: string, userId?: string) {
        let query = supabase
            .from('transactions')
            .select('*')
            .gte('transaction_date', startDate)
            .lte('transaction_date', endDate)
            .order('transaction_date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Create new transaction
    async create(transaction: Transaction) {
        const { data, error } = await supabase
            .from('transactions')
            .insert([transaction])
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Update transaction
    async update(id: string, updates: Partial<Transaction>) {
        const { data, error } = await supabase
            .from('transactions')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    // Delete transaction
    async delete(id: string) {
        const { error } = await supabase
            .from('transactions')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    // Get summary (total income, expense, balance)
    async getSummary(userId?: string, startDate?: string, endDate?: string) {
        let query = supabase.from('transactions').select('type, amount');

        if (userId) query = query.eq('user_id', userId);
        if (startDate) query = query.gte('transaction_date', startDate);
        if (endDate) query = query.lte('transaction_date', endDate);

        const { data, error } = await query;
        if (error) throw error;

        const summary = {
            totalIncome: 0,
            totalExpense: 0,
            balance: 0
        };

        data?.forEach(t => {
            if (t.type === 'income') {
                summary.totalIncome += t.amount;
            } else {
                summary.totalExpense += t.amount;
            }
        });

        summary.balance = summary.totalIncome - summary.totalExpense;
        return summary;
    }
};

// ============================================
// INVOICE OPERATIONS
// ============================================

export interface Invoice {
    id?: string;
    user_id: string;
    invoice_number: string;
    vendor_name?: string;
    customer_name?: string;
    type: 'incoming' | 'outgoing';
    status: 'draft' | 'pending' | 'approved' | 'rejected' | 'paid';
    amount: number;
    vat_amount?: number;
    total_amount: number;
    currency?: string;
    invoice_date: string;
    due_date?: string;
    description?: string;
    items?: InvoiceItem[];
    created_at?: string;
    updated_at?: string;
}

export interface InvoiceItem {
    id?: string;
    invoice_id?: string;
    description: string;
    quantity: number;
    unit_price: number;
    amount: number;
    vat_rate?: number;
    vat_amount?: number;
}

export const InvoiceService = {
    // Get all invoices
    async getAll(userId?: string) {
        let query = supabase
            .from('invoices')
            .select('*')
            .order('invoice_date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Get invoice by ID with items
    async getById(id: string) {
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Get invoice items
        const { data: items } = await supabase
            .from('invoice_items')
            .select('*')
            .eq('invoice_id', id);

        return { ...invoice, items: items || [] };
    },

    // Get invoices by status
    async getByStatus(status: Invoice['status'], userId?: string) {
        let query = supabase
            .from('invoices')
            .select('*')
            .eq('status', status)
            .order('invoice_date', { ascending: false });

        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    // Create new invoice with items
    async create(invoice: Invoice) {
        const { items, ...invoiceData } = invoice;

        // Insert invoice
        const { data: createdInvoice, error } = await supabase
            .from('invoices')
            .insert([invoiceData])
            .select()
            .single();

        if (error) throw error;

        // Insert items if provided
        if (items && items.length > 0) {
            const itemsWithInvoiceId = items.map(item => ({
                ...item,
                invoice_id: createdInvoice.id
            }));

            await supabase.from('invoice_items').insert(itemsWithInvoiceId);
        }

        return createdInvoice;
    },

    // Update invoice
    async update(id: string, updates: Partial<Invoice>) {
        const { items, ...invoiceUpdates } = updates;

        const { data, error } = await supabase
            .from('invoices')
            .update({ ...invoiceUpdates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;

        // Update items if provided
        if (items) {
            // Delete existing items and insert new ones
            await supabase.from('invoice_items').delete().eq('invoice_id', id);

            if (items.length > 0) {
                const itemsWithInvoiceId = items.map(item => ({
                    ...item,
                    invoice_id: id
                }));
                await supabase.from('invoice_items').insert(itemsWithInvoiceId);
            }
        }

        return data;
    },

    // Update invoice status
    async updateStatus(id: string, status: Invoice['status']) {
        return this.update(id, { status });
    },

    // Delete invoice
    async delete(id: string) {
        // Delete items first
        await supabase.from('invoice_items').delete().eq('invoice_id', id);

        // Delete invoice
        const { error } = await supabase
            .from('invoices')
            .delete()
            .eq('id', id);

        if (error) throw error;
        return true;
    },

    // Generate invoice number
    generateInvoiceNumber(prefix = 'INV') {
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${prefix}-${year}${month}-${random}`;
    }
};

// ============================================
// STORAGE OPERATIONS (Receipt Images)
// ============================================

export const StorageService = {
    // Upload receipt image to Supabase Storage
    async uploadReceipt(file: File): Promise<string | null> {
        try {
            // Generate unique filename
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
            const filePath = `receipts/${fileName}`;

            // Upload to Supabase Storage
            const { data, error } = await supabase.storage
                .from('receipts')
                .upload(filePath, file, {
                    cacheControl: '3600',
                    upsert: false
                });

            if (error) {
                console.error('Upload error:', error);
                return null;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
                .from('receipts')
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading receipt:', error);
            return null;
        }
    },

    // Delete receipt image from Storage
    async deleteReceipt(url: string): Promise<boolean> {
        try {
            // Extract file path from URL
            const urlParts = url.split('/receipts/');
            if (urlParts.length < 2) return false;

            const filePath = `receipts/${urlParts[1]}`;

            const { error } = await supabase.storage
                .from('receipts')
                .remove([filePath]);

            if (error) {
                console.error('Delete error:', error);
                return false;
            }
            return true;
        } catch (error) {
            console.error('Error deleting receipt:', error);
            return false;
        }
    },

    // Convert File to base64 for preview
    fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }
};

// Export all services
export default {
    supabase,
    UserService,
    TransactionService,
    InvoiceService,
    StorageService
};
