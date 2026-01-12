
import { GoogleGenAI, Type } from "@google/genai";
import { Transaction } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const getFinancialAdvice = async (transactions: Transaction[]) => {
  try {
    const transactionSummary = transactions.map(t => 
      `${t.date}: ${t.type === 'INCOME' ? '+' : '-'}${t.amount.toLocaleString('vi-VN')} VND (${t.category} - ${t.description})`
    ).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Dưới đây là danh sách các giao dịch tài chính của tôi gần đây:\n${transactionSummary}\n\nHãy phân tích thói quen chi tiêu của tôi và đưa ra lời khuyên tài chính ngắn gọn bằng tiếng Việt.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Tóm tắt tình hình tài chính hiện tại.",
            },
            tips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Danh sách 3 lời khuyên cụ thể để cải thiện tài chính.",
            },
          },
          required: ["summary", "tips"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Lỗi khi gọi Gemini API:", error);
    return {
      summary: "Không thể phân tích dữ liệu lúc này. Vui lòng thử lại sau.",
      tips: ["Kiểm tra lại kết nối mạng", "Đảm bảo bạn đã thêm đủ giao dịch", "Thử lại sau ít phút"]
    };
  }
};
