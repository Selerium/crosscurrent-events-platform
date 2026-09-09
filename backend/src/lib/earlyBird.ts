export function isEarlyBirdPayment(
  earlyBirdDate: Date | null,
  earlyBirdPrice: number | null,
  paidAt: Date
): boolean {
  if (!earlyBirdDate || !earlyBirdPrice) return false;
  return paidAt <= earlyBirdDate;
}
