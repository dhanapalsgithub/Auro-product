import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Receipt, Plus, Download, Search, Eye, Trash2, X, IndianRupee, Wallet } from "lucide-react";

const PAGE_SIZE = 10;
const STATUS = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unpaid: "bg-red-500/15 text-red-300 border-red-500/30",
};
const blankItem = () => ({ description: "Cotton Box (Corrugated Paperboard)", hsn: "4819", unit: "PCS", quantity: "", rate: "" });

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState(null);
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState(null);

  const [shopId, setShopId] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [items, setItems] = useState([blankItem()]);

  const load = () => api.get("/invoices", { params: { search, start, end } }).then((r) => { setInvoices(r.data); setPage(1); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, start, end]);
  useEffect(() => {
    api.get("/shops").then((r) => setShops(r.data));
    api.get("/settings").then((r) => { setSettings(r.data); setItems([{ ...blankItem(), rate: String(r.data.default_rate || 16) }]); });
  }, []);

  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const rows = useMemo(() => invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [invoices, page]);

  const taxable = items.reduce((s, it) => s + (parseFloat(it.quantity || 0) * parseFloat(it.rate || 0)), 0);
  const cgp = settings?.cgst_percent || 9, sgp = settings?.sgst_percent || 9;
  const cgst = taxable * cgp / 100, sgst = taxable * sgp / 100;
  const total = Math.round(taxable + cgst + sgst);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: v } : it));
  const addItem = () => setItems((arr) => [...arr, { ...blankItem(), rate: String(settings?.default_rate || 16) }]);
  const removeItem = (i) => setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));

  const create = async (e) => {
    e.preventDefault();
    if (!shopId) { toast.error("Select a shop"); return; }
    const clean = items.filter((it) => it.quantity && it.rate).map((it) => ({ ...it, quantity: parseFloat(it.quantity), rate: parseFloat(it.rate) }));
    if (clean.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    try {
      const res = await api.post("/invoices", { shop_id: shopId, invoice_date: new Date(invDate).toISOString(), items: clean, cgst_percent: cgp, sgst_percent: sgp });
      toast.success(`Invoice ${res.data.invoice_no} created`);
      setModal(false); setItems([{ ...blankItem(), rate: String(settings?.default_rate || 16) }]);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) { toast.error("Failed to create invoice"); }
    finally { setSaving(false); }
  };

  const del = async (id) => { if (!window.confirm("Delete invoice?")) return; await api.delete(`/invoices/${id}`); toast.success("Deleted"); load(); };

  const doExport = () => exportToCsv("invoices.csv", invoices, [
    { label: "Invoice No", accessor: "invoice_no" }, { label: "Date", accessor: (r) => fmtDate(r.invoice_date) },
    { label: "Shop No", accessor: "shop_no" }, { label: "Shop", accessor: "shop_name" },
    { label: "Taxable", accessor: "taxable" }, { label: "Total", accessor: "grand_total" },
    { label: "Paid", accessor: "amount_paid" }, { label: "Balance", accessor: "balance" }, { label: "Status", accessor: "status" },
  ]);

  return (
    <div>
      <PageHeader title="GST Invoices" subtitle="Tamil Nadu Tax Invoices · 18% GST (CGST 9% + SGST 9%)" icon={Receipt}>
        <button data-testid="export-invoices-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
        <button data-testid="new-invoice-button" onClick={() => setModal(true)} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Plus className="h-4 w-4" /> New Invoice
        </button>
      </PageHeader>

      <Card className="p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input data-testid="invoice-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no / shop…"
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
        </div>
        <div className="flex items-center gap-2">
          <input data-testid="invoice-start-date" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
          <span className="text-slate-500 text-sm">to</span>
          <input data-testid="invoice-end-date" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="invoices-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Invoice</th><th className="p-4">Date</th><th className="p-4">Shop</th>
                <th className="p-4 text-right">Total</th><th className="p-4 text-right">Balance</th><th className="p-4 text-center">Status</th><th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((i) => (
                <tr key={i.id} data-testid={`invoice-row-${i.invoice_no}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-cyan-300 cursor-pointer" onClick={() => navigate(`/invoices/${i.id}`)}>{i.invoice_no}</td>
                  <td className="p-4 text-slate-400 font-mono">{fmtDate(i.invoice_date)}</td>
                  <td className="p-4">{i.shop_no} · {i.shop_name}</td>
                  <td className="p-4 text-right font-mono">{inr(i.grand_total)}</td>
                  <td className="p-4 text-right font-mono text-amber-300">{inr(i.balance ?? i.grand_total)}</td>
                  <td className="p-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[i.status] || STATUS.unpaid}`}>{(i.status || "unpaid").toUpperCase()}</span></td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {i.status !== "paid" && <button data-testid={`pay-invoice-${i.invoice_no}`} onClick={() => setPayFor(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-emerald-300" title="Record payment"><Wallet className="h-4 w-4" /></button>}
                      <button data-testid={`view-invoice-${i.invoice_no}`} onClick={() => navigate(`/invoices/${i.id}`)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300"><Eye className="h-4 w-4" /></button>
                      <button data-testid={`delete-invoice-${i.invoice_no}`} onClick={() => del(i.id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No invoices yet. Create your first GST invoice.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={invoices.length} onPage={setPage} testid="invoices-pager" /></div>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="invoice-modal">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModal(false)} />
          <form onSubmit={create} className="glass relative z-10 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">New GST Invoice</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-slate-500">Wine Shop (Buyer)</label>
                <select data-testid="invoice-shop-select" value={shopId} onChange={(e) => setShopId(e.target.value)} required
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
                  <option value="">Select shop…</option>
                  {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Invoice Date</label>
                <input data-testid="invoice-date-input" type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
            </div>

            <label className="text-xs text-slate-500">Line Items</label>
            <div className="mt-1 space-y-2" data-testid="invoice-items">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <input data-testid={`item-desc-${i}`} value={it.description} onChange={(e) => setItem(i, "description", e.target.value)} placeholder="Description"
                    className="col-span-5 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <input data-testid={`item-hsn-${i}`} value={it.hsn} onChange={(e) => setItem(i, "hsn", e.target.value)} placeholder="HSN"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <input data-testid={`item-qty-${i}`} type="number" min="0" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} placeholder="Qty"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <input data-testid={`item-rate-${i}`} type="number" step="0.01" min="0" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} placeholder="Rate"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <button type="button" data-testid={`item-remove-${i}`} onClick={() => removeItem(i)} className="col-span-1 flex justify-center text-slate-500 hover:text-red-400"><X className="h-4 w-4" /></button>
                </div>
              ))}
            </div>
            <button type="button" data-testid="add-item-button" onClick={addItem} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-300 hover:underline"><Plus className="h-3.5 w-3.5" /> Add line item</button>

            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-400"><span>Taxable</span><span className="font-mono">{inr(taxable)}</span></div>
              <div className="flex justify-between text-slate-400"><span>CGST {cgp}%</span><span className="font-mono">{inr(cgst)}</span></div>
              <div className="flex justify-between text-slate-400"><span>SGST {sgp}%</span><span className="font-mono">{inr(sgst)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-white/10 font-semibold text-emerald-300"><span>Total (rounded)</span><span className="font-mono" data-testid="invoice-modal-total">{inr(total)}</span></div>
            </div>
            <button data-testid="create-invoice-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2">
              <IndianRupee className="h-4 w-4" /> {saving ? "Creating…" : "Create Invoice"}
            </button>
          </form>
        </div>
      )}

      {payFor && <PaymentModal invoice={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function PaymentModal({ invoice, onClose, onDone }) {
  const [amount, setAmount] = useState(String(invoice.balance ?? invoice.grand_total));
  const [mode, setMode] = useState("UPI");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/payments", { shop_id: invoice.shop_id, invoice_id: invoice.id, amount: parseFloat(amount), mode, payment_date: new Date(payDate).toISOString() });
      toast.success("Payment recorded");
      onDone();
    } catch (err) { toast.error("Failed to record payment"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="payment-modal">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Record Payment · {invoice.invoice_no}</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Balance due: <span className="text-amber-300 font-mono">{inr(invoice.balance ?? invoice.grand_total)}</span></p>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500">Amount (₹)</label>
            <input data-testid="payment-amount-input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
          <div><label className="text-xs text-slate-500">Mode</label>
            <select data-testid="payment-mode-select" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
              {["UPI", "Cash", "Bank Transfer", "Cheque"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-500">Date</label>
            <input data-testid="payment-date-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
        </div>
        <button data-testid="save-payment-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
          {saving ? "Saving…" : "Save Payment"}
        </button>
      </form>
    </div>
  );
}
