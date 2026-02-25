
export const EXPENSE_CATEGORIES = [
  'Ăn uống',
  'Di chuyển',
  'Nhà ở',
  'Giải trí',
  'Mua sắm',
  'Sức khỏe',
  'Giáo dục',
  'Chuyển khoản đi',
  'Khác'
];

export const INCOME_CATEGORIES = [
  'Lương',
  'Thưởng',
  'Đầu tư',
  'Kinh doanh',
  'Chuyển khoản nhận',
  'Khác'
];

export const COLORS = ['#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

// Category icons mapping - centralized to avoid duplication
export const CATEGORY_ICONS: Record<string, string> = {
  'Ăn uống': '🍜',
  'Di chuyển': '🚗',
  'Nhà ở': '🏠',
  'Giải trí': '🎮',
  'Mua sắm': '🛒',
  'Sức khỏe': '💊',
  'Giáo dục': '📚',
  'Chuyển khoản nhận': '🏦',
  'Chuyển khoản đi': '🏦',
  'Khác': '📦',
};

// Gift event types for gift money tracking
export const GIFT_EVENT_TYPES: Record<string, { label: string; icon: string }> = {
  'wedding': { label: 'Đám cưới', icon: '💒' },
  'birthday': { label: 'Sinh nhật', icon: '🎂' },
  'housewarming': { label: 'Tân gia', icon: '🏠' },
  'funeral': { label: 'Tang lễ', icon: '🪦' },
  'baby': { label: 'Đầy tháng', icon: '👶' },
  'graduation': { label: 'Tốt nghiệp', icon: '🎓' },
  'other': { label: 'Khác', icon: '🎉' }
};
