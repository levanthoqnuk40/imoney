import React from 'react';
import { Transaction, Category } from '../types';

interface TransactionListModalProps {
    title: string;
    transactions: Transaction[];
    categories: Category[];
    onClose: () => void;
    onTransactionClick: (transaction: Transaction) => void;
}

const formatDescription = (desc: string) => {
    if (!desc || desc.trim() === '' || desc.toLowerCase() === 'null') {
        return '';
    }
    let clean = desc.trim();
    clean = clean.replace(/^(MBVCB|MOMO-CASHIN|MOMO|VCB|MB|BIDV|Agribank|Techcombank|ACB|Vietinbank|TPB|VPB)\.?\s*[0-9A-Z]*\.?\s*/i, '');
    if (!clean) return desc.trim();
    return clean.split(/\s+/).map(word => {
        if (word.length > 12 && /^[a-z0-9_\-\.\:\/]+$/i.test(word)) {
            return word.slice(0, 6) + '...';
        }
        return word;
    }).join(' ');
};

const TransactionListModal: React.FC<TransactionListModalProps> = ({
    title,
    transactions,
    categories,
    onClose,
    onTransactionClick
}) => {
    // Sort transactions by date descending
    const sortedTransactions = [...transactions].sort((a, b) => b.date.localeCompare(a.date));

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center modal-overlay">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-lg max-h-[85vh] flex flex-col modal-content modal-fullscreen-mobile">
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-100 flex justify-between items-center flex-shrink-0">
                    <div>
                        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                        <p className="text-xs text-gray-500 mt-0.5">Có {transactions.length} giao dịch trong tháng</p>
                    </div>
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

                {/* List Container */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[250px]">
                    {sortedTransactions.length > 0 ? (
                        sortedTransactions.map(tx => {
                            const cat = categories.find(c => c.name === tx.category);
                            const emoji = cat?.icon || (tx.type === 'INCOME' ? '🪙' : '📦');

                            return (
                                <button
                                    key={tx.id}
                                    onClick={() => {
                                        onTransactionClick(tx);
                                        onClose();
                                    }}
                                    className="w-full text-left flex items-center justify-between p-3.5 bg-gray-50 hover:bg-gray-100 active:scale-[0.99] rounded-2xl border border-gray-100 transition-all focus:outline-none"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="text-2xl w-10 h-10 bg-white shadow-sm rounded-xl flex items-center justify-center flex-shrink-0">
                                            {emoji}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">
                                                {formatDescription(tx.description) || tx.category}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-gray-400 font-medium">
                                                    {tx.date.split('-').reverse().join('/')}
                                                </span>
                                                <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                                <span className="text-[10px] text-gray-500 font-semibold truncate">
                                                    {tx.category}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className={`text-sm sm:text-base font-bold whitespace-nowrap ml-3 ${
                                        tx.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'
                                    }`}>
                                        {tx.type === 'INCOME' ? '+' : '-'}{tx.amount.toLocaleString('vi-VN')}đ
                                    </span>
                                </button>
                            );
                        })
                    ) : (
                        <div className="text-center py-12 text-gray-400 text-sm italic">
                            Không tìm thấy giao dịch nào phù hợp.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TransactionListModal;
