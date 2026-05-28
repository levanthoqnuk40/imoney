
import React, { useState, useRef } from 'react';
import { Transaction, TransactionType } from '../types';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '../constants';
import { StorageService } from '../services/supabase.service';

interface TransactionFormProps {
  onAdd: (transaction: Omit<Transaction, 'id'>) => void;
  onClose: () => void;
}

const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
};

const KEYWORD_MAP: Record<string, { type: TransactionType; category: string; keywords: string[] }> = {
  'Lương': {
    type: 'INCOME',
    category: 'Lương',
    keywords: ['luong', 'salary', 'thu nhap', 'payroll', 'paycheck', 'chuyen khoan luong', 'chuyen khoan nhan luong']
  },
  'Thưởng': {
    type: 'INCOME',
    category: 'Thưởng',
    keywords: ['thuong', 'bonus', 'commission', 'hoa hong']
  },
  'Đầu tư': {
    type: 'INCOME',
    category: 'Đầu tư',
    keywords: ['co phieu', 'stock', 'lai dau tu', 'crypto', 'coin', 'dividend', 'co tuc']
  },
  'Kinh doanh': {
    type: 'INCOME',
    category: 'Kinh doanh',
    keywords: ['ban hang', 'kinh doanh', 'doanh thu', 'revenue', 'khach hang thanh toan', 'tien hang']
  },
  'Ăn uống': {
    type: 'EXPENSE',
    category: 'Ăn uống',
    keywords: ['cafe', 'coffee', 'starbucks', 'highlands', 'an uong', 'an sang', 'an toi', 'an trua', 'nha hang', 'tra sua', 'gong cha', 'dingtea', 'phuc long', 'kfc', 'lotteria', 'mcdonald', 'pizza', 'lau', 'nuong', 'com', 'pho', 'bun', 'grocery', 'cho', 'sieu thi', 'coopmart', 'winmart', 'bachhoa', 'foody', 'shopeefood', 'grabfood', 'baemin']
  },
  'Di chuyển': {
    type: 'EXPENSE',
    category: 'Di chuyển',
    keywords: ['xang', 'gas', 'petrol', 'grab', 'be ', 'gojek', 'taxi', 've xe', 've tau', 've may bay', 'airline', 'xe bus', 'gui xe', 'do xe', 'bao duong xe', 'sua xe']
  },
  'Nhà ở': {
    type: 'EXPENSE',
    category: 'Nhà ở',
    keywords: ['tien nha', 'tien phong', 'thue nha', 'nha o', 'dien nuoc', 'tien dien', 'tien nuoc', 'internet', 'wifi', 'chung cu', 'phi quan ly', 'phi dich vu', 'sua nha']
  },
  'Giải trí': {
    type: 'EXPENSE',
    category: 'Giải trí',
    keywords: ['netflix', 'spotify', 'youtube premium', 'rap phim', 'cgv', 'lotte cinema', 'xem phim', 'du lich', 'travel', 'khach san', 'hotel', 've may bay du lich', 've tham quan', 'karaoke', 'bar', 'club', 'game', 'nap game', 'steam', 'playstation', 'nintendo', 'concert']
  },
  'Mua sắm': {
    type: 'EXPENSE',
    category: 'Mua sắm',
    keywords: ['mua sam', 'shopee', 'lazada', 'tiki', 'shopping', 'quan ao', 'giay dep', 'quan jean', 'ao thun', 'ao khoac', 'tui xach', 'my pham', 'makeup', 'skincare', 'dien thoai', 'laptop', 'ipad', 'phu kien', 'tivi', 'tu lanh', 'gia dung']
  },
  'Sức khỏe': {
    type: 'EXPENSE',
    category: 'Sức khỏe',
    keywords: ['thuoc', 'pharmacy', 'nha thuoc', 'benh vien', 'hospital', 'kham benh', 'nha khoa', 'rang', 'phong kham', 'bao hiem', 'insurance', 'gym', 'california fitness', 'fitness', 'yoga', 'spa', 'massage']
  },
  'Giáo dục': {
    type: 'EXPENSE',
    category: 'Giáo dục',
    keywords: ['hoc phi', 'tuition', 'khoa hoc', 'course', 'tieng anh', 'ielts', 'toeic', 'sach', 'book', 'van phong pham', 'dung cu hoc tap', 'truong hoc', 'dai hoc', 'udemy', 'coursera']
  }
};

const autoCategorize = (desc: string): { type: TransactionType; category: string } | null => {
  const cleanDesc = removeAccents(desc);
  for (const catName of Object.keys(KEYWORD_MAP)) {
    const item = KEYWORD_MAP[catName];
    for (const keyword of item.keywords) {
      const cleanKeyword = removeAccents(keyword);
      if (cleanDesc.includes(cleanKeyword)) {
        return { type: item.type, category: item.category };
      }
    }
  }
  return null;
};

const TransactionForm: React.FC<TransactionFormProps> = ({ onAdd, onClose }) => {
  const [type, setType] = useState<TransactionType>('EXPENSE');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [hasManuallySelected, setHasManuallySelected] = useState(false);

  const handleDescriptionChange = (val: string) => {
    setDescription(val);
    if (!hasManuallySelected && val.trim().length > 1) {
      const result = autoCategorize(val);
      if (result) {
        setType(result.type);
        setCategory(result.category);
      }
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Allowed file types and max size for receipt uploads
  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, HEIC)');
        e.target.value = '';
        return;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert('File quá lớn. Tối đa 5MB');
        e.target.value = '';
        return;
      }

      setReceiptFile(file);
      const preview = await StorageService.fileToBase64(file);
      setReceiptPreview(preview);
    }
  };

  const handleRemoveReceipt = () => {
    setReceiptFile(null);
    setReceiptPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setIsUploading(true);

    let receiptUrl: string | undefined;

    // Upload receipt if exists
    if (receiptFile) {
      if (navigator.onLine) {
        const url = await StorageService.uploadReceipt(receiptFile);
        if (url) receiptUrl = url;
      } else {
        // Offline: pass the base64 preview as receipt_url placeholder
        // The sync service will handle the actual upload later
        receiptUrl = receiptPreview || undefined;
      }
    }

    onAdd({
      amount: parseFloat(amount),
      category,
      description,
      date,
      type,
      receipt_url: receiptUrl
    });

    setIsUploading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md max-h-[90vh] flex flex-col modal-content modal-fullscreen-mobile">
        {/* Header - Fixed */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Thêm Giao Dịch Mới</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-2 -mr-2 touch-target"
            aria-label="Đóng"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Type Toggle */}
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => { setType('EXPENSE'); setCategory(EXPENSE_CATEGORIES[0]); setHasManuallySelected(true); }}
              className={`flex-1 py-3 sm:py-2 text-sm font-medium rounded-lg transition-all touch-target ${type === 'EXPENSE' ? 'bg-white text-rose-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Chi tiêu
            </button>
            <button
              type="button"
              onClick={() => { setType('INCOME'); setCategory(INCOME_CATEGORIES[0]); setHasManuallySelected(true); }}
              className={`flex-1 py-3 sm:py-2 text-sm font-medium rounded-lg transition-all touch-target ${type === 'INCOME' ? 'bg-white text-emerald-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              Thu nhập
            </button>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số tiền (VND)</label>
            <input
              type="number"
              inputMode="numeric"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-base"
              placeholder="0"
            />
            {amount && parseFloat(amount) > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                = <span className="font-medium text-gray-700">{parseFloat(amount).toLocaleString('vi-VN')}</span> VND
              </p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Danh mục</label>
            <select
              value={category}
              onChange={(e) => { setCategory(e.target.value); setHasManuallySelected(true); }}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base appearance-none bg-white"
            >
              {(type === 'EXPENSE' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ngày</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú</label>
            <input
              type="text"
              value={description}
              onChange={(e) => handleDescriptionChange(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base"
              placeholder="VD: Mua cafe sáng"
            />
            {/* Auto-categorization alert badge */}
            {!hasManuallySelected && description.trim().length > 1 && autoCategorize(description) && (
              <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1 animate-pulse">
                <span>💡</span> Tự động nhận diện danh mục: <strong className="text-blue-700 font-bold">{autoCategorize(description)?.category}</strong>
              </p>
            )}
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Hoá đơn <span className="text-gray-400 font-normal">(tuỳ chọn)</span>
            </label>

            {!receiptPreview ? (
              <div className="flex gap-2">
                {/* Camera button */}
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all touch-target"
                >
                  <span className="text-xl">📷</span>
                  <span className="text-sm text-gray-600">Chụp ảnh</span>
                </button>

                {/* Gallery button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all touch-target"
                >
                  <span className="text-xl">🖼️</span>
                  <span className="text-sm text-gray-600">Thư viện</span>
                </button>

                {/* Hidden inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative">
                <img
                  src={receiptPreview}
                  alt="Preview hoá đơn"
                  className="w-full h-40 object-cover rounded-xl border border-gray-200"
                />
                <button
                  type="button"
                  onClick={handleRemoveReceipt}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                  aria-label="Xoá ảnh"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  {receiptFile?.name}
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isUploading}
            className={`w-full py-4 sm:py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] touch-target disabled:opacity-70 disabled:transform-none ${type === 'EXPENSE' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'
              }`}
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Đang lưu...
              </span>
            ) : (
              'Lưu giao dịch'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
