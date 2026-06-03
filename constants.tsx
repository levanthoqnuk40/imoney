
import { Category, TransactionType } from './types';

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

// Central fallback mapping
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

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_luong', name: 'Lương', icon: '💵', type: 'INCOME', keywords: ['luong', 'salary', 'thu nhap', 'payroll', 'paycheck', 'chuyen khoan luong', 'chuyen khoan nhan luong'] },
  { id: 'cat_thuong', name: 'Thưởng', icon: '🎁', type: 'INCOME', keywords: ['thuong', 'bonus', 'commission', 'hoa hong'] },
  { id: 'cat_dautu', name: 'Đầu tư', icon: '📈', type: 'INCOME', keywords: ['co phieu', 'stock', 'lai dau tu', 'crypto', 'coin', 'dividend', 'co tuc'] },
  { id: 'cat_kinhdoanh', name: 'Kinh doanh', icon: '💼', type: 'INCOME', keywords: ['ban hang', 'kinh doanh', 'doanh thu', 'revenue', 'khach hang thanh toan', 'tien hang'] },
  { id: 'cat_cknhan', name: 'Chuyển khoản nhận', icon: '🏦', type: 'INCOME', keywords: [] },
  { id: 'cat_in_khac', name: 'Khác', icon: '🪙', type: 'INCOME', keywords: [] },
  
  { id: 'cat_anuong', name: 'Ăn uống', icon: '🍜', type: 'EXPENSE', keywords: ['cafe', 'coffee', 'starbucks', 'highlands', 'an uong', 'an sang', 'an toi', 'an trua', 'nha hang', 'tra sua', 'gong cha', 'dingtea', 'phuc long', 'kfc', 'lotteria', 'mcdonald', 'pizza', 'lau', 'nuong', 'com', 'pho', 'bun', 'grocery', 'cho', 'sieu thi', 'coopmart', 'winmart', 'bachhoa', 'foody', 'shopeefood', 'grabfood', 'baemin'] },
  { id: 'cat_dichuyen', name: 'Di chuyển', icon: '🚗', type: 'EXPENSE', keywords: ['xang', 'gas', 'petrol', 'grab', 'be ', 'gojek', 'taxi', 've xe', 've tau', 've may bay', 'airline', 'xe bus', 'gui xe', 'do xe', 'bao duong xe', 'sua xe'] },
  { id: 'cat_nhao', name: 'Nhà ở', icon: '🏠', type: 'EXPENSE', keywords: ['tien nha', 'tien phong', 'thue nha', 'nha o', 'dien nuoc', 'tien dien', 'tien nuoc', 'internet', 'wifi', 'chung cu', 'phi quan ly', 'phi dich vu', 'sua nha'] },
  { id: 'cat_giaitri', name: 'Giải trí', icon: '🎮', type: 'EXPENSE', keywords: ['netflix', 'spotify', 'youtube premium', 'rap phim', 'cgv', 'lotte cinema', 'xem phim', 'du lich', 'travel', 'khach san', 'hotel', 've may bay du lich', 've tham quan', 'karaoke', 'bar', 'club', 'game', 'nap game', 'steam', 'playstation', 'nintendo', 'concert'] },
  { id: 'cat_muasam', name: 'Mua sắm', icon: '🛒', type: 'EXPENSE', keywords: ['mua sam', 'shopee', 'lazada', 'tiki', 'shopping', 'quan ao', 'giay dep', 'quan jean', 'ao thun', 'ao khoac', 'tui xach', 'my pham', 'makeup', 'skincare', 'dien thoai', 'laptop', 'ipad', 'phu kien', 'tivi', 'tu lanh', 'gia dung'] },
  { id: 'cat_suckhoe', name: 'Sức khỏe', icon: '💊', type: 'EXPENSE', keywords: ['thuoc', 'pharmacy', 'nha thuoc', 'benh vien', 'hospital', 'kham benh', 'nha khoa', 'rang', 'phong kham', 'bao hiem', 'insurance', 'gym', 'california fitness', 'fitness', 'yoga', 'spa', 'massage'] },
  { id: 'cat_giaoduc', name: 'Giáo dục', icon: '📚', type: 'EXPENSE', keywords: ['hoc phi', 'tuition', 'khoa hoc', 'course', 'tieng anh', 'ielts', 'toeic', 'sach', 'book', 'van phong pham', 'dung cu hoc tap', 'truong hoc', 'dai hoc', 'udemy', 'coursera'] },
  { id: 'cat_ckdi', name: 'Chuyển khoản đi', icon: '🏦', type: 'EXPENSE', keywords: [] },
  { id: 'cat_out_khac', name: 'Khác', icon: '📦', type: 'EXPENSE', keywords: [] },
];

export const getCategories = (): Category[] => {
  try {
    const saved = localStorage.getItem('imoney_custom_categories');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load categories from localStorage:', e);
  }
  return DEFAULT_CATEGORIES;
};

export const saveCategories = (categories: Category[]): void => {
  try {
    localStorage.setItem('imoney_custom_categories', JSON.stringify(categories));
  } catch (e) {
    console.error('Failed to save categories to localStorage:', e);
  }
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

export const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
};

export const autoCategorize = (desc: string, categories?: Category[]): { type: TransactionType; category: string } | null => {
  const cleanDesc = removeAccents(desc);
  const targetCategories = categories || getCategories();
  for (const cat of targetCategories) {
    for (const keyword of cat.keywords) {
      const cleanKeyword = removeAccents(keyword);
      if (cleanDesc.includes(cleanKeyword)) {
        return { type: cat.type, category: cat.name };
      }
    }
  }
  return null;
};
