import type { LanguageCode } from './i18n';

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
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns the date formatted as YYYY-MM-DD in the device's local timezone.
 */
export function getLocalDateStr(dateInput: Date | number = new Date()): string {
  const date = typeof dateInput === 'number' ? new Date(dateInput) : dateInput;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format YYYY-MM-DD into "Today", "Yesterday", or "MMM D, YYYY"
 */
export function formatDateLabel(dateStr: string, lang: LanguageCode = 'en'): string {
  const todayStr = getLocalDateStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = getLocalDateStr(yesterday);

  if (dateStr === todayStr) return lang === 'tl' ? 'Ngayong Araw' : 'Today';
  if (dateStr === yesterdayStr) return lang === 'tl' ? 'Kahapon' : 'Yesterday';

  const [y, m, d] = dateStr.split('-');
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return date.toLocaleDateString(lang === 'tl' ? 'tl-PH' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Dynamically sanitizes and formats transaction raw notes for clean language display.
 */
export function formatDisplayNote(note: string | undefined, lang: LanguageCode): string {
  if (!note) return '';
  if (lang === 'tl') return note;
  return note
    .replace(/^bayad\b/i, 'payment')
    .replace(/^pautang\b/i, 'credit')
    .replace(/\(bayad ni /gi, '(paid by ')
    .replace(/\(kinuha ni /gi, '(taken by ');
}

/**
 * Dynamically formats generic item names (such as "Pautang Purchase" or "Bayad") based on selected language.
 */
export function formatDisplayItemName(itemName: string | undefined, lang: LanguageCode): string {
  if (!itemName) return '';
  if (lang === 'tl') {
    if (itemName === 'Credit Purchase' || itemName === 'Pautang Purchase') return 'Utang';
    if (itemName === 'Payment' || itemName === 'Debt Payment') return 'Bayad';
    return itemName;
  }
  if (itemName === 'Pautang Purchase' || itemName === 'Pautang' || itemName === 'Utang') return 'Credit Purchase';
  if (itemName === 'Bayad' || itemName === 'Bayad Utang' || itemName === 'Bayad sa Utang') return 'Payment';
  return itemName;
}

/**
 * Generates a polite, friendly SMS or GCash payment reminder message for Suki debtors
 */
export function generatePautangReminderMsg(storeName: string, customerName: string, amount: number, lang: LanguageCode = 'en'): string {
  if (lang === 'tl') {
    return `Magandang araw po ${customerName}! 🌸 Paalala lang po mula sa ${storeName} tungkol sa inyong pautang balance na ${formatPeso(
      amount
    )}. Pwede po magbayad sa tindahan o sa GCash. Maraming salamat po sa inyong patuloy na pagtangkilik! 🙏`;
  }
  return `Good day ${customerName}! 🌸 This is a friendly reminder from ${storeName} regarding your store credit balance of ${formatPeso(
    amount
  )}. You can settle this at our store or via GCash. Thank you for your continued patronage! 🙏`;
}
