/**
 * Formats Philippine Peso amounts cleanly: ₱150 or ₱12.50
 */
export function formatPeso(amount: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}

/**
 * Format timestamp into readable Philippine date & time
 */
export function formatDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Format YYYY-MM-DD into "Today", "Yesterday", or "MMM D, YYYY"
 */
export function formatDateLabel(dateStr: string): string {
  const todayISO = new Date().toISOString().slice(0, 10);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().slice(0, 10);

  if (dateStr === todayISO) return 'Ngayong Araw (Today)';
  if (dateStr === yesterdayISO) return 'Kapon (Yesterday)';

  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Generates a polite, friendly Taglish SMS or GCash payment reminder message for Suki debtors
 */
export function generatePautangReminderMsg(storeName: string, customerName: string, amount: number): string {
  return `Magandang araw po ${customerName}! 🌸 Paalala lang po mula sa ${storeName} tungkol sa inyong pautang balance na ${formatPeso(
    amount
  )}. Pwede po magbayad sa tindahan o sa GCash. Maraming salamat po sa inyong patuloy na pagtangkilik! 🙏`;
}
