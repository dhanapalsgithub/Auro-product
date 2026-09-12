import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Wallet, Download, Trash2, BookOpen, Plus, X } from "lucide-react";

const PAGE_SIZE = 12;

export default function Payments() {
  const [params] = useSearchParams();
  const [payments, setPayments] = useState([]);
  const [shops, setShops] = useState([]);
  const [shopId, setShopId] = useState(params.get("shop") || "");
  const [ledger, setLedger] = useState(null);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);

  const loadPayments = () => api.get("/payments", { params: shopId ? { shop_id: shopId } : {} }).then((r) => { setPayments(r.data); setPage(1); });
  useEffect(() => { api.get("/shops").then((r) => setShops(r.data)); }, []);
  useEffect(() => { loadPayments(); if (shopId) api.get(`/ledger/${shopId}`).then((r) => setLedger(r.data)); else setLedger(null); /* eslint-disable-next-line */ }, [shopId]);

  const pageCount = Math.max(1, Math.ceil(payments.length / PAGE_SIZE));
  const rows = useMemo(() => payments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [payments, page]);

  const del = async (id) => { await api.delete(`/payments/${id}`); toast.success("Payment deleted"); loadPayments(); if (shopId) api.get(`/ledger/${shopId}`).then((r) => setLedger(r.data)); };

  const doExport = () => exportToCsv("payments.csv", payments, [
    { label: "Date", accessor: (r) => fmtDate(r.payment_date) }, { label: "Shop No", accessor: "shop_no" }, { label: "Shop", accessor: "shop_name" },
    { label: "Invoice", accessor: "invoice_no" }, { label: "Mode", accessor: "mode" }, { label: "Amount", accessor: "amount" },
  ]);
  const exportLedger = () => ledger && exportToCsv(`ledger-${ledger.shop.shop_no}.csv`, ledger.rows, [
    { label: "Date", accessor: (r) => fmtDate(r.date) }, { label: "Particulars", accessor: "particulars" },
    { label: "Debit", accessor: "debit" }, { label: "Credit", accessor: "credit" }, { label: "Balance", accessor: "balance" },
  ]);

  return (
    <div>
      <PageHeader title="Payments & Ledger" subtitle="Record collections, track part payments, opening & closing balances" icon={Wallet}>
        <select data-testid="payments-shop-filter" value={shopId} onChange={(e) => setShopId(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/10 py-2 px-4 text-sm outline-none focus:border-cyan-500/50 min-w-[200px]">
          <option value="">All Shops (payments)</option>
          {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name}</option>)}
        </select>
        <button data-testid="add-payment-button" onClick={() => setModal(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition"><Plus className="h-4 w-4" /> Record Payment</button>
      </PageHeader>

      {ledger && (
        <Card className="p-5 mb-6" data-testid="ledger-card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-cyan-300" /><h2 className="font-display text-lg font-semibold">Ledger · {ledger.shop.shop_no} {ledger.shop.name}</h2></div>
            <button data-testid="export-ledger-button" onClick={exportLedger} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"><Download className="h-3.5 w-3.5" /> Export</button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3"><p className="text-[10px] uppercase text-slate-500 font-mono">Opening</p><p className="font-mono font-semibold mt-1">{inr(ledger.opening_balance)}</p></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3"><p className="text-[10px] uppercase text-slate-500 font-mono">Total Debit</p><p className="font-mono font-semibold mt-1 text-red-300">{inr(ledger.total_debit)}</p></div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3"><p className="text-[10px] uppercase text-slate-500 font-mono">Total Credit</p><p className="font-mono font-semibold mt-1 text-emerald-300">{inr(ledger.total_credit)}</p></div>
            <div className="rounded-xl bg-cyan-500/10 border border-cyan-500/30 p-3"><p className="text-[10px] uppercase text-slate-500 font-mono">Closing</p><p className="font-mono font-semibold mt-1 text-cyan-300" data-testid="ledger-closing">{inr(ledger.closing_balance)}</p></div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="ledger-table">
              <thead><tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono"><th className="p-3">Date</th><th className="p-3">Particulars</th><th className="p-3 text-right">Debit</th><th className="p-3 text-right">Credit</th><th className="p-3 text-right">Balance</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                <tr><td className="p-3 text-slate-500" colSpan={4}>Opening Balance</td><td className="p-3 text-right font-mono">{inr(ledger.opening_balance)}</td></tr>
                {ledger.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="p-3 font-mono text-slate-400">{fmtDate(r.date)}</td><td className="p-3">{r.particulars}</td>
                    <td className="p-3 text-right font-mono text-red-300">{r.debit ? inr(r.debit) : "—"}</td>
                    <td className="p-3 text-right font-mono text-emerald-300">{r.credit ? inr(r.credit) : "—"}</td>
                    <td className="p-3 text-right font-mono">{inr(r.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="font-display text-lg font-semibold">Payment History</h2>
          <button data-testid="export-payments-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10 transition"><Download className="h-3.5 w-3.5" /> Export</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="payments-table">
            <thead><tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono"><th className="p-4">Date</th><th className="p-4">Shop</th><th className="p-4">Invoice</th><th className="p-4">Mode</th><th className="p-4 text-right">Amount</th><th className="p-4"></th></tr></thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((p) => (
                <tr key={p.id} data-testid={`payment-row-${p.id}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-slate-400">{fmtDate(p.payment_date)}</td>
                  <td className="p-4"><span className="text-cyan-300 font-mono">{p.shop_no}</span> · {p.shop_name}</td>
                  <td className="p-4 text-slate-400 font-mono">{p.invoice_no || "—"}</td>
                  <td className="p-4"><span className="rounded-full bg-white/5 border border-white/10 px-2.5 py-1 text-xs">{p.mode}</span></td>
                  <td className="p-4 text-right font-mono text-emerald-300">{inr(p.amount)}</td>
                  <td className="p-4 text-right"><button data-testid={`delete-payment-${p.id}`} onClick={() => del(p.id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No payments recorded yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={payments.length} onPage={setPage} testid="payments-pager" /></div>
      </Card>

      {modal && <StandalonePayment shops={shops} defaultShop={shopId} onClose={() => setModal(false)} onDone={() => { setModal(false); loadPayments(); if (shopId) api.get(`/ledger/${shopId}`).then((r) => setLedger(r.data)); }} />}
    </div>
  );
}

function StandalonePayment({ shops, defaultShop, onClose, onDone }) {
  const [shop, setShop] = useState(defaultShop || "");
  const [invoices, setInvoices] = useState([]);
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("UPI");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!shop) { setInvoices([]); return; }
    const s = shops.find((x) => x.id === shop);
    if (s) api.get("/invoices", { params: { search: s.shop_no } }).then((r) => setInvoices(r.data.filter((i) => i.status !== "paid")));
  }, [shop, shops]);

  const submit = async (e) => {
    e.preventDefault();
    if (!shop || !amount) { toast.error("Select shop and amount"); return; }
    setSaving(true);
    try {
      await api.post("/payments", { shop_id: shop, invoice_id: invoiceId || null, amount: parseFloat(amount), mode, payment_date: new Date(payDate).toISOString() });
      toast.success("Payment recorded"); onDone();
    } catch (err) { toast.error("Failed"); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="standalone-payment-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4"><h3 className="font-display text-lg font-semibold">Record Payment</h3><button type="button" onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button></div>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500">Shop</label>
            <select data-testid="sp-shop-select" value={shop} onChange={(e) => setShop(e.target.value)} required className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
              <option value="">Select shop…</option>{shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-500">Against Invoice (optional)</label>
            <select data-testid="sp-invoice-select" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
              <option value="">On account (no invoice)</option>{invoices.map((i) => <option key={i.id} value={i.id}>{i.invoice_no} · bal {i.balance}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-500">Amount (₹)</label><input data-testid="sp-amount-input" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
            <div><label className="text-xs text-slate-500">Mode</label><select data-testid="sp-mode-select" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">{["UPI", "Cash", "Bank Transfer", "Cheque"].map((m) => <option key={m}>{m}</option>)}</select></div>
          </div>
          <div><label className="text-xs text-slate-500">Date</label><input data-testid="sp-date-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
        </div>
        <button data-testid="sp-save-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">{saving ? "Saving…" : "Save Payment"}</button>
      </form>
    </div>
  );
}
