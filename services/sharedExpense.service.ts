import { ExpenseEvent, ExpenseParticipant, ExpenseSplit, Repayment, ParticipantSettlementState } from '../types';

/**
 * Calculates the settlement status for all participants of an event.
 */
export function getParticipantSettlementStates(
  eventId: string,
  participants: ExpenseParticipant[],
  splits: ExpenseSplit[],
  repayments: Repayment[]
): ParticipantSettlementState[] {
  const eventParticipants = participants.filter(p => p.event_id === eventId);
  const eventSplits = splits.filter(s => s.event_id === eventId);
  const eventRepayments = repayments.filter(r => r.event_id === eventId);

  return eventParticipants.map(participant => {
    const split = eventSplits.find(s => s.participant_id === participant.id);
    const amountDue = split ? split.amount_due : 0;

    const amountPaid = eventRepayments
      .filter(r => r.participant_id === participant.id)
      .reduce((sum, curr) => sum + curr.amount, 0);

    const amountRemaining = Math.max(0, amountDue - amountPaid);

    let status: 'unpaid' | 'partial' | 'paid' = 'unpaid';
    if (amountPaid >= amountDue && amountDue > 0) {
      status = 'paid';
    } else if (amountPaid > 0) {
      status = 'partial';
    }

    return {
      participant,
      amountDue,
      amountPaid,
      amountRemaining,
      status
    };
  });
}

export interface EventRepaymentProgress {
  totalAmount: number;
  personalShare: number;
  receivableTotal: number;
  receivablePaid: number;
  receivableRemaining: number;
  paidParticipantsCount: number;
  totalParticipantsCount: number;
  isFullySettled: boolean;
}

/**
 * Calculates overall repayment stats for a shared expense event.
 */
export function getEventRepaymentProgress(
  event: ExpenseEvent,
  participants: ExpenseParticipant[],
  splits: ExpenseSplit[],
  repayments: Repayment[]
): EventRepaymentProgress {
  const settlements = getParticipantSettlementStates(event.id, participants, splits, repayments);
  
  const ownerSettlement = settlements.find(s => s.participant.is_owner);
  const personalShare = ownerSettlement ? ownerSettlement.amountDue : 0;

  const friendSettlements = settlements.filter(s => !s.participant.is_owner);
  
  const receivableTotal = friendSettlements.reduce((sum, s) => sum + s.amountDue, 0);
  const receivablePaid = friendSettlements.reduce((sum, s) => sum + s.amountPaid, 0);
  const receivableRemaining = Math.max(0, receivableTotal - receivablePaid);

  const totalParticipantsCount = friendSettlements.length;
  const paidParticipantsCount = friendSettlements.filter(s => s.status === 'paid').length;

  const isFullySettled = friendSettlements.every(s => s.status === 'paid');

  return {
    totalAmount: event.total_amount,
    personalShare,
    receivableTotal,
    receivablePaid,
    receivableRemaining,
    paidParticipantsCount,
    totalParticipantsCount,
    isFullySettled
  };
}

/**
 * Generates copyable reminder texts to send to friends.
 */
export function generateReminderText(
  event: ExpenseEvent,
  displayName: string,
  remainingAmount: number
): string {
  const formattedAmount = remainingAmount.toLocaleString('vi-VN') + 'đ';
  const eventName = event.title || 'chi tiêu chung';
  
  // Format event date
  let dateStr = '';
  if (event.event_date) {
    const d = new Date(event.event_date);
    dateStr = ` ngày ${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
  }

  const templates = [
    `Alo ${displayName} ơi, hôm trước vụ "${eventName}"${dateStr}, phần của bạn là ${formattedAmount} nha. Tiện thì ck giúp mình nha, cảm ơn bạn!`,
    `${displayName} ơi, gửi bạn thông tin chia tiền vụ "${eventName}": còn thiếu ${formattedAmount} nhé. Rảnh ck giúp mình nha!`,
    `Nhắc nợ nhẹ nhàng: Vụ "${eventName}"${dateStr} của ${displayName} còn ${formattedAmount} nè. Ck xong nhắn mình nha!`
  ];

  return templates[0]; // Default template
}
