import type { ParsedNoteResult, TransactionType } from '../types';

/**
 * Fast offline rule-based note parser using Regex & String heuristics.
 * Supported quick patterns:
 *  - "2 coke 30" -> Sale: 2 Coke @ P30
 *  - "pautang marites 1 pancit canton 15" -> Credit Record: Marites P15
 *  - "utang cardo 100" -> Credit Record: Cardo P100
 *  - "bayad marites 50" -> Credit Payment: Marites paid P50
 *  - "restock 10 lucky me 100" -> Restock: Lucky Me x10, cost P100
 */
export function parseNoteOffline(
  rawInput: string,
  knownCustomerNames: string[] = [],
  knownItemNames: string[] = []
): ParsedNoteResult {
  const note = rawInput.trim();
  const lower = note.toLowerCase();

  let transactionType: TransactionType = 'SALE';
  let customerName: string | null = null;

  // 1. Determine transaction type
  if (/^pautang\b|^utang\b|^credit\b/i.test(lower) || lower.includes('pautang') || lower.includes('utang')) {
    transactionType = 'PAUTANG_RECORD';
  } else if (/^bayad\b|^singil\b|^paid\b|^payment\b/i.test(lower) || lower.includes('bayad') || lower.includes('singil')) {
    transactionType = 'PAUTANG_PAYMENT';
  } else if (/^restock\b|^dagdag\b|^bili\b|^karga\b/i.test(lower) || lower.includes('restock')) {
    transactionType = 'RESTOCK';
  }

  // 2. Extract Customer Name if applicable
  let workingText = note;

  // Remove transaction keyword prefixes
  workingText = workingText
    .replace(/^(pautang\s+ni|pautang|utang\s+ni|utang|bayad\s+ni|bayad|singil|restock|dagdag|bili)\s+/i, '')
    .trim();

  // Try matching known customer names first
  for (const knownName of knownCustomerNames) {
    const reg = new RegExp(`\\b${knownName}\\b`, 'i');
    if (reg.test(workingText)) {
      customerName = knownName;
      workingText = workingText.replace(reg, '').trim();
      break;
    }
  }

  // If no known customer matched but it's pautang or payment, grab the first alphabetical token
  if (!customerName && (transactionType === 'PAUTANG_RECORD' || transactionType === 'PAUTANG_PAYMENT')) {
    const nameMatch = workingText.match(/^([a-zA-Z\s]+?)(?=\s+\d|\s+$)/);
    if (nameMatch && nameMatch[1].trim().length > 0) {
      const candidate = nameMatch[1].trim();
      // Avoid keywords
      if (!['pautang', 'utang', 'bayad', 'restock'].includes(candidate.toLowerCase())) {
        customerName = candidate;
        workingText = workingText.substring(nameMatch[0].length).trim();
      }
    }
  }

  // 3. Extract items and prices
  // Look for numbers in workingText
  const numbersInText = (workingText.match(/\d+(\.\d+)?/g) || []).map(Number);

  let items: Array<{ item_name: string; quantity: number; total_price: number }> = [];
  let totalAmount = 0;

  if (transactionType === 'PAUTANG_PAYMENT') {
    // For payments, usually it's just an amount
    totalAmount = numbersInText[numbersInText.length - 1] || 0;
  } else {
    // Pattern A: "2 coke 30" -> qty=2, item="coke", total=30
    // Pattern B: "coke 15" -> qty=1, item="coke", total=15
    // Pattern C: "10 lucky me 100" -> qty=10, item="lucky me", total=100
    // Pattern D: "50" -> qty=1, item="Items", total=50

    if (numbersInText.length >= 2) {
      // First number could be qty, last number could be total price
      const qty = numbersInText[0];
      const price = numbersInText[numbersInText.length - 1];

      // Clean item description by removing the first & last numbers
      let itemDesc = workingText
        .replace(new RegExp(`\\b${qty}\\b`), '')
        .replace(new RegExp(`\\b${price}\\b`), '')
        .replace(/[\s\-_]+/g, ' ')
        .trim();

      if (!itemDesc) itemDesc = 'Paninda';

      // Match itemDesc against knownItemNames
      const matchedItem = matchKnownItem(itemDesc, knownItemNames);

      items.push({
        item_name: matchedItem || capitalizeWords(itemDesc),
        quantity: Math.max(1, qty),
        total_price: price,
      });
      totalAmount = price;
    } else if (numbersInText.length === 1) {
      const priceOrQty = numbersInText[0];
      let itemDesc = workingText.replace(new RegExp(`\\b${priceOrQty}\\b`), '').trim();

      if (!itemDesc) itemDesc = 'Paninda';

      const matchedItem = matchKnownItem(itemDesc, knownItemNames);

      items.push({
        item_name: matchedItem || capitalizeWords(itemDesc),
        quantity: 1,
        total_price: priceOrQty,
      });
      totalAmount = priceOrQty;
    } else {
      // No numbers found
      const matchedItem = matchKnownItem(workingText, knownItemNames);
      items.push({
        item_name: matchedItem || capitalizeWords(workingText || 'Paninda'),
        quantity: 1,
        total_price: 0,
      });
      totalAmount = 0;
    }
  }

  return {
    transaction_type: transactionType,
    customer_name: customerName,
    items,
    total_amount: totalAmount,
    raw_note: rawInput,
  };
}

function matchKnownItem(search: string, knownItems: string[]): string | null {
  if (!search) return null;
  const sLower = search.toLowerCase();
  for (const item of knownItems) {
    if (item.toLowerCase().includes(sLower) || sLower.includes(item.toLowerCase())) {
      return item;
    }
  }
  return null;
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}
