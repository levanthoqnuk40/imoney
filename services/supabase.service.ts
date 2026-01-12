import { createClient } from '@supabase/supabase-js';

// ============================================
// SUPABASE CONFIGURATION
// ============================================

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables
if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables. Please check your .env.local file.');
}

// Create Supabase client
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    db: {
        schema: 'public'
    }
});

// ============================================
// STORAGE SERVICE (for receipt uploads)
// ============================================

export const StorageService = {
    /**
     * Upload receipt image to Supabase Storage
     */
    async uploadReceipt(file: File): Promise<string | null> {
        try {
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `${Date.now()}_${crypto.randomUUID()}.${fileExt}`;
            const filePath = `receipts/${fileName}`;

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

            const { data: urlData } = supabase.storage
                .from('receipts')
                .getPublicUrl(data.path);

            return urlData.publicUrl;
        } catch (error) {
            console.error('Error uploading receipt:', error);
            return null;
        }
    },

    /**
     * Delete receipt image from Storage
     */
    async deleteReceipt(url: string): Promise<boolean> {
        try {
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

    /**
     * Convert File to base64 for preview
     */
    fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    }
};
