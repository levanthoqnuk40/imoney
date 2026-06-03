import React, { useState } from 'react';
import { Category, Transaction, Budget, TransactionType } from '../types';

interface CategoryModalProps {
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  onCategoriesChange: (newCategories: Category[], renameMap?: { oldName: string; newName: string }) => void;
  onClose: () => void;
}

const COMMON_EMOJIS = {
  EXPENSE: ['🍜', '🚗', '🏠', '🎮', '🛒', '💊', '📚', '🏦', '📦', '🍔', '🍹', '🍿', '✈️', '🐶', '🐱', '👕', '💅', '💄', '💻', '🎁', '🎫', '⚡', '💧', '📶'],
  INCOME: ['💵', '🎁', '📈', '💼', '🏦', '🪙', '💰', '🏢', '🏠', '🎨', '💻', '🚜', '🛍️']
};

const CategoryModal: React.FC<CategoryModalProps> = ({
  categories,
  transactions,
  budgets,
  onCategoriesChange,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TransactionType>('EXPENSE');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📦');
  const [keywordsInput, setKeywordsInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Filter categories by type
  const filteredCategories = categories.filter(c => c.type === activeTab);

  const handleOpenForm = (category?: Category) => {
    if (category) {
      setEditingCategory(category);
      setName(category.name);
      setIcon(category.icon);
      setKeywordsInput(category.keywords.join(', '));
    } else {
      setEditingCategory(null);
      setName('');
      setIcon(activeTab === 'EXPENSE' ? '🍜' : '💵');
      setKeywordsInput('');
    }
    setErrorMsg(null);
    setIsFormOpen(true);
    setShowEmojiPicker(false);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingCategory(null);
    setName('');
    setKeywordsInput('');
    setErrorMsg(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setErrorMsg('Vui lòng nhập tên danh mục.');
      return;
    }

    // Check duplicate name
    const isDuplicate = categories.some(c => 
      c.name.toLowerCase() === cleanName.toLowerCase() && 
      (!editingCategory || c.id !== editingCategory.id)
    );
    if (isDuplicate) {
      setErrorMsg('Tên danh mục này đã tồn tại.');
      return;
    }

    // Parse keywords
    const keywords = keywordsInput
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(k => k.length > 0);

    const updatedCategories = [...categories];

    if (editingCategory) {
      // Edit mode
      const oldName = editingCategory.name;
      const index = updatedCategories.findIndex(c => c.id === editingCategory.id);
      if (index !== -1) {
        updatedCategories[index] = {
          ...editingCategory,
          name: cleanName,
          icon,
          keywords
        };
      }
      
      // If name changed, trigger cascade updates
      const renameMap = oldName !== cleanName ? { oldName, newName: cleanName } : undefined;
      onCategoriesChange(updatedCategories, renameMap);
    } else {
      // Add mode
      const newCategory: Category = {
        id: `cat_custom_${Date.now()}`,
        name: cleanName,
        icon,
        type: activeTab,
        keywords
      };
      updatedCategories.push(newCategory);
      onCategoriesChange(updatedCategories);
    }

    handleCloseForm();
  };

  const handleDelete = (category: Category) => {
    // Check if category is in use
    const transactionCount = transactions.filter(t => t.category === category.name).length;
    const budgetCount = budgets.filter(b => b.category === category.name).length;

    if (transactionCount > 0 || budgetCount > 0) {
      let warning = `Không thể xóa danh mục "${category.name}". `;
      const parts = [];
      if (transactionCount > 0) parts.push(`${transactionCount} giao dịch`);
      if (budgetCount > 0) parts.push(`${budgetCount} mục ngân sách`);
      warning += `Danh mục này đang được sử dụng bởi ${parts.join(' và ')}. `;
      warning += `Bạn cần đổi danh mục của các dữ liệu này trước khi xóa.`;
      
      alert(warning);
      return;
    }

    if (confirm(`Bạn có chắc chắn muốn xóa danh mục "${category.name}"?`)) {
      const updatedCategories = categories.filter(c => c.id !== category.id);
      onCategoriesChange(updatedCategories);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
      <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] flex flex-col modal-content modal-fullscreen-mobile">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800">Quản Lý Danh Mục</h2>
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

        {/* Form panel for Add/Edit */}
        {isFormOpen ? (
          <form onSubmit={handleSave} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
            <h3 className="text-base font-bold text-gray-700">
              {editingCategory ? `Chỉnh sửa: ${editingCategory.name}` : `Thêm danh mục ${activeTab === 'EXPENSE' ? 'Chi tiêu' : 'Thu nhập'}`}
            </h3>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-100 font-medium">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Icon & Name input */}
            <div className="flex gap-3">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-14 h-14 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl flex items-center justify-center text-2xl transition-all"
                  title="Chọn Emoji"
                >
                  {icon}
                </button>
                {showEmojiPicker && (
                  <div className="absolute left-0 top-16 bg-white border border-gray-200 shadow-xl rounded-2xl p-3 z-50 w-64 max-h-48 overflow-y-auto grid grid-cols-6 gap-2">
                    {COMMON_EMOJIS[activeTab].map(emoji => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setIcon(emoji);
                          setShowEmojiPicker(false);
                        }}
                        className="p-1 text-xl hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tên danh mục</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-14 px-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-base font-medium"
                  placeholder="Ví dụ: Nuôi thú cưng"
                />
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                Từ khóa tự động nhận diện <span className="text-gray-400 font-normal">(ngăn cách bằng dấu phẩy)</span>
              </label>
              <textarea
                value={keywordsInput}
                onChange={(e) => setKeywordsInput(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium resize-none"
                placeholder="Ví dụ: pet, meo, pate, cat, thuy y"
                rows={3}
              />
              <p className="text-[10px] text-gray-400 mt-1 leading-normal">
                💡 Khi giao dịch ngân hàng có nội dung khớp với một trong các từ khóa này, hệ thống sẽ tự động gán giao dịch đó vào danh mục này.
              </p>
            </div>

            {/* Form buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-xl transition-all active:scale-[0.98]"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-[0.98] shadow-md shadow-blue-200"
              >
                Lưu lại
              </button>
            </div>
          </form>
        ) : (
          /* Main view: Categories list */
          <div className="flex-1 overflow-y-auto flex flex-col">
            {/* Tabs */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex-shrink-0 flex gap-2">
              <button
                onClick={() => setActiveTab('EXPENSE')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'EXPENSE'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-200'
                    : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-100'
                }`}
              >
                💸 Chi tiêu (Expense)
              </button>
              <button
                onClick={() => setActiveTab('INCOME')}
                className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${
                  activeTab === 'INCOME'
                    ? 'bg-emerald-500 text-white shadow-md shadow-emerald-200'
                    : 'bg-white text-gray-500 hover:text-gray-700 border border-gray-100'
                }`}
              >
                💰 Thu nhập (Income)
              </button>
            </div>

            {/* List */}
            <div className="flex-1 p-4 space-y-2 overflow-y-auto min-h-[250px]">
              {filteredCategories.length > 0 ? (
                filteredCategories.map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl border border-gray-100/60 hover:bg-gray-100/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <span className="text-2xl w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center flex-shrink-0">
                        {cat.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-800 text-sm sm:text-base truncate">{cat.name}</p>
                        {cat.keywords.length > 0 && (
                          <p className="text-[10px] text-gray-400 truncate mt-0.5">
                            🔑 {cat.keywords.join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-3">
                      <button
                        onClick={() => handleOpenForm(cat)}
                        className="w-9 h-9 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors flex items-center justify-center text-sm"
                        title="Chỉnh sửa"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDelete(cat)}
                        className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors flex items-center justify-center text-sm"
                        title="Xóa danh mục"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm italic">
                  Chưa có danh mục nào. Hãy thêm mới!
                </div>
              )}
            </div>

            {/* Footer with ADD button */}
            <div className="p-4 sm:p-6 border-t border-gray-100 bg-white flex-shrink-0">
              <button
                onClick={() => handleOpenForm()}
                className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition-all active:scale-[0.98] ${
                  activeTab === 'EXPENSE'
                    ? 'bg-rose-500 hover:bg-rose-600 shadow-rose-100'
                    : 'bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100'
                }`}
              >
                + Thêm danh mục mới
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryModal;
