import React, { useState, useEffect } from 'react';
import { UserPlus, Send, History, Check, Phone, Copy, Sparkles, Pencil, Trash2, X, Receipt, User, ChevronRight } from 'lucide-react';
import type { Customer, Transaction, TransactionType } from '../types';
import { db, updateTransactionEntry, recalculateCustomerBalance } from '../db/db';
import { formatPeso, formatDateTime, generatePautangReminderMsg, getLocalDateStr, formatDisplayNote, formatDisplayItemName } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';
import { FormalReceipt } from './FormalReceipt';

interface PautangLedgerProps {
  customers: Customer[];
  transactions: Transaction[];
  lang: LanguageCode;
  onRefresh: () => void;
  prefillAction?: { customerId: number; action: 'PAY' | 'ADD_CREDIT' | 'VIEW' } | null;
  onClearPrefillAction?: () => void;
}

export const PautangLedger: React.FC<PautangLedgerProps> = ({
  customers,
  transactions,
  lang,
  onRefresh,
  prefillAction,
  onClearPrefillAction,
}) => {
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (prefillAction) {
      const cust = customers.find(c => c.id === prefillAction.customerId);
      if (cust) {
        setSelectedCustomer(cust);
        if (prefillAction.action === 'PAY') setIsPaymentModalOpen(true);
        if (prefillAction.action === 'ADD_CREDIT') setIsAddCreditModalOpen(true);
        if (prefillAction.action === 'VIEW') setIsHistoryModalOpen(true);
      }
      if (onClearPrefillAction) onClearPrefillAction();
    }
  }, [prefillAction, customers, onClearPrefillAction]);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');

  // Edit Customer Profile
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerNotes, setEditCustomerNotes] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentHandledBy, setPaymentHandledBy] = useState('');

  const [isAddCreditModalOpen, setIsAddCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');
  const [creditHandledBy, setCreditHandledBy] = useState('');

  // Edit Transaction Modal
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editTxAmount, setEditTxAmount] = useState('');
  const [editTxType, setEditTxType] = useState<TransactionType>('PAUTANG_RECORD');
  const [editTxNote, setEditTxNote] = useState('');
  const [editTxHandledBy, setEditTxHandledBy] = useState('');

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Customer Detail & Action Sheet Modal (ItemCard pattern)
  const [isCustomerDetailModalOpen, setIsCustomerDetailModalOpen] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [viewingDetailTx, setViewingDetailTx] = useState<Transaction | null>(null);

  const totalCollectibles = (customers || []).reduce((sum, c) => sum + (c.currentBalance || 0), 0);

  const filteredCustomers = customers || [];

  const isAnySubModalOpen = Boolean(
    isAddCustomerOpen ||
    isEditCustomerOpen ||
    isPaymentModalOpen ||
    isAddCreditModalOpen ||
    editingTx ||
    isReminderModalOpen ||
    isCustomerDetailModalOpen ||
    isHistoryModalOpen ||
    viewingDetailTx
  );

  useEffect(() => {
    if (!isAnySubModalOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    const originalOverscroll = document.body.style.overscrollBehavior;

    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
      document.body.style.overscrollBehavior = originalOverscroll || '';
    };
  }, [isAnySubModalOpen]);

  // Handle Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCustomerName.trim();
    if (!trimmed) return;

    try {
      // Guard against duplicate name collision on indexeddb
      const existing = await db.customers.where('name').equalsIgnoreCase(trimmed).first();
      if (existing) {
        alert(
          lang === 'tl'
            ? `Mayroon nang suki na may pangalang "${trimmed}".`
            : `A customer named "${trimmed}" already exists.`
        );
        return;
      }

      const cleanPhone = newCustomerPhone.replace(/\D/g, '').slice(0, 11);

      await db.customers.add({
        name: trimmed,
        phone: cleanPhone || undefined,
        currentBalance: 0,
        lastTransactionAt: Date.now(),
        notes: newCustomerNotes.trim() || undefined,
      });

      setNewCustomerName('');
      setNewCustomerPhone('');
      setNewCustomerNotes('');
      setIsAddCustomerOpen(false);
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error adding customer:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-save ng suki.' : 'Error saving customer.');
    }
  };

  // Handle Open Edit Customer Profile
  const handleOpenEditCustomer = (customer: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedCustomer(customer);
    setEditCustomerName(customer.name);
    setEditCustomerPhone(customer.phone || '');
    setEditCustomerNotes(customer.notes || '');
    setIsEditCustomerOpen(true);
  };

  // Handle Save Edit Customer Profile
  const handleSaveEditCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedCustomer.id) return;
    const trimmedName = editCustomerName.trim();
    if (!trimmedName) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng pangalan.' : 'Please enter a name.');
      return;
    }

    try {
      const oldName = selectedCustomer.name;
      const cleanPhone = editCustomerPhone.replace(/\D/g, '').slice(0, 11);

      // Check if new name exists on another customer
      if (trimmedName.toLowerCase() !== oldName.toLowerCase()) {
        const duplicate = customers.find(
          (c) => c.id !== selectedCustomer.id && c.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (duplicate) {
          alert(
            lang === 'tl'
              ? `Mayroon nang ibang suki na may pangalang "${trimmedName}".`
              : `A customer named "${trimmedName}" already exists.`
          );
          return;
        }
      }

      await db.customers.update(selectedCustomer.id, {
        name: trimmedName,
        phone: cleanPhone || undefined,
        notes: editCustomerNotes.trim() || undefined,
      });

      // If name changed, synchronize transactions as well
      if (trimmedName.toLowerCase() !== oldName.toLowerCase()) {
        const associatedTxs = await db.transactions
          .filter((tx) => (tx.customerName || '').toLowerCase() === oldName.toLowerCase())
          .toArray();
        for (const tx of associatedTxs) {
          if (tx.id) {
            await db.transactions.update(tx.id, { customerName: trimmedName });
          }
        }
      }

      setIsEditCustomerOpen(false);
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error editing customer:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-update ng profile.' : 'Error updating customer profile.');
    }
  };

  // Handle Receive Payment
  const handleReceivePayment = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;
    if (paymentAmount.trim() === '' || isNaN(Number(paymentAmount))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong halaga ng bayad.' : 'Please enter a valid payment amount.');
      return;
    }
    const amount = Number(paymentAmount);
    if (amount <= 0) {
      alert(lang === 'tl' ? 'Ang halaga ng bayad ay dapat higit sa 0.' : 'Payment amount must be greater than 0.');
      return;
    }

    try {
      const todayStr = getLocalDateStr();
      const payerNote = paymentHandledBy.trim();

      // Add transaction
      await db.transactions.add({
        timestamp: Date.now(),
        dateStr: todayStr,
        type: 'PAUTANG_PAYMENT',
        customerName: selectedCustomer.name,
        handledBy: payerNote || undefined,
        items: [{ itemName: lang === 'tl' ? 'Bayad' : 'Payment', quantity: 1, totalPrice: amount }],
        totalAmount: amount,
        rawNote: lang === 'tl'
          ? `bayad ${selectedCustomer.name} ${payerNote ? `(bayad ni ${payerNote}) ` : ''}${amount}`
          : `payment ${selectedCustomer.name} ${payerNote ? `(paid by ${payerNote}) ` : ''}${amount}`,
        notes: payerNote ? (lang === 'tl' ? `Nagbayad: ${payerNote}` : `Paid by: ${payerNote}`) : undefined,
        syncStatus: 'LOCAL',
      });

      // Recalculate customer balance directly from transactions
      await recalculateCustomerBalance(selectedCustomer.name);

      setPaymentAmount('');
      setPaymentHandledBy('');
      setIsPaymentModalOpen(false);
      setSelectedCustomer(null);
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error recording payment:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-record ng bayad.' : 'Error recording payment.');
    }
  };

  // Handle Add New Credit (Pautang)
  const handleAddCredit = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;
    if (creditAmount.trim() === '' || isNaN(Number(creditAmount))) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong halaga ng pautang.' : 'Please enter a valid credit amount.');
      return;
    }
    const amount = Number(creditAmount);
    if (amount <= 0) {
      alert(lang === 'tl' ? 'Ang halaga ng pautang ay dapat higit sa 0.' : 'Credit amount must be greater than 0.');
      return;
    }

    try {
      const todayStr = getLocalDateStr();
      const takerNote = creditHandledBy.trim();
      const descNote = creditNotes.trim();

      await db.transactions.add({
        timestamp: Date.now(),
        dateStr: todayStr,
        type: 'PAUTANG_RECORD',
        customerName: selectedCustomer.name,
        handledBy: takerNote || undefined,
        items: [{ itemName: descNote || (lang === 'tl' ? 'Pautang' : 'Credit Purchase'), quantity: 1, totalPrice: amount }],
        totalAmount: amount,
        rawNote: lang === 'tl'
          ? `pautang ${selectedCustomer.name} ${takerNote ? `(kinuha ni ${takerNote}) ` : ''}${descNote ? descNote + ' ' : ''}${amount}`
          : `credit ${selectedCustomer.name} ${takerNote ? `(taken by ${takerNote}) ` : ''}${descNote ? descNote + ' ' : ''}${amount}`,
        notes: takerNote ? (lang === 'tl' ? `Kinuha ni: ${takerNote}` : `Taken by: ${takerNote}`) : undefined,
        syncStatus: 'LOCAL',
      });

      // Recalculate customer balance
      await recalculateCustomerBalance(selectedCustomer.name);

      setCreditAmount('');
      setCreditNotes('');
      setCreditHandledBy('');
      setIsAddCreditModalOpen(false);
      setSelectedCustomer(null);
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error adding credit:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-record ng pautang.' : 'Error recording credit.');
    }
  };

  // Handle Open Edit Transaction Modal
  const handleOpenEditTx = (tx: Transaction) => {
    setEditingTx(tx);
    setEditTxAmount(tx.totalAmount.toString());
    setEditTxType(tx.type);
    setEditTxNote(
      tx.items && tx.items.length > 0
        ? tx.items.map((i) => i.itemName).join(', ')
        : tx.rawNote || ''
    );
    setEditTxHandledBy(tx.handledBy || '');
  };

  // Handle Save Edited Transaction
  const handleSaveEditTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx || !editingTx.id) return;
    const amount = Number(editTxAmount);
    if (isNaN(amount) || amount <= 0) {
      alert(lang === 'tl' ? 'Mangyaring maglagay ng wastong halaga.' : 'Please enter a valid amount.');
      return;
    }

    try {
      const handled = editTxHandledBy.trim();
      const desc = editTxNote.trim();
      const custName = editingTx.customerName || selectedCustomer?.name || '';

      await updateTransactionEntry(editingTx.id, {
        totalAmount: amount,
        type: editTxType,
        handledBy: handled || undefined,
        items: [{ itemName: desc || (editTxType === 'PAUTANG_RECORD' ? (lang === 'tl' ? 'Pautang' : 'Credit Purchase') : (lang === 'tl' ? 'Bayad' : 'Payment')), quantity: 1, totalPrice: amount }],
        rawNote: lang === 'tl'
          ? `${editTxType === 'PAUTANG_RECORD' ? 'pautang' : 'bayad'} ${custName} ${handled ? `(${handled}) ` : ''}${desc ? desc + ' ' : ''}${amount}`
          : `${editTxType === 'PAUTANG_RECORD' ? 'credit' : 'payment'} ${custName} ${handled ? `(${handled}) ` : ''}${desc ? desc + ' ' : ''}${amount}`,
        notes: handled ? (editTxType === 'PAUTANG_RECORD' ? (lang === 'tl' ? `Kinuha ni: ${handled}` : `Taken by: ${handled}`) : (lang === 'tl' ? `Nagbayad: ${handled}` : `Paid by: ${handled}`)) : undefined,
      });

      if (custName) {
        await recalculateCustomerBalance(custName);
      }

      setEditingTx(null);
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error updating transaction:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-update ng tala.' : 'Error updating transaction.');
    }
  };

  // Handle Delete Single Transaction from Customer History
  const handleDeleteTx = async (txId?: number) => {
    if (!txId) return;
    const confirmMsg =
      lang === 'tl'
        ? 'Sigurado ka bang nais mong tanggalin ang transaksyong ito? Awtomatikong mai-a-adjust ang balance.'
        : 'Are you sure you want to delete this transaction? The customer balance will be automatically recalculated.';
    if (!window.confirm(confirmMsg)) return;

    try {
      const tx = await db.transactions.get(txId);
      const custName = tx?.customerName || selectedCustomer?.name;
      await db.transactions.delete(txId);

      if (custName) {
        await recalculateCustomerBalance(custName);
      }

      if (editingTx?.id === txId) {
        setEditingTx(null);
      }
      onRefresh();
    } catch (err) {
      console.error('[PautangLedger] Error deleting transaction:', err);
      alert(lang === 'tl' ? 'Nagkaroon ng error sa pag-delete.' : 'Error deleting transaction.');
    }
  };

  const reminderText = selectedCustomer
    ? generatePautangReminderMsg('Tinda', selectedCustomer.name, selectedCustomer.currentBalance, lang)
    : '';

  const copyReminder = () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(reminderText).catch(() => {});
      }
    } catch {}
    setCopiedSuccess(true);
    setTimeout(() => setCopiedSuccess(false), 2000);
  };

  return (
    <div id="pautang-ledger-container" className="space-y-4">
      {/* Summary Banner & Action Button */}
      <div
        id="pautang-controls-section"
        className="theme-card p-4 sm:p-5 rounded-3xl shadow-2xs border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors duration-200"
      >
        <div>
          <span className="text-xs font-bold theme-text-secondary block">
            {translate(lang, 'pautang_total_collectibles')}
          </span>
          <span className="text-2xl sm:text-3xl font-black theme-text-accent">
            {formatPeso(totalCollectibles)}
          </span>
          <p className="text-xs theme-text-secondary mt-0.5">
            {lang === 'tl'
              ? `${customers.filter((c) => c.currentBalance > 0).length} suki ang may pautang`
              : `${customers.filter((c) => c.currentBalance > 0).length} customer(s) with credit balance`}
          </p>
        </div>

        <button
          id="btn-add-customer"
          onClick={() => setIsAddCustomerOpen(true)}
          className="flex items-center gap-1.5 theme-bg-primary text-white px-4 py-2.5 rounded-2xl text-xs font-black transition-all shadow-2xs active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4 text-white/90" />
          <span>+ {translate(lang, 'btn_add_suki')}</span>
        </button>
      </div>

      {/* Customer List Feed (Fluid Grid matching ItemCard design) */}
      <div className="fluid-grid-customers">
        {filteredCustomers.length === 0 ? (
          <div className="col-span-full theme-card rounded-3xl p-8 text-center border border-dashed theme-border theme-text-secondary">
            <User className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-bold theme-text-app">{translate(lang, 'no_suki_found')}</p>
          </div>
        ) : (
          filteredCustomers.map((cust) => {
            const hasDebt = cust.currentBalance > 0;
            const initials = cust.name
              ? cust.name
                  .split(' ')
                  .map((n) => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()
              : 'S';

            return (
              <div
                key={cust.id}
                role="button"
                tabIndex={0}
                style={{ touchAction: 'manipulation' }}
                onClick={() => {
                  setSelectedCustomer(cust);
                  setIsCustomerDetailModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCustomer(cust);
                    setIsCustomerDetailModalOpen(true);
                  }
                }}
                className={`theme-card rounded-2xl border transition-all duration-150 p-2.5 sm:p-3 flex flex-col justify-between cursor-pointer select-none active:scale-[0.98] shadow-2xs hover:shadow-xs min-h-[125px] sm:min-h-[140px] ${
                  hasDebt
                    ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60'
                    : 'theme-border-subtle hover:border-[var(--color-primary)]'
                }`}
              >
                {/* Top Row: Avatar / Initials & Status Badge */}
                <div className="flex items-start justify-between gap-1.5 mb-1.5">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 shadow-2xs border ${
                      hasDebt
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'theme-bg-surface-subtle theme-text-accent border-emerald-500/30'
                    }`}
                  >
                    {initials}
                  </div>
                  <span
                    className={`text-[10px] font-black px-1.5 py-0.5 rounded-md border tracking-tight ${
                      hasDebt
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {hasDebt
                      ? (lang === 'tl' ? 'May Utang' : 'Has Balance')
                      : (lang === 'tl' ? 'Walang Utang' : 'Paid')}
                  </span>
                </div>

                {/* Middle: Customer Name (clean 2-line clamp for uniform box height) & Subtitle/Phone */}
                <div className="min-w-0 flex-1 flex flex-col justify-center my-1">
                  <h4 className="font-black theme-text-app text-xs sm:text-sm leading-snug line-clamp-2" title={cust.name}>
                    {cust.name}
                  </h4>
                  {cust.phone ? (
                    <p className="text-[10px] theme-text-secondary truncate mt-0.5 font-mono">
                      {cust.phone}
                    </p>
                  ) : cust.notes ? (
                    <p className="text-[10px] theme-text-secondary truncate mt-0.5 italic">
                      {cust.notes}
                    </p>
                  ) : null}
                </div>

                {/* Bottom Row: Balance & Quick Details Arrow */}
                <div className="pt-1.5 border-t theme-border-subtle flex items-center justify-between gap-1">
                  <div>
                    <span className="text-[9px] uppercase font-extrabold theme-text-secondary block leading-none mb-0.5">
                      Balance
                    </span>
                    <span
                      className={`font-black text-xs sm:text-sm truncate leading-tight ${
                        hasDebt ? 'text-amber-400' : 'theme-text-accent'
                      }`}
                    >
                      {formatPeso(cust.currentBalance)}
                    </span>
                  </div>
                  <span className="p-1 rounded-lg theme-text-secondary hover:theme-text-app hover:bg-white/10 transition-colors">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Add New Suki Customer */}
      {isAddCustomerOpen && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsAddCustomerOpen(false)}
        >
          <div 
            className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border animate-in fade-in "
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold theme-text-app text-base mb-3">+ {translate(lang, 'btn_add_suki')}</h3>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold theme-text-app mb-1">{translate(lang, 'customer_name')} *</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder={lang === 'tl' ? 'Hal. Aling Nena, Kapitan Cardo' : 'E.g. Aling Nena, Captain Cardo'}
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">{lang === 'tl' ? 'Cellphone Number (Max 11 digits)' : 'Phone Number (Max 11 digits)'}</label>
                <div className="relative">
                  <input
                    type="tel"
                    maxLength={11}
                    value={newCustomerPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setNewCustomerPhone(digits);
                    }}
                    placeholder={lang === 'tl' ? 'Hal. 09171234567' : 'E.g. 09171234567'}
                    className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none pr-12 font-mono"
                  />
                  <span className="absolute right-2.5 top-3 text-[10px] theme-text-secondary font-mono">
                    {newCustomerPhone.length}/11
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">{lang === 'tl' ? 'Tala / Notes (Optional)' : 'Notes (Optional)'}</label>
                <input
                  type="text"
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  placeholder={lang === 'tl' ? 'Hal. Tricycle driver, Kapitbahay' : 'E.g. Neighbor, Regular buyer'}
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-2 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl theme-text-secondary hover:bg-white/10 font-bold"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold transition-all shadow-2xs active:scale-95"
                >
                  {translate(lang, 'btn_save_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Customer Details & Quick Actions Sheet (ItemCard Modal Pattern) */}
      {isCustomerDetailModalOpen && selectedCustomer && (() => {
        const cust = customers.find((c) => c.id === selectedCustomer.id) || selectedCustomer;
        const hasDebt = cust.currentBalance > 0;
        const initials = cust.name
          ? cust.name
              .split(' ')
              .map((n) => n[0])
              .filter(Boolean)
              .slice(0, 2)
              .join('')
              .toUpperCase()
          : 'S';

        return (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsCustomerDetailModalOpen(false);
              }
            }}
          >
            <div
              className="theme-card rounded-3xl max-w-md w-full p-4 sm:p-5 shadow-2xl border animate-in  my-auto max-h-[90vh] flex flex-col justify-between"
              onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
              style={{ touchAction: 'manipulation' }}
            >
              {/* Header: Suki Info & Close Button */}
              <div className="flex items-start justify-between pb-3 border-b theme-border-subtle shrink-0">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center text-sm font-black shrink-0 shadow-2xs border ${
                      hasDebt
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'theme-bg-surface-subtle theme-text-accent border-emerald-500/30'
                    }`}
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold theme-text-app text-base sm:text-lg leading-tight">
                        {cust.name}
                      </h3>
                      <button
                        type="button"
                        onClick={(e) => {
                          handleOpenEditCustomer(cust, e);
                          setIsCustomerDetailModalOpen(false);
                        }}
                        className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 theme-text-secondary hover:theme-text-app flex items-center justify-center cursor-pointer transition-colors"
                        title={lang === 'tl' ? 'I-edit ang Profile' : 'Edit Profile'}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                    {cust.phone && (
                      <span className="text-xs theme-text-secondary font-medium flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3" />
                        {cust.phone}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsCustomerDetailModalOpen(false)}
                  className="p-1.5 rounded-xl theme-text-secondary hover:bg-white/10 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body: Balance & Notes Overview */}
              <div className="py-4 space-y-3">
                {/* Balance Metric Card */}
                <div
                  className={`p-3.5 rounded-2xl border flex items-center justify-between ${
                    hasDebt
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'theme-bg-surface-subtle border theme-border-subtle'
                  }`}
                >
                  <div>
                    <span className="text-[10px] uppercase font-extrabold theme-text-secondary block">
                      {lang === 'tl' ? 'Kasalukuyang Balance' : 'Current Balance'}
                    </span>
                    <span
                      className={`text-2xl font-black ${
                        hasDebt ? 'text-amber-400' : 'theme-text-accent'
                      }`}
                    >
                      {formatPeso(cust.currentBalance)}
                    </span>
                  </div>
                  <span
                    className={`text-xs font-black px-2.5 py-1 rounded-xl border tracking-tight ${
                      hasDebt
                        ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {hasDebt
                      ? (lang === 'tl' ? 'May Utang' : 'Has Balance')
                      : (lang === 'tl' ? 'Walang Utang' : 'Paid')}
                  </span>
                </div>

                {cust.notes && (
                  <div className="p-3 rounded-xl theme-bg-surface-subtle border theme-border-subtle text-xs theme-text-secondary">
                    <span className="font-bold theme-text-app block mb-0.5">
                      {lang === 'tl' ? 'Tala / Notes:' : 'Notes:'}
                    </span>
                    {cust.notes}
                  </div>
                )}
              </div>

              {/* Action Buttons Grid */}
              <div className="pt-3 border-t theme-border-subtle flex flex-col gap-2 shrink-0">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setPaymentAmount(cust.currentBalance > 0 ? cust.currentBalance.toString() : '');
                      setIsCustomerDetailModalOpen(false);
                      setIsPaymentModalOpen(true);
                    }}
                    className="theme-bg-primary text-white text-xs sm:text-sm font-black py-2.5 px-3 rounded-2xl transition-all text-center shadow-2xs active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Receipt className="w-4 h-4" />
                    <span>{translate(lang, 'btn_pay')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(cust);
                      setIsCustomerDetailModalOpen(false);
                      setIsAddCreditModalOpen(true);
                    }}
                    className="theme-bg-surface-subtle hover:bg-white/10 theme-text-accent border theme-border-subtle text-xs sm:text-sm font-black py-2.5 px-3 rounded-2xl transition-all text-center active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <span>+ {translate(lang, 'nav_pautang')}</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {hasDebt ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsCustomerDetailModalOpen(false);
                        setIsReminderModalOpen(true);
                      }}
                      className="theme-bg-surface-subtle hover:bg-white/10 theme-text-app text-xs font-bold py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 border theme-border-subtle"
                    >
                      <Send className="w-3.5 h-3.5 text-amber-400" />
                      <span>{lang === 'tl' ? 'Mag-paalala' : 'Reminder'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        handleOpenEditCustomer(cust, e);
                        setIsCustomerDetailModalOpen(false);
                      }}
                      className="theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary text-xs font-bold py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 border theme-border-subtle"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{lang === 'tl' ? 'I-edit Profile' : 'Edit Profile'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCustomer(cust);
                      setIsCustomerDetailModalOpen(false);
                      setIsHistoryModalOpen(true);
                    }}
                    className="theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary text-xs font-bold py-2.5 px-3 rounded-2xl transition-all flex items-center justify-center gap-1.5 border theme-border-subtle cursor-pointer active:scale-95"
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>{lang === 'tl' ? 'Kasaysayan' : 'History'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: Receive Payment */}
      {isPaymentModalOpen && selectedCustomer && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setIsPaymentModalOpen(false);
            setPaymentHandledBy('');
          }}
        >
          <div 
            className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold theme-text-app text-base mb-1">
              {lang === 'tl' ? `Mag-record ng Bayad ni ${selectedCustomer.name}` : `Record Payment from ${selectedCustomer.name}`}
            </h3>
            <p className="text-xs theme-text-secondary mb-3">
              {lang === 'tl' ? 'Kasalukuyang Utang:' : 'Current Balance:'} <strong className="text-amber-400">{formatPeso(selectedCustomer.currentBalance)}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">{lang === 'tl' ? 'Halaga ng Bayad (₱) *' : 'Payment Amount (₱) *'}</label>
                <input
                  type="number"
                  min="1"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full theme-input border rounded-xl p-2.5 text-lg font-black theme-text-app focus:outline-none"
                />
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentAmount(selectedCustomer.currentBalance.toString())}
                  className="text-xs font-bold theme-bg-surface-subtle theme-text-accent px-2.5 py-1 rounded-lg border theme-border-subtle hover:bg-white/10"
                >
                  {lang === 'tl' ? `Buong Bayad (${formatPeso(selectedCustomer.currentBalance)})` : `Full Payment (${formatPeso(selectedCustomer.currentBalance)})`}
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Sino ang nagbayad? (Optional)' : 'Who handed the payment? (Optional)'}
                </label>
                <input
                  type="text"
                  value={paymentHandledBy}
                  onChange={(e) => setPaymentHandledBy(e.target.value)}
                  placeholder={lang === 'tl' ? `Iwanang blangko kung si ${selectedCustomer.name} mismo (o ilagay hal. Pedro, Anak)` : `Leave blank if ${selectedCustomer.name} self (or enter e.g. Son, Spouse)`}
                  className="w-full theme-input border rounded-xl p-2.5 text-xs font-medium theme-text-app focus:outline-none"
                />
                <span className="text-[10px] theme-text-secondary mt-0.5 block">
                  {lang === 'tl' ? 'Kung ibang tao ang nag-abot o nagbayad, ilagay ang pangalan dito.' : 'If someone else paid on their behalf, specify their name here.'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setIsPaymentModalOpen(false);
                    setPaymentHandledBy('');
                  }}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReceivePayment}
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold shadow-2xs active:scale-95 cursor-pointer"
                >
                  {translate(lang, 'btn_save_confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Credit */}
      {isAddCreditModalOpen && selectedCustomer && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => {
            setIsAddCreditModalOpen(false);
            setCreditHandledBy('');
          }}
        >
          <div 
            className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold theme-text-app text-base mb-1">
              {lang === 'tl' ? `Magdagdag ng Pautang kay ${selectedCustomer.name}` : `Add Credit Record for ${selectedCustomer.name}`}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">{lang === 'tl' ? 'Halaga ng Pautang (₱) *' : 'Credit Amount (₱) *'}</label>
                <input
                  type="number"
                  min="1"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full theme-input border rounded-xl p-2.5 text-lg font-black theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">{lang === 'tl' ? 'Note / Anong Kinuha (Optional)' : 'Note / Items Taken (Optional)'}</label>
                <input
                  type="text"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  placeholder={lang === 'tl' ? 'Hal. 2 canton, 1 coke' : 'E.g. 2 canton, 1 coke'}
                  className="w-full theme-input border rounded-xl p-2.5 text-xs font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Sino ang kumuha? (Optional)' : 'Who picked up the items? (Optional)'}
                </label>
                <input
                  type="text"
                  value={creditHandledBy}
                  onChange={(e) => setCreditHandledBy(e.target.value)}
                  placeholder={lang === 'tl' ? `Iwanang blangko kung si ${selectedCustomer.name} mismo (o ilagay hal. Bunso, Asawa)` : `Leave blank if ${selectedCustomer.name} self (or enter e.g. Child, Spouse)`}
                  className="w-full theme-input border rounded-xl p-2.5 text-xs font-medium theme-text-app focus:outline-none"
                />
                <span className="text-[10px] theme-text-secondary mt-0.5 block">
                  {lang === 'tl' ? 'Kung inutusan o ibang tao ang kumuha para sa kanya, ilagay rito.' : 'If an emissary or family member fetched the items, specify their name.'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddCreditModalOpen(false);
                    setCreditHandledBy('');
                  }}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleAddCredit}
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold shadow-2xs active:scale-95 cursor-pointer"
                >
                  {translate(lang, 'btn_save_confirm')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: SMS / GCash Reminder */}
      {isReminderModalOpen && selectedCustomer && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsReminderModalOpen(false)}
        >
          <div 
            className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <h3 className="font-extrabold theme-text-app text-base mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              {lang === 'tl' ? 'Padala Paalala sa Pautang' : 'Send Credit Reminder'}
            </h3>

            <p className="text-xs theme-text-secondary mb-3">
              {lang === 'tl' ? 'Maaari mong kopyahin at i-send sa SMS, Messenger, o GCash text:' : 'You can copy and send via SMS, Messenger, or Chat:'}
            </p>

            <div className="theme-bg-surface-subtle border theme-border-subtle p-3 rounded-2xl text-xs font-sans theme-text-app leading-relaxed mb-4">
              {reminderText}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t theme-border-subtle">
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10"
              >
                {lang === 'tl' ? 'Isara' : 'Close'}
              </button>

              <button
                onClick={copyReminder}
                className="theme-bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> {lang === 'tl' ? 'Na-copy Na!' : 'Copied!'}
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> {lang === 'tl' ? 'Kopyahin Mensahe' : 'Copy Message'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Debtor History */}
      {isHistoryModalOpen && selectedCustomer && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsHistoryModalOpen(false);
            }
          }}
        >
          <div
            className="theme-card rounded-3xl max-w-lg w-full p-5 shadow-2xl border max-h-[85vh] flex flex-col animate-in "
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b theme-border-subtle mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold theme-text-app text-base leading-tight">
                    {lang === 'tl' ? `Listahan ng Utang at Bayad ni ${selectedCustomer.name}` : `Credit & Payment History of ${selectedCustomer.name}`}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => {
                      setIsHistoryModalOpen(false);
                      handleOpenEditCustomer(selectedCustomer, e);
                    }}
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 theme-text-secondary hover:theme-text-app flex items-center justify-center cursor-pointer transition-colors"
                    title={lang === 'tl' ? 'I-edit ang Profile' : 'Edit Customer Profile'}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-bold theme-text-secondary">
                  {lang === 'tl' ? 'Kasalukuyang Utang:' : 'Current Balance:'} <strong className={selectedCustomer.currentBalance > 0 ? 'text-amber-400' : 'theme-text-accent'}>{formatPeso(selectedCustomer.currentBalance)}</strong>
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 theme-text-app flex items-center justify-center cursor-pointer transition-colors"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {transactions
                .filter(
                  (tx) => tx.customerName?.toLowerCase() === selectedCustomer.name.toLowerCase()
                )
                .map((tx) => {
                  const isPautang = tx.type === 'PAUTANG_RECORD';
                  return (
                    <div
                      key={tx.id}
                      onClick={() => setViewingDetailTx(tx)}
                      className="theme-bg-surface-subtle p-3.5 rounded-2xl border theme-border-subtle text-xs space-y-2 hover:border-amber-500/50 hover:bg-white/5 transition-all cursor-pointer group"
                      title={lang === 'tl' ? 'Pindutin para makita ang kumpletong detalye' : 'Tap to view full details'}
                    >
                      <div className="flex items-center justify-between font-bold theme-text-app">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[11px] font-black ${
                              isPautang
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            }`}
                          >
                            {isPautang
                              ? (lang === 'tl' ? 'Utang' : 'Credit')
                              : (lang === 'tl' ? 'Bayad' : 'Payment')}
                          </span>

                          {tx.handledBy && (
                            <span className="bg-white/10 theme-text-app text-[10px] font-bold px-2 py-0.5 rounded-md border theme-border-subtle">
                              👤 {isPautang
                                ? (lang === 'tl' ? 'Kinuha ni:' : 'Taken by:')
                                : (lang === 'tl' ? 'Nagbayad:' : 'Paid by:')} {tx.handledBy}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-sm text-[var(--color-primary)]">
                            {formatPeso(tx.totalAmount)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between theme-text-secondary text-[11px] pt-1 border-t theme-border-subtle">
                        <span className="truncate max-w-[65%]">
                          {formatDisplayNote(tx.rawNote, lang) || (isPautang
                            ? (lang === 'tl' ? 'Tala ng Utang' : 'Credit Record')
                            : (lang === 'tl' ? 'Tala ng Bayad' : 'Payment Record'))}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span>{formatDateTime(tx.timestamp)}</span>
                          <span className="text-[10px] font-bold text-amber-500 opacity-70 group-hover:opacity-100 transition-opacity">
                            {lang === 'tl' ? 'Tingnan →' : 'View →'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Credit/Payment Entry */}
      {editingTx && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEditingTx(null)}
        >
          <div
            className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border animate-in  space-y-4"
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle">
              <h3 className="font-black theme-text-app text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 theme-text-accent" />
                <span>{lang === 'tl' ? 'I-edit ang Tala' : 'Edit Entry'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setEditingTx(null)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 theme-text-app flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditTx} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold theme-text-app mb-1">{lang === 'tl' ? 'Uri ng Transaksyon' : 'Transaction Type'}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditTxType('PAUTANG_RECORD')}
                    className={`py-2 px-3 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                      editTxType === 'PAUTANG_RECORD'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-xs'
                        : 'theme-bg-surface-subtle theme-text-secondary border-transparent'
                    }`}
                  >
                    {lang === 'tl' ? 'Utang (Credit)' : 'Credit'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditTxType('PAUTANG_PAYMENT')}
                    className={`py-2 px-3 rounded-xl font-black text-xs border transition-all cursor-pointer ${
                      editTxType === 'PAUTANG_PAYMENT'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-xs'
                        : 'theme-bg-surface-subtle theme-text-secondary border-transparent'
                    }`}
                  >
                    {lang === 'tl' ? 'Bayad (Payment)' : 'Payment'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">{lang === 'tl' ? 'Halaga (₱) *' : 'Amount (₱) *'}</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={editTxAmount}
                  onChange={(e) => setEditTxAmount(e.target.value)}
                  className="w-full theme-input border rounded-xl p-2.5 text-base font-black theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Sino ang nagbayad / kumuha? (Optional)' : 'Who paid / picked up? (Optional)'}
                </label>
                <input
                  type="text"
                  value={editTxHandledBy}
                  onChange={(e) => setEditTxHandledBy(e.target.value)}
                  placeholder={lang === 'tl' ? `Iwanang blangko kung si ${editingTx.customerName || selectedCustomer?.name} mismo (o hal. Pedro, Asawa)` : `Leave blank if ${editingTx.customerName || selectedCustomer?.name} self (or enter e.g. Spouse)`}
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
                <span className="text-[10px] theme-text-secondary mt-0.5 block">
                  {lang === 'tl' ? 'Kung hindi ang mismong may utang ang nagbayad o kumuha, ilagay ang kanyang pangalan rito.' : 'If someone else handled this transaction, specify their name here.'}
                </span>
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">{lang === 'tl' ? 'Tala / Detalye ng Kinuha' : 'Note / Items Detail'}</label>
                <input
                  type="text"
                  value={editTxNote}
                  onChange={(e) => setEditTxNote(e.target.value)}
                  placeholder={lang === 'tl' ? 'Hal. 2 canton, softdrinks' : 'E.g. 2 canton, softdrinks'}
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t theme-border-subtle mt-4">
                <button
                  type="button"
                  onClick={() => handleDeleteTx(editingTx.id)}
                  className="px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 font-bold flex items-center gap-1 cursor-pointer transition-all active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" /> {lang === 'tl' ? 'Tanggalin' : 'Delete'}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTx(null)}
                    className="px-3 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10 cursor-pointer"
                  >
                    {translate(lang, 'btn_cancel')}
                  </button>
                  <button
                    type="submit"
                    className="theme-bg-primary text-white px-4 py-2 rounded-xl font-bold shadow-2xs active:scale-95 cursor-pointer"
                  >
                    {translate(lang, 'btn_save_confirm')}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Modal: Edit Customer Profile */}
      {isEditCustomerOpen && selectedCustomer && (
        <div 
          className="fixed inset-0 bg-black/65 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsEditCustomerOpen(false)}
        >
          <div
            className="theme-card rounded-3xl max-w-sm w-full p-5 shadow-2xl border animate-in "
            onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle mb-4">
              <h3 className="font-extrabold theme-text-app text-base flex items-center gap-2">
                <Pencil className="w-4 h-4 theme-text-accent" />
                <span>{lang === 'tl' ? 'I-edit ang Profile ng Suki' : 'Edit Customer Profile'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditCustomerOpen(false)}
                className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 theme-text-app flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEditCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Pangalan ng Suki *' : 'Customer Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder={lang === 'tl' ? 'Pangalan ng Customer' : 'Customer Name'}
                  className="w-full theme-input border rounded-xl p-2.5 text-xs font-bold theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Cellphone Number (Max 11 digits)' : 'Phone Number (Max 11 digits)'}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    maxLength={11}
                    value={editCustomerPhone}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                      setEditCustomerPhone(digits);
                    }}
                    placeholder={lang === 'tl' ? '09171234567 (11 digits)' : '09171234567 (11 digits)'}
                    className="w-full theme-input border rounded-xl p-2.5 text-xs font-medium theme-text-app focus:outline-none pr-12 font-mono"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] theme-text-secondary font-mono">
                    {editCustomerPhone.length}/11
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">
                  {lang === 'tl' ? 'Tala / Notes (Optional)' : 'Notes (Optional)'}
                </label>
                <textarea
                  value={editCustomerNotes}
                  onChange={(e) => setEditCustomerNotes(e.target.value)}
                  placeholder={lang === 'tl' ? 'Hal. Kapitbahay sa tapat, suki ng softdrinks' : 'E.g. Neighbor across street, regular soda buyer'}
                  rows={2}
                  className="w-full theme-input border rounded-xl p-2.5 text-xs font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerOpen(false)}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10 cursor-pointer"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="submit"
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold shadow-2xs active:scale-95 cursor-pointer"
                >
                  {translate(lang, 'btn_save_confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transaction Details Modal when tapping a history item */}
      {viewingDetailTx && (
        <FormalReceipt
          transaction={viewingDetailTx}
          lang={lang}
          customerPhone={selectedCustomer?.phone}
          customerAddress={selectedCustomer?.notes}
          onClose={() => setViewingDetailTx(null)}
        />
      )}
    </div>
  );
};
