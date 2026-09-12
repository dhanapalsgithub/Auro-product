import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Receipt, Plus, Download, Search, Eye, Trash2, X, IndianRupee } from "lucide-react";

const PAGE_SIZE = 10;

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

  // create form
  const [shopId, setShopId] = useState("");
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));

  const load = () => api.get("/invoices", { params: { search, start, end } }).then((r) => { setInvoices(r.data); setPage(1); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, start, end]);
  useEffect(() => {
    api.get("/shops").then((r) => setShops(r.data));
    api.get("/settings").then((r) => { setSettings(r.data); setRate(String(r.data.default_rate || 16)); });
  }, []);

  const pageCount = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const rows = useMemo(() => invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [invoices, page]);

  const taxable = (parseFloat(qty || 0) * parseFloat(rate || 0)) || 0;
  const cgst = taxable * (settings?.cgst_percent || 9) / 100;
  const sgst = taxable * (settings?.sgst_percent || 9) / 100;
  const total = Math.round(taxable + cgst + sgst);

  const create = async (e) => {
    e.preventDefault();
    if (!shopId || !qty || !rate) { toast.error("Fill shop, quantity and rate"); return; }
    setSaving(true);
    try {
      const res = await api.post("/invoices", {
        shop_id: shopId, invoice_date: new Date(invDate).toISOString(),
        items: [{ description: "Cotton Box (Corrugated Paperboard)", hsn: settings?.hsn_code || "4819", unit: "PCS", quantity: parseFloat(qty), rate: parseFloat(rate) }],
        cgst_percent: settings?.cgst_percent || 9, sgst_percent: settings?.sgst_percent || 9,
      });
      toast.success(`Invoice ${res.data.invoice_no} created`);
      setModal(false); setQty(""); load();
      navigate(`/invoices/${res.data.id}`);
    } catch (err) { toast.error("Failed to create invoice"); }
    finally { setSaving(false); }
  };

  const del = async (id) => { if (!window.confirm("Delete invoice?")) return; await api.delete(`/invoices/${id}`); toast.success("Deleted"); load(); };

  const doExport = () => exportToCsv("invoices.csv", invoices, [
    { label: "Invoice No", accessor: "invoice_no" }, { label: "Date", accessor: (r) => fmtDate(r.invoice_date) },
    { label: "Shop No", accessor: "shop_no" }, { label: "Shop", accessor: "shop_name" },
    { label: "Taxable", accessor: "taxable" }, { label: "CGST", accessor: "cgst" },
    { label: "SGST", accessor: "sgst" }, { label: "Total", accessor: "grand_total" },
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
                <th className="p-4 text-right">Taxable</th><th className="p-4 text-right">GST</th><th className="p-4 text-right">Total</th><th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((i) => (
                <tr key={i.id} data-testid={`invoice-row-${i.invoice_no}`} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/invoices/${i.id}`)}>
                  <td className="p-4 font-mono text-cyan-300">{i.invoice_no}</td>
                  <td className="p-4 text-slate-400 font-mono">{fmtDate(i.invoice_date)}</td>
                  <td className="p-4">{i.shop_no} · {i.shop_name}</td>
                  <td className="p-4 text-right font-mono">{inr(i.taxable)}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{inr(i.cgst + i.sgst)}</td>
                  <td className="p-4 text-right font-mono font-semibold text-emerald-300">{inr(i.grand_total)}</td>
                  <td className="p-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
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
          <form onSubmit={create} className="glass relative z-10 w-full max-w-lg rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">New GST Invoice</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500">Wine Shop (Buyer)</label>
                <select data-testid="invoice-shop-select" value={shopId} onChange={(e) => setShopId(e.target.value)} required
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
                  <option value="">Select shop…</option>
                  {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="text-xs text-slate-500">Qty (PCS)</label>
                  <input data-testid="invoice-qty-input" type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} required className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
                <div><label className="text-xs text-slate-500">Rate (₹)</label>
                  <input data-testid="invoice-rate-input" type="number" step="0.01" min="0" value={rate} onChange={(e) => setRate(e.target.value)} required className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
                <div><label className="text-xs text-slate-500">Date</label>
                  <input data-testid="invoice-date-input" type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-1.5">
                <div className="flex justify-between text-slate-400"><span>Taxable</span><span className="font-mono">{inr(taxable)}</span></div>
                <div className="flex justify-between text-slate-400"><span>CGST {settings?.cgst_percent || 9}%</span><span className="font-mono">{inr(cgst)}</span></div>
                <div className="flex justify-between text-slate-400"><span>SGST {settings?.sgst_percent || 9}%</span><span className="font-mono">{inr(sgst)}</span></div>
                <div className="flex justify-between pt-1.5 border-t border-white/10 font-semibold text-emerald-300"><span>Total (rounded)</span><span className="font-mono">{inr(total)}</span></div>
              </div>
            </div>
            <button data-testid="create-invoice-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2">
              <IndianRupee className="h-4 w-4" /> {saving ? "Creating…" : "Create Invoice"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
