import React, { useState } from 'react';
import { UserPlus, Send, History, Check, Phone, Copy, Sparkles } from 'lucide-react';
import type { Customer, Transaction } from '../types';
import { db } from '../db/db';
import { formatPeso, formatDateTime, generatePautangReminderMsg } from '../utils/formatters';
import { translate, type LanguageCode } from '../utils/i18n';

interface PautangLedgerProps {
  customers: Customer[];
  transactions: Transaction[];
  lang: LanguageCode;
  onRefresh: () => void;
}

export const PautangLedger: React.FC<PautangLedgerProps> = ({
  customers,
  transactions,
  lang,
  onRefresh,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Modals
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');

  const [isAddCreditModalOpen, setIsAddCreditModalOpen] = useState(false);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditNotes, setCreditNotes] = useState('');

  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

  const totalCollectibles = (customers || []).reduce((sum, c) => sum + (c.currentBalance || 0), 0);

  const filteredCustomers = (customers || []).filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const matchName = c.name?.toLowerCase().includes(q) || false;
    const matchPhone = c.phone?.toLowerCase().includes(q) || false;
    const matchNotes = c.notes?.toLowerCase().includes(q) || false;
    const matchBalance =
      c.currentBalance != null &&
      (c.currentBalance.toString().includes(q) ||
        formatPeso(c.currentBalance).toLowerCase().includes(q));

    const isPaid = (c.currentBalance || 0) === 0;
    const hasDebt = (c.currentBalance || 0) > 0;
    const matchStatus =
      (isPaid && ('paid'.includes(q) || 'bayad'.includes(q) || 'walang utang'.includes(q))) ||
      (hasDebt && ('unpaid'.includes(q) || 'may utang'.includes(q) || 'pautang'.includes(q) || 'utang'.includes(q)));

    const matchDate = c.lastTransactionAt
      ? formatDateTime(c.lastTransactionAt).toLowerCase().includes(q)
      : false;

    return matchName || matchPhone || matchNotes || Boolean(matchBalance) || Boolean(matchStatus) || matchDate;
  });

  // Handle Add Customer
  const handleAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName.trim()) return;

    await db.customers.add({
      name: newCustomerName.trim(),
      phone: newCustomerPhone.trim() || undefined,
      currentBalance: 0,
      lastTransactionAt: Date.now(),
      notes: newCustomerNotes.trim() || undefined,
    });

    setNewCustomerName('');
    setNewCustomerPhone('');
    setNewCustomerNotes('');
    setIsAddCustomerOpen(false);
    onRefresh();
  };

  // Handle Receive Payment
  const handleReceivePayment = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;
    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) return;

    const todayISO = new Date().toISOString().slice(0, 10);

    // Add transaction
    await db.transactions.add({
      timestamp: Date.now(),
      dateStr: todayISO,
      type: 'PAUTANG_PAYMENT',
      customerName: selectedCustomer.name,
      items: [],
      totalAmount: amount,
      rawNote: `bayad ${selectedCustomer.name} ${amount}`,
      syncStatus: 'LOCAL',
    });

    // Update customer balance
    await db.customers.update(selectedCustomer.id, {
      currentBalance: Math.max(0, selectedCustomer.currentBalance - amount),
      lastTransactionAt: Date.now(),
    });

    setPaymentAmount('');
    setIsPaymentModalOpen(false);
    setSelectedCustomer(null);
    onRefresh();
  };

  // Handle Add New Credit (Pautang)
  const handleAddCredit = async () => {
    if (!selectedCustomer || !selectedCustomer.id) return;
    const amount = Number(creditAmount);
    if (!amount || amount <= 0) return;

    const todayISO = new Date().toISOString().slice(0, 10);

    await db.transactions.add({
      timestamp: Date.now(),
      dateStr: todayISO,
      type: 'PAUTANG_RECORD',
      customerName: selectedCustomer.name,
      items: [{ itemName: creditNotes || 'Pautang Purchase', quantity: 1, totalPrice: amount }],
      totalAmount: amount,
      rawNote: `pautang ${selectedCustomer.name} ${creditNotes ? creditNotes + ' ' : ''}${amount}`,
      syncStatus: 'LOCAL',
    });

    await db.customers.update(selectedCustomer.id, {
      currentBalance: selectedCustomer.currentBalance + amount,
      lastTransactionAt: Date.now(),
    });

    setCreditAmount('');
    setCreditNotes('');
    setIsAddCreditModalOpen(false);
    setSelectedCustomer(null);
    onRefresh();
  };

  const reminderText = selectedCustomer
    ? generatePautangReminderMsg('Tindahan Notes', selectedCustomer.name, selectedCustomer.currentBalance)
    : '';

  const copyReminder = () => {
    navigator.clipboard.writeText(reminderText);
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
            {customers.filter((c) => c.currentBalance > 0).length} suki ang may pautang
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

      {/* Customer List Feed */}
      <div className="theme-card p-3.5 sm:p-4 rounded-3xl shadow-2xs border space-y-3 transition-colors duration-200">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={translate(lang, 'search_suki_placeholder')}
          className="w-full theme-input border rounded-2xl py-2 px-3.5 text-xs sm:text-sm theme-text-app focus:outline-none font-medium"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredCustomers.length === 0 ? (
            <div className="col-span-full py-8 text-center theme-text-secondary text-xs font-semibold">
              {translate(lang, 'no_suki_found')}
            </div>
          ) : (
            filteredCustomers.map((cust) => {
              const hasDebt = cust.currentBalance > 0;
              return (
                <div
                  key={cust.id}
                  className={`p-3.5 rounded-3xl border transition-all flex flex-col justify-between gap-2.5 ${
                    hasDebt
                      ? 'bg-amber-500/10 border-amber-500/30 hover:border-amber-500/50'
                      : 'theme-bg-surface-subtle border theme-border-subtle hover:border-[var(--color-primary)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold theme-text-app text-base">{cust.name}</h4>
                        {cust.phone && (
                          <span className="text-[10px] theme-text-secondary font-medium flex items-center gap-0.5 theme-bg-surface-subtle px-1.5 py-0.5 rounded border theme-border-subtle">
                            <Phone className="w-2.5 h-2.5" />
                            {cust.phone}
                          </span>
                        )}
                      </div>
                      {cust.notes && <p className="text-xs theme-text-secondary mt-0.5">{cust.notes}</p>}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase font-extrabold theme-text-secondary block">Balance</span>
                      <span
                        className={`text-lg font-black ${
                          hasDebt ? 'text-amber-400' : 'theme-text-accent'
                        }`}
                      >
                        {formatPeso(cust.currentBalance)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Quick Actions */}
                  <div className="flex items-center gap-1.5 pt-2 border-t theme-border-subtle flex-wrap">
                    <button
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setPaymentAmount(cust.currentBalance.toString());
                        setIsPaymentModalOpen(true);
                      }}
                      className="flex-1 min-w-[70px] theme-bg-primary text-white text-xs font-bold py-1.5 px-2 rounded-xl transition-all text-center shadow-2xs active:scale-95"
                    >
                      {translate(lang, 'btn_pay')}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsAddCreditModalOpen(true);
                      }}
                      className="flex-1 min-w-[70px] theme-bg-surface-subtle hover:bg-white/10 theme-text-accent border theme-border-subtle text-xs font-bold py-1.5 px-2 rounded-xl transition-all text-center active:scale-95"
                    >
                      + {translate(lang, 'nav_pautang')}
                    </button>

                    {hasDebt && (
                      <button
                        onClick={() => {
                          setSelectedCustomer(cust);
                          setIsReminderModalOpen(true);
                        }}
                        className="theme-bg-surface-subtle hover:bg-white/10 theme-text-app text-xs font-bold py-1.5 px-2.5 rounded-xl transition-all flex items-center gap-1 border theme-border-subtle"
                        title="SMS / Messenger Reminder"
                      >
                        <Send className="w-3 h-3 text-amber-400" />
                        <span>Paalala</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setSelectedCustomer(cust);
                        setIsHistoryModalOpen(true);
                      }}
                      className="theme-bg-surface-subtle hover:bg-white/10 theme-text-secondary text-xs font-bold p-1.5 rounded-xl transition-all border theme-border-subtle"
                      title="Transaction History"
                    >
                      <History className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal: Add New Suki Customer */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border animate-in fade-in zoom-in-95">
            <h3 className="font-extrabold theme-text-app text-base mb-3">+ {translate(lang, 'btn_add_suki')}</h3>

            <form onSubmit={handleAddCustomer} className="space-y-3 text-xs sm:text-sm">
              <div>
                <label className="block font-bold theme-text-app mb-1">{translate(lang, 'customer_name')} *</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Hal. Aling Nena, Kapitan Cardo"
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">Cellphone Number (Optional)</label>
                <input
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="Hal. 09171234567"
                  className="w-full theme-input border rounded-xl p-2.5 font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold theme-text-app mb-1">Tala / Notes (Optional)</label>
                <input
                  type="text"
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  placeholder="Hal. Tricycle driver, Kapitbahay"
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

      {/* Modal: Receive Payment */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border">
            <h3 className="font-extrabold theme-text-app text-base mb-1">
              Mag-record ng Bayad ni {selectedCustomer.name}
            </h3>
            <p className="text-xs theme-text-secondary mb-3">
              Kasalukuyang Utang: <strong className="text-amber-400">{formatPeso(selectedCustomer.currentBalance)}</strong>
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">Halaga ng Bayad (₱)</label>
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
                  Full Payment ({formatPeso(selectedCustomer.currentBalance)})
                </button>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleReceivePayment}
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold shadow-2xs active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border">
            <h3 className="font-extrabold theme-text-app text-base mb-1">
              Magdagdag ng Pautang kay {selectedCustomer.name}
            </h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold theme-text-app mb-1">Halaga ng Pautang (₱)</label>
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
                <label className="block text-xs font-bold theme-text-app mb-1">Note / Anong Kinuha (Optional)</label>
                <input
                  type="text"
                  value={creditNotes}
                  onChange={(e) => setCreditNotes(e.target.value)}
                  placeholder="Hal. 2 canton, 1 coke"
                  className="w-full theme-input border rounded-lg p-2 text-xs font-medium theme-text-app focus:outline-none"
                />
              </div>

              <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t theme-border-subtle">
                <button
                  type="button"
                  onClick={() => setIsAddCreditModalOpen(false)}
                  className="px-4 py-2 rounded-xl theme-text-secondary font-bold hover:bg-white/10"
                >
                  {translate(lang, 'btn_cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleAddCredit}
                  className="theme-bg-primary text-white px-5 py-2 rounded-xl font-bold shadow-2xs active:scale-95"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-md w-full p-5 shadow-2xl border">
            <h3 className="font-extrabold theme-text-app text-base mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              Padala Paalala sa Pautang
            </h3>

            <p className="text-xs theme-text-secondary mb-3">
              Maaari mong kopyahin at i-send sa SMS, Messenger, o GCash text:
            </p>

            <div className="theme-bg-surface-subtle border theme-border-subtle p-3 rounded-2xl text-xs font-sans theme-text-app leading-relaxed mb-4">
              {reminderText}
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t theme-border-subtle">
              <button
                onClick={() => setIsReminderModalOpen(false)}
                className="px-4 py-2 rounded-xl theme-text-secondary font-bold text-xs hover:bg-white/10"
              >
                Isara
              </button>

              <button
                onClick={copyReminder}
                className="theme-bg-primary text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs active:scale-95"
              >
                {copiedSuccess ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> Na-copy Na!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" /> Kopyahin Mensahe
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Debtor History */}
      {isHistoryModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="theme-card rounded-3xl max-w-lg w-full p-5 shadow-2xl border max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b theme-border-subtle mb-3">
              <h3 className="font-extrabold theme-text-app text-base">
                Kasaysayan ni {selectedCustomer.name}
              </h3>
              <button
                onClick={() => setIsHistoryModalOpen(false)}
                className="theme-text-secondary hover:theme-text-app font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {transactions
                .filter(
                  (tx) => tx.customerName?.toLowerCase() === selectedCustomer.name.toLowerCase()
                )
                .map((tx) => (
                  <div key={tx.id} className="theme-bg-surface-subtle p-2.5 rounded-2xl border theme-border-subtle text-xs">
                    <div className="flex items-center justify-between font-bold theme-text-app mb-1">
                      <span
                        className={
                          tx.type === 'PAUTANG_RECORD'
                            ? 'text-amber-400'
                            : 'theme-text-accent'
                        }
                      >
                        {tx.type === 'PAUTANG_RECORD' ? 'Pautang' : 'Bayad'}
                      </span>
                      <span>{formatPeso(tx.totalAmount)}</span>
                    </div>
                    <div className="flex items-center justify-between theme-text-secondary text-[11px]">
                      <span>{tx.rawNote}</span>
                      <span>{formatDateTime(tx.timestamp)}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
