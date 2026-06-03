import React, { useState, useEffect, useRef } from 'react';
import { ExpenseEvent, ExpenseParticipant, ExpenseSplit, Category } from '../types';
import { StorageService } from '../services/supabase.service';

interface SharedExpenseFormProps {
  onSubmit: (
    eventData: Omit<ExpenseEvent, 'id' | 'user_id' | 'status'> & { receiptFile?: File | null; receiptPreview?: string | null },
    participants: Omit<ExpenseParticipant, 'id' | 'event_id'>[],
    splits: { participantIndex: number; amountDue: number }[],
    ownerCategory?: string
  ) => void;
  onClose: () => void;
  categories: Category[];
  initialEvent?: ExpenseEvent;
  initialParticipants?: ExpenseParticipant[];
  initialSplits?: ExpenseSplit[];
}

export const SharedExpenseForm: React.FC<SharedExpenseFormProps> = ({ 
  onSubmit, 
  onClose, 
  categories,
  initialEvent,
  initialParticipants,
  initialSplits
}) => {
  const [title, setTitle] = useState(initialEvent?.title || '');
  const [totalAmount, setTotalAmount] = useState(initialEvent?.total_amount.toString() || '');
  const [eventDate, setEventDate] = useState(initialEvent?.event_date || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(initialEvent?.due_date || '');
  const [description, setDescription] = useState(initialEvent?.description || '');
  const [splitMethod, setSplitMethod] = useState<'equal' | 'custom'>(initialEvent?.split_method || 'equal');
  const [ownerCategory, setOwnerCategory] = useState('Ăn uống');

  // Receipt Upload States
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(initialEvent?.receipt_url || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        alert('Chỉ chấp nhận file ảnh (JPEG, PNG, WebP, HEIC)');
        e.target.value = '';
        return;
      }
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
  
  // List of participants names. Owner is always index 0.
  const [friends, setFriends] = useState<string[]>(() => {
    if (initialParticipants) {
      const friendNames = initialParticipants.filter(p => !p.is_owner).map(p => p.display_name);
      return friendNames.length > 0 ? friendNames : [''];
    }
    return [''];
  });
  
  // Splits amounts
  const [customAmounts, setCustomAmounts] = useState<string[]>(() => {
    if (initialSplits && initialParticipants) {
      const ownerPart = initialParticipants.find(p => p.is_owner);
      const ownerSplit = ownerPart ? initialSplits.find(s => s.participant_id === ownerPart.id) : null;
      const ownerAmt = ownerSplit ? ownerSplit.amount_due.toString() : '0';
      
      const friendPartAmts = initialParticipants
        .filter(p => !p.is_owner)
        .map(p => {
          const s = initialSplits.find(sp => sp.participant_id === p.id);
          return s ? s.amount_due.toString() : '0';
        });
        
      return [ownerAmt, ...friendPartAmts];
    }
    return [];
  });

  const totalVal = parseFloat(totalAmount) || 0;
  const participantCount = friends.filter(f => f.trim() !== '').length + 1; // friends + owner

  const isFirstRender = React.useRef(true);

  // Auto initialize custom amounts when method changes
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (splitMethod === 'custom') {
      const share = Math.round(totalVal / participantCount);
      const initialCustoms = Array(participantCount).fill(share.toString());
      setCustomAmounts(initialCustoms);
    }
  }, [splitMethod, totalVal, participantCount]);

  const handleAddFriendField = () => {
    setFriends([...friends, '']);
  };

  const handleRemoveFriendField = (index: number) => {
    const updated = friends.filter((_, idx) => idx !== index);
    setFriends(updated);
  };

  const handleFriendNameChange = (index: number, val: string) => {
    const updated = [...friends];
    updated[index] = val;
    setFriends(updated);
  };

  const handleCustomAmountChange = (index: number, val: string) => {
    const updated = [...customAmounts];
    updated[index] = val;
    setCustomAmounts(updated);
  };

  // Split calculation helper
  const getSplits = (): { participantIndex: number; amountDue: number }[] => {
    const validParticipantsCount = participantCount;
    if (splitMethod === 'equal') {
      const equalShare = Math.floor(totalVal / validParticipantsCount);
      const remainder = totalVal - equalShare * validParticipantsCount;
      
      return Array(validParticipantsCount).fill(0).map((_, idx) => {
        // Add the remainder to the owner (index 0) to ensure exact balance matching
        const amountDue = idx === 0 ? equalShare + remainder : equalShare;
        return {
          participantIndex: idx,
          amountDue
        };
      });
    } else {
      return customAmounts.map((amt, idx) => ({
        participantIndex: idx,
        amountDue: parseFloat(amt) || 0
      }));
    }
  };

  const calculatedSplits = getSplits();
  const customSum = customAmounts.reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  const isCustomBalanced = Math.abs(customSum - totalVal) < 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Vui lòng nhập tên sự kiện');
      return;
    }
    if (totalVal <= 0) {
      alert('Vui lòng nhập tổng số tiền hợp lệ');
      return;
    }

    // Filter out empty friend inputs
    const validFriends = friends.map(f => f.trim()).filter(Boolean);
    if (validFriends.length === 0) {
      alert('Vui lòng nhập ít nhất tên một người bạn tham gia chia tiền');
      return;
    }

    // Construct participant list (Owner is index 0)
    const participantsList: Omit<ExpenseParticipant, 'id' | 'event_id'>[] = [
      { display_name: 'Bạn', is_owner: true }
    ];
    validFriends.forEach(name => {
      participantsList.push({
        display_name: name,
        is_owner: false
      });
    });

    // Calculate splits based only on valid participants to avoid index mismatch
    const validCount = participantsList.length;
    let finalSplits: { participantIndex: number; amountDue: number }[] = [];

    if (splitMethod === 'equal') {
      const equalShare = Math.floor(totalVal / validCount);
      const remainder = totalVal - equalShare * validCount;
      
      finalSplits = Array(validCount).fill(0).map((_, idx) => ({
        participantIndex: idx,
        amountDue: idx === 0 ? equalShare + remainder : equalShare
      }));
    } else {
      // Map custom amounts for owner (index 0) and valid friends
      const cleanCustomAmounts: number[] = [parseFloat(customAmounts[0]) || 0];
      
      friends.forEach((f, idx) => {
        if (f.trim()) {
          cleanCustomAmounts.push(parseFloat(customAmounts[idx + 1]) || 0);
        }
      });

      const sum = cleanCustomAmounts.reduce((s, val) => s + val, 0);
      if (Math.abs(sum - totalVal) > 1) {
        alert(`Tổng tiền phân chia (${sum.toLocaleString('vi-VN')}đ) phải khớp với tổng hóa đơn (${totalVal.toLocaleString('vi-VN')}đ). Chênh lệch: ${(totalVal - sum).toLocaleString('vi-VN')}đ`);
        return;
      }

      finalSplits = cleanCustomAmounts.map((amt, idx) => ({
        participantIndex: idx,
        amountDue: amt
      }));
    }

    onSubmit(
      {
        title: title.trim(),
        event_date: eventDate,
        total_amount: totalVal,
        split_method: splitMethod,
        due_date: dueDate || undefined,
        description: description.trim() || undefined,
        receiptFile,
        receiptPreview
      },
      participantsList,
      finalSplits,
      ownerCategory
    );

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col modal-content modal-fullscreen-mobile">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">
            {initialEvent ? 'Chỉnh Sửa Khoản Chi Hộ' : 'Tạo Khoản Chi Hộ Nhóm'}
          </h2>
          <button
            type="button"
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
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 text-sm">
          
          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tên sự kiện / Bữa ăn</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base transition-all"
              placeholder="VD: Ăn lẩu cuối tuần, Quà cưới phòng A..."
            />
          </div>

          {/* Amount & Owner Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Tổng hóa đơn (VND)</label>
              <input
                type="number"
                inputMode="numeric"
                required
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base transition-all font-semibold"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Nhóm của mình</label>
              <select
                value={ownerCategory}
                onChange={(e) => setOwnerCategory(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base bg-white"
              >
                {categories.filter(c => c.type === 'EXPENSE').map(cat => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Ngày chi</label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Hạn hoàn trả (tùy chọn)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mô tả / Ghi chú</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-3 sm:py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base"
              placeholder="VD: Quán bia 88, anh A gửi Momo..."
            />
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Ảnh hóa đơn / Bill thanh toán <span className="text-gray-405 font-normal normal-case">(tùy chọn)</span>
            </label>

            {!receiptPreview ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all touch-target"
                >
                  <span className="text-xl">📷</span>
                  <span className="text-sm font-semibold text-gray-600">Chụp ảnh</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 flex items-center justify-center gap-2 py-3 border-2 border-dashed border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all touch-target"
                >
                  <span className="text-xl">🖼️</span>
                  <span className="text-sm font-semibold text-gray-600">Thư viện</span>
                </button>

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
                <p className="text-xs text-gray-500 mt-2 text-center truncate px-2">
                  {receiptFile ? receiptFile.name : 'Ảnh đã lưu'}
                </p>
              </div>
            )}
          </div>

          {/* Split Method Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Phương pháp chia tiền</label>
            <div className="flex bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setSplitMethod('equal')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  splitMethod === 'equal' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                Chia đều ({participantCount} người)
              </button>
              <button
                type="button"
                onClick={() => setSplitMethod('custom')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  splitMethod === 'custom' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'
                }`}
              >
                Tùy chỉnh số tiền
              </button>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3 pt-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider">Danh sách người tham gia</label>
              <button
                type="button"
                onClick={handleAddFriendField}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                + Thêm bạn bè
              </button>
            </div>

            <div className="space-y-3 bg-gray-50/50 p-3 sm:p-4 rounded-2xl border border-gray-100 max-h-60 overflow-y-auto">
              
              {/* Owner (You) */}
              <div className="flex items-center gap-3">
                <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                  ME
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800 text-sm">Bạn (Chủ chi)</p>
                </div>
                {splitMethod === 'equal' ? (
                  <span className="text-gray-600 font-semibold text-sm">
                    {calculatedSplits[0]?.amountDue.toLocaleString('vi-VN')}đ
                  </span>
                ) : (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={customAmounts[0] || ''}
                      onChange={(e) => handleCustomAmountChange(0, e.target.value)}
                      className="w-24 px-2 py-1 text-right border border-gray-200 rounded-lg text-sm"
                      placeholder="0"
                    />
                    <span className="text-[10px] text-gray-400">đ</span>
                  </div>
                )}
              </div>

              {/* Friends list */}
              {friends.map((friend, idx) => {
                const globalIndex = idx + 1;
                return (
                  <div key={idx} className="flex items-center gap-3 border-t border-gray-100/60 pt-3">
                    <span className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 font-bold flex items-center justify-center text-xs">
                      #{globalIndex}
                    </span>
                    <div className="flex-1">
                      <input
                        type="text"
                        value={friend}
                        required
                        onChange={(e) => handleFriendNameChange(idx, e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm"
                        placeholder={`Tên bạn bè ${globalIndex}`}
                      />
                    </div>
                    
                    {splitMethod === 'equal' ? (
                      <span className="text-gray-600 font-semibold text-sm">
                        {calculatedSplits[globalIndex]?.amountDue.toLocaleString('vi-VN')}đ
                      </span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          value={customAmounts[globalIndex] || ''}
                          onChange={(e) => handleCustomAmountChange(globalIndex, e.target.value)}
                          className="w-24 px-2 py-1 text-right border border-gray-200 rounded-lg text-sm"
                          placeholder="0"
                        />
                        <span className="text-[10px] text-gray-400">đ</span>
                      </div>
                    )}
                    
                    <button
                      type="button"
                      onClick={() => handleRemoveFriendField(idx)}
                      className="text-gray-300 hover:text-red-500 p-1 transition-all"
                      aria-label="Xoá bạn bè"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
            
            {/* Split validation warning */}
            {splitMethod === 'custom' && (
              <div className="flex items-center justify-between text-xs font-semibold px-1 mt-1">
                <span className="text-gray-500">
                  Tổng chia: {customSum.toLocaleString('vi-VN')}đ / {totalVal.toLocaleString('vi-VN')}đ
                </span>
                {isCustomBalanced ? (
                  <span className="text-emerald-600">✓ Đã khớp</span>
                ) : (
                  <span className="text-rose-600">
                    {totalVal - customSum > 0
                      ? `Còn thiếu ${(totalVal - customSum).toLocaleString('vi-VN')}đ`
                      : `Dư ${Math.abs(totalVal - customSum).toLocaleString('vi-VN')}đ`}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={splitMethod === 'custom' && !isCustomBalanced}
            className="w-full mt-4 py-4 sm:py-3 rounded-2xl font-bold text-white shadow-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.01] active:scale-[0.99]"
          >
            Lưu khoản chi hộ
          </button>
        </form>
      </div>
    </div>
  );
};
export default SharedExpenseForm;
