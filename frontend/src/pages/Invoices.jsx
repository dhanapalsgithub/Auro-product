import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Receipt, Plus, Download, Search, Eye, Edit, Trash2, X, IndianRupee, Wallet } from "lucide-react";
import { BOX_TYPES } from "@/lib/boxTypes";

const PAGE_SIZE = 10;
const STATUS = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unpaid: "bg-red-500/15 text-red-300 border-red-500/30",
};
const blankItem = () => ({ description: BOX_TYPES[0], hsn: "4819", unit: "PCS", quantity: 1, rate: 16 });

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // Admin-only permission check for edit and delete (creation is allowed for all users)
  const [canManage] = useState(localStorage.getItem("auro_can_edit") === "true");

  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const [editId, setEditId] = useState(null);

  const [shopId, setShopId] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [invoiceType, setInvoiceType] = useState("SALES");
  const [items, setItems] = useState([blankItem()]);

  const load = () => api.get("/invoices", { params: { search, start, end } }).then((r) => { setInvoices(r.data); setPage(1); });
  
  useEffect(() => { load(); }, [search, start, end]);
  
  useEffect(() => {
    api.get("/shops").then((r) => setShops(r.data));
    api.get("/settings").then((r) => { 
      setSettings(r.data); 
      const defaultRate = Number(r.data.rate_beer || r.data.default_rate || 16);
      setItems([{ ...blankItem(), rate: defaultRate }]); 
    });
  }, []);

  const rateFor = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("beer")) return Number(settings?.rate_beer ?? settings?.default_rate ?? 16);
    if (t.includes("brandy")) return Number(settings?.rate_brandy ?? settings?.default_rate ?? 16);
    return Number(settings?.default_rate ?? 16);
  };

  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const rows = useMemo(() => invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [invoices, page]);

  const taxable = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.rate || 0)), 0);
  const cgp = settings?.cgst_percent || 2.5, sgp = settings?.sgst_percent || 2.5;
  const cgst = taxable * cgp / 100, sgst = taxable * sgp / 100;
  const total = Math.round(taxable + cgst + sgst);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: k === 'quantity' || k === 'rate' ? (v === '' ? '' : Number(v)) : v } : it));
  const addItem = () => setItems((arr) => [...arr, { ...blankItem(), rate: Number(settings?.rate_beer || settings?.default_rate || 16) }]);
  const removeItem = (i) => setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));

  const handleViewInvoice = (inv) => {
    const targetId = inv.id || inv._id || inv.invoice_id;
    if (!targetId) {
      toast.error("Invalid invoice reference ID");
      return;
    }
    navigate(`/invoices/${targetId}`);
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setShopId("");
    setInvDate(new Date().toISOString().slice(0, 10));
    setInvoiceType("SALES");
    setItems([{ ...blankItem(), rate: Number(settings?.default_rate || 16) }]);
    setModal(true);
  };

  const handleOpenEdit = (inv) => {
    if (!canManage) {
      toast.error("Unauthorized: Only admins can edit invoices");
      return;
    }
    const targetId = inv.id || inv._id;
    setEditId(targetId);
    setShopId(inv.shop_id || inv.shopId || "");
    setInvoiceType(inv.invoice_type || "SALES");
    
    if (inv.invoice_date) {
      setInvDate(inv.invoice_date.slice(0, 10));
    }
    
    if (inv.items && inv.items.length > 0) {
      setItems(inv.items.map(it => ({
        description: it.description || BOX_TYPES[0],
        hsn: it.hsn || "4819",
        unit: it.unit || "PCS",
        quantity: it.quantity || 1,
        rate: it.rate || 16
      })));
    } else {
      setItems([{ ...blankItem(), rate: Number(settings?.default_rate || 16) }]);
    }
    
    setModal(true);
  };

  const saveInvoice = async (e) => {
    e.preventDefault();
    if (!canManage && editId) {
      toast.error("Unauthorized: Only admins can edit invoices");
      return;
    }
    if (!shopId) { toast.error("Select a shop"); return; }
    
    const clean = items.filter((it) => it.quantity !== "" && it.rate !== "").map((it) => ({ 
      ...it, 
      quantity: Number(it.quantity), 
      rate: Number(it.rate),
      amount: Number(it.quantity) * Number(it.rate)
    }));

    if (clean.length === 0) { toast.error("Add at least one line item"); return; }
    
    const calcTaxable = clean.reduce((s, it) => s + it.amount, 0);
    const calcCgst = calcTaxable * cgp / 100;
    const calcSgst = calcTaxable * sgp / 100;
    const calcTotal = Math.round(calcTaxable + calcCgst + calcSgst);
    const calcTaxAmount = calcCgst + calcSgst;

    setSaving(true);
    try {
      let parsedDate = invDate;
      if (invDate.includes("-") && invDate.split("-")[0].length === 2) {
        const [d, m, y] = invDate.split("-");
        parsedDate = `${y}-${m}-${d}`;
      }
      const formattedDate = new Date(`${parsedDate}T00:00:00Z`).toISOString();

      const payload = { 
        shop_id: shopId, 
        invoice_date: formattedDate, 
        invoice_type: invoiceType,
        items: clean, 
        cgst_percent: cgp, 
        sgst_percent: sgp,
        total_amount: calcTotal,
        tax_amount: calcTaxAmount
      };

      if (editId) {
        await api.put(`/invoices/${editId}`, payload);
        toast.success("Invoice updated successfully");
        setModal(false);
        load();
      } else {
        const res = await api.post("/invoices", payload);
        toast.success(`Invoice ${res.data.invoice_no} created`);
        setModal(false); 
        navigate(`/invoices/${res.data.id || res.data._id}`);
      }
    } catch (err) { 
      toast.error(editId ? "Failed to update invoice" : "Failed to create invoice"); 
    } finally { 
      setSaving(false); 
    }
  };

  const del = async (id) => { 
    if (!canManage) {
      toast.error("Unauthorized: Only admins can delete invoices");
      return;
    }
    if (!window.confirm("Delete invoice?")) return; 
    try {
      await api.delete(`/invoices/${id}`); 
      toast.success("Deleted"); 
      load(); 
    } catch (err) {
      toast.error("Failed to delete invoice");
    }
  };

  const doExport = () => exportToCsv("invoices.csv", invoices, [
    { label: "Invoice No", accessor: "invoice_no" }, 
    { label: "Date", accessor: (r) => fmtDate(r.invoice_date) },
    { label: "Type", accessor: "invoice_type" },
    { 
      label: "Shop No", 
      accessor: (r) => {
        const foundShop = shops.find(s => String(s.id || s._id) === String(r.shop_id || r.shopId));
        return r.shop_no || r.shopNo || foundShop?.shop_no || "";
      } 
    }, 
    { 
      label: "Shop", 
      accessor: (r) => {
        const foundShop = shops.find(s => String(s.id || s._id) === String(r.shop_id || r.shopId));
        return r.shop_name || r.shopName || foundShop?.name || "";
      } 
    },
    { label: "Taxable", accessor: "taxable" }, 
    { label: "Total", accessor: (r) => r.total_amount ?? r.grand_total },
    { label: "Paid", accessor: "amount_paid" }, 
    { label: "Balance", accessor: (r) => r.balance ?? r.total_amount ?? r.grand_total }, 
    { label: "Status", accessor: "status" },
  ]);

  return (
    <div>
      <PageHeader title="GST Invoices" subtitle="Tamil Nadu Tax Invoices · 5% GST (CGST 2.5% + SGST 2.5%)" icon={Receipt}>
        <button data-testid="export-invoices-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
        {/* Creation is allowed for all users */}
        <button data-testid="new-invoice-button" onClick={handleOpenCreate} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
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
                <th className="p-4">Invoice</th><th className="p-4">Date</th><th className="p-4">Type</th><th className="p-4">Shop</th>
                <th className="p-4 text-right">Total</th><th className="p-4 text-right">Balance</th><th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((i) => {
                const matchedShop = shops.find(s => String(s.id || s._id) === String(i.shop_id || i.shopId));
                const displayShopNo = i.shop_no || i.shopNo || matchedShop?.shop_no || "";
                const displayShopName = i.shop_name || i.shopName || matchedShop?.name || "Unknown Shop";

                return (
                  <tr key={i.id || i._id} data-testid={`invoice-row-${i.invoice_no}`} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-mono text-cyan-300 cursor-pointer" onClick={() => handleViewInvoice(i)}>{i.invoice_no}</td>
                    <td className="p-4 text-slate-400 font-mono">{fmtDate(i.invoice_date)}</td>
                    <td className="p-4"><span className="text-xs font-semibold px-2 py-0.5 rounded bg-white/10">{i.invoice_type || "SALES"}</span></td>
                    <td className="p-4">{displayShopNo ? `${displayShopNo} · ` : ""}{displayShopName}</td>
                    <td className="p-4 text-right font-mono">{inr(i.total_amount ?? i.grand_total)}</td>
                    <td className="p-4 text-right font-mono text-amber-300">{inr(i.balance ?? i.total_amount ?? i.grand_total)}</td>
                    <td className="p-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[i.status] || STATUS.unpaid}`}>{(i.status || "unpaid").toUpperCase()}</span></td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-1.5">
                        {i.status !== "paid" && (
                          <button data-testid={`pay-invoice-${i.invoice_no}`} onClick={() => setPayFor(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-emerald-300" title="Record payment"><Wallet className="h-4 w-4" /></button>
                        )}
                        <button data-testid={`view-invoice-${i.invoice_no}`} onClick={() => handleViewInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300" title="View Invoice"><Eye className="h-4 w-4" /></button>
                        
                        {canManage && (
                          <>
                            <button data-testid={`edit-invoice-${i.invoice_no}`} onClick={() => handleOpenEdit(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-amber-300" title="Edit Invoice"><Edit className="h-4 w-4" /></button>
                            <button data-testid={`delete-invoice-${i.invoice_no}`} onClick={() => del(i.id || i._id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-slate-500">No invoices yet. Create your first GST invoice.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={invoices.length} onPage={setPage} testid="invoices-pager" /></div>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="invoice-modal">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModal(false)} />
          <form onSubmit={saveInvoice} className="glass relative z-10 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">{editId ? "Edit GST Invoice" : "New GST Invoice"}</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            <div className="mb-4">
              <label className="text-xs text-slate-500 block mb-1.5">Invoice Type</label>
              <div className="flex gap-4 p-2 rounded-xl bg-white/5 border border-white/10">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="invType" value="SALES" checked={invoiceType === "SALES"} onChange={() => setInvoiceType("SALES")} className="text-cyan-500" />
                  <span>Sales Invoice</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input type="radio" name="invType" value="PURCHASE" checked={invoiceType === "PURCHASE"} onChange={() => setInvoiceType("PURCHASE")} className="text-cyan-500" />
                  <span>Purchase Invoice</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div className="sm:col-span-1">
                <label className="text-xs text-slate-500">Wine Shop (Buyer)</label>
                <select data-testid="invoice-shop-select" value={shopId} onChange={(e) => setShopId(e.target.value)} required
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
                  <option value="">Select shop…</option>
                  {shops.map((s) => <option key={s.id || s._id} value={s.id || s._id}>{s.shop_no} · {s.name}</option>)}
                </select>
              </div>
              <div><label className="text-xs text-slate-500">Invoice Date</label>
                <input data-testid="invoice-date-input" type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
            </div>

            <label className="text-xs text-slate-500">Line Items</label>
            <div className="mt-1 space-y-2" data-testid="invoice-items">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select data-testid={`item-desc-${i}`} value={BOX_TYPES.includes(it.description) ? it.description : ""} onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value, rate: rateFor(e.target.value) } : x))}
                    className="col-span-5 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50">
                    {BOX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
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
              <IndianRupee className="h-4 w-4" /> {saving ? "Saving…" : (editId ? "Update Invoice" : "Create Invoice")}
            </button>
          </form>
        </div>
      )}

      {payFor && <PaymentModal invoice={payFor} onClose={() => setPayFor(null)} onDone={() => { setPayFor(null); load(); }} />}
    </div>
  );
}

function PaymentModal({ invoice, onClose, onDone }) {
  const [amount, setAmount] = useState(String(invoice.balance ?? invoice.total_amount ?? invoice.grand_total));
  const [mode, setMode] = useState("UPI");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/payments", { shop_id: invoice.shop_id || invoice.shopId, invoice_id: invoice.id || invoice._id, amount: parseFloat(amount), mode, payment_date: new Date(payDate).toISOString() });
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
        <p className="text-xs text-slate-500 mb-3">Balance due: <span className="text-amber-300 font-mono">{inr(invoice.balance ?? invoice.total_amount ?? invoice.grand_total)}</span></p>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500">Amount (₹)</label>
            <input data-testid="payment-amount-input" type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
          <div><label className="text-xs text-slate-500">Mode</label>
            <select data-testid="payment-mode-select" value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
              {["UPI", "Cash", "Bank Transfer", "Cheque"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-500">Date</label>
            <input data-testid="payment-date-input" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
        </div>
        <button data-testid="save-payment-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
          {saving ? "Saving…" : "Save Payment"}
        </button>
      </form>
    </div>
  );
}