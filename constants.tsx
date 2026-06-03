
import { TransactionType } from './types';

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

export const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase();
};

export const KEYWORD_MAP: Record<string, { type: TransactionType; category: string; keywords: string[] }> = {
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

export const autoCategorize = (desc: string): { type: TransactionType; category: string } | null => {
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
