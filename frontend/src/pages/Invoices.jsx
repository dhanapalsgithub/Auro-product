import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
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

const generateInvoiceNo = () => {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${rand}`;
};

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [shops, setShops] = useState([]);
  const [settings, setSettings] = useState(null);

  const [canManage] = useState(localStorage.getItem("auro_can_edit") === "true");

  const [search, setSearch] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [payFor, setPayFor] = useState(null);
  const [editId, setEditId] = useState(null);
  const [location, setLocation] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [contact, setContact] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [shopId, setShopId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [behalfWineShopName, setBehalfWineShopName] = useState("");
  const [behalfWineShopNo, setBehalfWineShopNo] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [truckNo, setTruckNo] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [items, setItems] = useState([blankItem()]);

  const safeExtractArray = (res) => {
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.rows)) return res.data.rows;
    if (Array.isArray(res)) return res;
    return [];
  };

  const load = () => {
    let start = "";
    let end = "";
    if (fromMonth) start = `${fromMonth}-01`;
    if (toMonth) {
      const [y, m] = toMonth.split("-");
      const lastDay = new Date(y, m, 0).getDate();
      end = `${toMonth}-${lastDay}`;
    }
    api.get("/invoices", { params: { search, start, end } })
      .then((r) => { 
        setInvoices(safeExtractArray(r)); 
        setPage(1); 
      })
      .catch(() => setInvoices([]));
  };

  useEffect(() => { load(); }, [search, fromMonth, toMonth]);

  useEffect(() => {
    api.get("/shops").then((r) => setShops(safeExtractArray(r))).catch(() => setShops([]));
    api.get("/settings").then((r) => {
      setSettings(r.data);
      const defaultRate = Number(r.data?.rate_beer || r.data?.default_rate || 16);
      setItems([{ ...blankItem(), rate: defaultRate }]);
    }).catch(() => {});
  }, []);

  const rateFor = (type) => {
    const t = (type || "").toLowerCase();
    if (t.includes("beer")) return Number(settings?.rate_beer ?? settings?.default_rate ?? 16);
    if (t.includes("brandy")) return Number(settings?.rate_brandy ?? settings?.default_rate ?? 16);
    return Number(settings?.default_rate ?? 16);
  };

  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const pageCount = Math.max(1, Math.ceil(safeInvoices.length / PAGE_SIZE));
  const rows = useMemo(() => safeInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [safeInvoices, page]);

  const taxable = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.rate || 0)), 0);
  const cgp = settings?.cgst_percent || 2.5, sgp = settings?.sgst_percent || 2.5;
  const cgst = taxable * cgp / 100, sgst = taxable * sgp / 100;
  const total = Math.round(taxable + cgst + sgst);

  const setItem = (i, k, v) => setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, [k]: k === 'quantity' || k === 'rate' ? (v === '' ? '' : Number(v)) : v } : it));
  const addItem = () => setItems((arr) => [...arr, { ...blankItem(), rate: Number(settings?.rate_beer || settings?.default_rate || 16) }]);
  const removeItem = (i) => setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));

  const safeShops = Array.isArray(shops) ? shops : [];

  const handleSelectShop = (id) => {
    setShopId(id);
    const selected = safeShops.find(s => String(s.id || s._id) === String(id));
    if (selected) {
      setBehalfWineShopName(selected.name || "");
      setBehalfWineShopNo(selected.shop_no || "");
      if (!partyName) setPartyName(selected.name || "");
      if (selected.location) setLocation(selected.location);
      if (selected.supervisor) setSupervisor(selected.supervisor);
      if (selected.contact) setContact(selected.contact);
    }
  };

  const handleViewInvoice = (inv) => {
    const targetId = inv.id || inv._id || inv.invoice_id;
    if (!targetId) { toast.error("Invalid invoice reference ID"); return; }
    navigate(`/invoices/${targetId}`);
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setInvoiceNo(generateInvoiceNo());
    setShopId("");
    setPartyName("");
    setBehalfWineShopName("");
    setBehalfWineShopNo("");
    setLocation("");
    setSupervisor("");
    setContact("");
    setInvDate(new Date().toISOString().slice(0, 10));
    setTruckNo("");
    setTotalWeight("");
    setItems([{ ...blankItem(), rate: Number(settings?.default_rate || 16) }]);
    setModal(true);
  };

  const handleOpenEdit = (inv) => {
    if (!canManage) { toast.error("Unauthorized: Only admins can edit invoices"); return; }
    const targetId = inv.id || inv._id;
    setEditId(targetId);
    setInvoiceNo(inv.invoice_no || "");
    setShopId(inv.shop_id || inv.shopId || "");
    setPartyName(inv.party_name || inv.customer_name || "");
    setBehalfWineShopName(inv.behalf_wine_shop_name || "");
    setBehalfWineShopNo(inv.behalf_wine_shop_no || "");
    setLocation(inv.location || "");
    setSupervisor(inv.supervisor || "");
    setContact(inv.contact || "");
    setTruckNo(inv.truck_no || "");
    setTotalWeight(inv.total_weight || "");

    if (inv.invoice_date) setInvDate(inv.invoice_date.slice(0, 10));

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
    if (!canManage && editId) { toast.error("Unauthorized: Only admins can edit invoices"); return; }
    if (!partyName) { toast.error("Enter Party Name"); return; }

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

    let resolvedShopId = shopId ? Number(shopId) : null;
    let resolvedShopNo = behalfWineShopNo;

    if (!resolvedShopId && partyName) {
      const existing = safeShops.find(
        (s) =>
          (s.name || "").trim().toLowerCase() === partyName.trim().toLowerCase() ||
          (s.shop_no || "").trim().toLowerCase() === partyName.trim().toLowerCase()
      );
      if (existing) {
        resolvedShopId = existing.id || existing._id;
        resolvedShopNo = existing.shop_no || resolvedShopNo;
      }
    }

    setSaving(true);
    try {
      const payload = {
        invoice_no: invoiceNo || generateInvoiceNo(),
        shop_id: resolvedShopId,
        shop_no: resolvedShopNo || null,
        customer_name: partyName,
        party_name: partyName,
        behalf_wine_shop_name: behalfWineShopName,
        behalf_wine_shop_no: behalfWineShopNo,
        location: location || null,
        supervisor: supervisor || null,
        contact: contact || null,
        invoice_date: new Date(invDate).toISOString(),
        invoice_type: "SALES",
        truck_no: truckNo,
        total_weight: totalWeight ? Number(totalWeight) : null,
        items: clean,
        cgst_percent: cgp,
        sgst_percent: sgp,
        taxable_amount: calcTaxable,
        total_amount: calcTotal,
        tax_amount: calcCgst + calcSgst,
      };

      if (editId) {
        await api.put(`/invoices/${editId}`, payload);
        toast.success("Sale Invoice updated successfully");
      } else {
        const res = await api.post("/invoices", payload);
        toast.success(`Sale Invoice ${res.data.data?.invoice_no || res.data.invoice_no} created`);
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail?.[0]?.msg || (editId ? "Failed to update invoice" : "Failed to create invoice"));
    } finally {
      setSaving(false);
    }
  };

  const del = async (id) => {
    if (!canManage) { toast.error("Unauthorized: Only admins can delete invoices"); return; }
    if (!window.confirm("Delete invoice?")) return;
    try {
      await api.delete(`/invoices/${id}`);
      toast.success("Deleted");
      load();
    } catch {
      toast.error("Failed to delete invoice");
    }
  };

  const doExport = () => exportToCsv("sale_invoices.csv", safeInvoices, [
    { label: "Invoice No", accessor: "invoice_no" },
    { label: "Date", accessor: (r) => fmtDate(r.invoice_date) },
    { label: "Party Name", accessor: (r) => r.party_name || r.shop_name },
    { label: "On Behalf Of Shop", accessor: (r) => r.behalf_wine_shop_name ? `${r.behalf_wine_shop_no} - ${r.behalf_wine_shop_name}` : "" },
    { label: "Truck No", accessor: "truck_no" },
    { label: "Total Weight (kg)", accessor: "total_weight" },
    { label: "Taxable", accessor: "taxable" },
    { label: "Total", accessor: (r) => r.total_amount ?? r.grand_total },
    { label: "Paid", accessor: "amount_paid" },
    { label: "Closing Balance", accessor: (r) => r.balance ?? r.total_amount ?? r.grand_total },
    { label: "Status", accessor: "status" },
  ]);

  return (
    <div>
      <PageHeader title="Sale Invoices" subtitle="Tamil Nadu Tax Sale Invoices · 5% GST (CGST 2.5% + SGST 2.5%)" icon={Receipt}>
        <button onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Plus className="h-4 w-4" /> New Sale Invoice
        </button>
      </PageHeader>

      <Card className="p-4 mb-4 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no / party name / wine shop / truck…"
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-mono">From Month:</span>
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
          <span className="text-xs text-slate-400 font-mono">To Month:</span>
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Invoice</th>
                <th className="p-4">Date</th>
                <th className="p-4">Party Name</th>
                <th className="p-4 text-right">Total Amount</th>
                <th className="p-4 text-right">Closing Balance</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((i) => (
                <tr key={i.id || i._id} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-cyan-300 cursor-pointer" onClick={() => handleViewInvoice(i)}>{i.invoice_no}</td>
                  <td className="p-4 text-slate-400 font-mono">{fmtDate(i.invoice_date)}</td>
                  <td className="p-4 font-semibold text-slate-200">{i.party_name || i.shop_name}</td>
                  <td className="p-4 text-right font-mono">{inr(i.total_amount ?? i.grand_total)}</td>
                  <td className="p-4 text-right font-mono text-amber-300">{inr(i.balance ?? i.total_amount ?? i.grand_total)}</td>
                  <td className="p-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[i.status] || STATUS.unpaid}`}>{(i.status || "unpaid").toUpperCase()}</span></td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-1.5">
                      {i.status !== "paid" && (
                        <button onClick={() => setPayFor(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-emerald-300" title="Record payment"><Wallet className="h-4 w-4" /></button>
                      )}
                      <button onClick={() => handleViewInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300" title="View Invoice"><Eye className="h-4 w-4" /></button>
                      {canManage && (
                        <>
                          <button onClick={() => handleOpenEdit(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-amber-300" title="Edit Invoice"><Edit className="h-4 w-4" /></button>
                          <button onClick={() => del(i.id || i._id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400" title="Delete"><Trash2 className="h-4 w-4" /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No sale invoices found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={safeInvoices.length} onPage={setPage} /></div>
      </Card>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm" onClick={() => setModal(false)} />
          <form onSubmit={saveInvoice} className="glass relative z-10 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">{editId ? "Edit Sale Invoice" : "New Sale Invoice"}</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>

            {/* Select Existing Shop / Customer Option */}
            {safeShops.length > 0 && (
              <div className="mb-3">
                <label className="text-xs text-slate-500">Select Existing Shop / Customer (Optional)</label>
                <select
                  value={shopId}
                  onChange={(e) => handleSelectShop(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50"
                >
                  <option value="" className="bg-slate-900 text-slate-200">-- Choose Shop or Customer --</option>
                  {safeShops.map((s) => (
                    <option key={s.id || s._id} value={s.id || s._id} className="bg-slate-900 text-slate-200">
                      {s.shop_no ? `${s.shop_no} - ` : ""}{s.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Invoice & Company Basic Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500">Invoice No.</label>
                <input type="text" required placeholder="INV-20261002-1234" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50 font-mono text-cyan-300" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Party / Company Name</label>
                <input type="text" required placeholder="Enter Company / Party Name" value={partyName} onChange={(e) => setPartyName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
            </div>

            {/* Location, Supervisor & Mobile No */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-500">Location / Address</label>
                <input type="text" placeholder="Location Name" value={location} onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Supervisor / Contact Person</label>
                <input type="text" placeholder="Supervisor Name" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Mobile No.</label>
                <input type="tel" placeholder="9876543210" value={contact} onChange={(e) => setContact(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
            </div>

            {/* Logistics & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-500">Invoice Date</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Truck No.</label>
                <input type="text" placeholder="TN 01 AB 1234" value={truckNo} onChange={(e) => setTruckNo(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
              <div>
                <label className="text-xs text-slate-500">Total Weight (kg)</label>
                <input type="number" step="0.01" min="0" placeholder="1500" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
            </div>

            {/* Line Items */}
            <label className="text-xs text-slate-500">Line Items</label>
            <div className="mt-1 space-y-2">
              {items.map((it, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <select value={BOX_TYPES.includes(it.description) ? it.description : ""} onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value, rate: rateFor(e.target.value) } : x))}
                    className="col-span-4 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50">
                    {BOX_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={it.hsn} onChange={(e) => setItem(i, "hsn", e.target.value)} placeholder="HSN"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <input type="number" min="0" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} placeholder="Qty"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <input type="number" step="0.01" min="0" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} placeholder="Rate"
                    className="col-span-2 rounded-lg bg-white/5 border border-white/10 py-2 px-2.5 text-xs outline-none focus:border-cyan-500/50" />
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <span className="text-xs font-mono text-cyan-300">{inr(Number(it.quantity || 0) * Number(it.rate || 0))}</span>
                    <button type="button" onClick={() => removeItem(i)} className="text-slate-500 hover:text-red-400 ml-1"><X className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
            <button type="button" onClick={addItem} className="mt-2 flex items-center gap-1.5 text-xs text-cyan-300 hover:underline"><Plus className="h-3.5 w-3.5" /> Add line item</button>

            {/* Totals Section */}
            <div className="mt-4 rounded-xl bg-white/5 border border-white/10 p-4 text-sm space-y-1.5">
              <div className="flex justify-between text-slate-400"><span>Taxable Total</span><span className="font-mono">{inr(taxable)}</span></div>
              <div className="flex justify-between text-slate-400"><span>CGST {cgp}% + SGST {sgp}%</span><span className="font-mono">{inr(cgst + sgst)}</span></div>
              <div className="flex justify-between pt-1.5 border-t border-white/10 font-semibold text-emerald-300"><span>Invoice Total Amount</span><span className="font-mono">{inr(total)}</span></div>
            </div>

            <button disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60 flex items-center justify-center gap-2">
              <IndianRupee className="h-4 w-4" /> {saving ? "Saving…" : (editId ? "Update Sale Invoice" : "Create Sale Invoice")}
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
      await api.post("/payments", {
        shop_id: invoice.shop_id || invoice.shopId || null,
        invoice_id: invoice.id || invoice._id,
        amount: parseFloat(amount),
        mode,
        payment_date: new Date(payDate).toISOString()
      });
      toast.success("Payment recorded");
      onDone();
    } catch { toast.error("Failed to record payment"); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={submit} className="glass relative z-10 w-full max-w-sm rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Record Payment · {invoice.invoice_no}</h3>
          <button type="button" onClick={onClose}><X className="h-5 w-5 text-slate-400" /></button>
        </div>
        <p className="text-xs text-slate-500 mb-3">Closing Balance due: <span className="text-amber-300 font-mono">{inr(invoice.balance ?? invoice.total_amount ?? invoice.grand_total)}</span></p>
        <div className="space-y-3">
          <div><label className="text-xs text-slate-500">Amount (₹)</label>
            <input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
          <div><label className="text-xs text-slate-500">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
              {["UPI", "Cash", "Bank Transfer", "Cheque"].map((m) => <option key={m} value={m}>{m}</option>)}
            </select></div>
          <div><label className="text-xs text-slate-500">Date</label>
            <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" /></div>
        </div>
        <button disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
          {saving ? "Saving…" : "Save Payment"}
        </button>
      </form>
    </div>
  );
}