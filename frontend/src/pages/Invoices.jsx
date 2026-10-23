import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Receipt, Plus, Download, Search, Eye, Edit, Trash2, X, Wallet, Building2, Phone, MapPin, IndianRupee, Scale } from "lucide-react";
import { BOX_TYPES } from "@/lib/boxTypes";

const PAGE_SIZE = 10;
const STATUS = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unpaid: "bg-red-500/15 text-red-300 border-red-500/30",
};

const BRANDY_BOX_WEIGHT = 0.420; // 420g
const BEER_BOX_WEIGHT = 0.220;   // 220g

const blankItem = () => ({ description: BOX_TYPES[0] || "Brandy Box (420g)", hsn: "4819", unit: "PCS", quantity: 1, rate: 16 });

const generateInvoiceNo = () => {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `INV-${dateStr}-${rand}`;
};

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [settings, setSettings] = useState(null);
  const [activeTab, setActiveTab] = useState("invoices");

  const [canManage] = useState(localStorage.getItem("auro_can_edit") === "true");

  const [search, setSearch] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const [location, setLocation] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [contact, setContact] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("");
  const [shopId, setShopId] = useState("");
  const [partyName, setPartyName] = useState("");
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

    api.get("/companies")
      .then((r) => setCompanies(safeExtractArray(r)))
      .catch(() => setCompanies([]));
  };

  useEffect(() => { load(); }, [search, fromMonth, toMonth]);

  useEffect(() => {
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

  const companyList = useMemo(() => {
    return companies;
  }, [companies]);

  const summary = useMemo(() => {
    const totalSales = safeInvoices.reduce((acc, i) => acc + (Number(i.total_amount) || 0), 0);
    const totalPaid = safeInvoices.reduce((acc, i) => acc + (Number(i.amount_paid) || 0), 0);
    const totalBalance = totalSales - totalPaid;
    const uniqueCompanies = companyList.length;

    const totalBrandyWaste = safeInvoices.reduce((acc, i) => {
      const waste = i.waste_kg !== undefined && i.waste_kg !== null 
        ? Number(i.waste_kg) 
        : (Array.isArray(i.items) ? i.items : []).reduce((sum, item) => {
            const desc = (item.description || "").toLowerCase();
            if (desc.includes("brandy")) {
              return sum + (Number(item.quantity || 0) * BRANDY_BOX_WEIGHT);
            }
            return sum;
          }, 0);
      return acc + waste;
    }, 0);

    return { totalSales, totalPaid, totalBalance, uniqueCompanies, totalBrandyWaste };
  }, [safeInvoices, companyList]);

  const calculatedWasteKg = useMemo(() => {
    return items.reduce((acc, it) => {
      const desc = (it.description || "").toLowerCase();
      const qty = Number(it.quantity || 0);
      if (desc.includes("brandy")) {
        return acc + (qty * BRANDY_BOX_WEIGHT);
      }
      return acc;
    }, 0);
  }, [items]);

  useEffect(() => {
    let weightSum = 0;
    items.forEach((it) => {
      const desc = (it.description || "").toLowerCase();
      const qty = Number(it.quantity || 0);
      if (desc.includes("brandy")) {
        weightSum += qty * BRANDY_BOX_WEIGHT;
      } else if (desc.includes("beer")) {
        weightSum += qty * BEER_BOX_WEIGHT;
      }
    });
    if (weightSum > 0) {
      setTotalWeight(weightSum.toFixed(2));
    }
  }, [items]);

  const grossTaxable = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.rate || 0)), 0);
  const wasteDeductionVal = items.reduce((s, it) => {
    const desc = (it.description || "").toLowerCase();
    if (desc.includes("brandy")) {
      return s + (Number(it.quantity || 0) * BRANDY_BOX_WEIGHT * Number(it.rate || 0));
    }
    return s;
  }, 0);

  const taxable = Math.max(0, grossTaxable - wasteDeductionVal);
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

  // DELETE INVOICE HANDLER
  const handleDeleteInvoice = async (inv) => {
    if (!canManage) { toast.error("Unauthorized: Only admins can delete invoices"); return; }
    const targetId = inv.id || inv._id || inv.invoice_id;
    if (!targetId) { toast.error("Invalid invoice ID"); return; }

    if (window.confirm(`Are you sure you want to delete invoice ${inv.invoice_no}?`)) {
      try {
        await api.delete(`/invoices/${targetId}`);
        toast.success("Invoice deleted successfully");
        load();
      } catch (err) {
        toast.error(err?.response?.data?.detail || "Failed to delete invoice");
      }
    }
  };

  const handleOpenCreate = () => {
    setEditId(null);
    setInvoiceNo(generateInvoiceNo());
    setShopId("");
    setPartyName("");
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
    if (!partyName) { toast.error("Enter Party / Company Name"); return; }

    const clean = items.filter((it) => it.quantity !== "" && it.rate !== "").map((it) => ({
      ...it,
      quantity: Number(it.quantity),
      rate: Number(it.rate),
      amount: Number(it.quantity) * Number(it.rate)
    }));

    if (clean.length === 0) { toast.error("Add at least one line item"); return; }

    setSaving(true);
    try {
      const payload = {
        invoice_no: invoiceNo || generateInvoiceNo(),
        shop_id: shopId ? Number(shopId) : null,
        party_name: partyName,
        customer_name: partyName,
        location: location || null,
        supervisor: supervisor || null,
        contact: contact || null,
        invoice_date: new Date(invDate).toISOString(),
        invoice_type: "SALES",
        truck_no: truckNo,
        total_weight: totalWeight ? Number(totalWeight) : null,
        waste_kg: Number(calculatedWasteKg.toFixed(2)),
        items: clean,
        cgst_percent: cgp,
        sgst_percent: sgp,
        taxable_amount: taxable,
        total_amount: total,
        tax_amount: cgst + sgst,
      };

      if (editId) {
        await api.put(`/invoices/${editId}`, payload);
        toast.success("Sale Invoice updated successfully");
      } else {
        const res = await api.post("/invoices", payload);
        toast.success(`Sale Invoice ${res.data.invoice_no || 'Created'} created`);
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail?.[0]?.msg || (editId ? "Failed to update invoice" : "Failed to create invoice"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Sale Invoices" subtitle="Tamil Nadu Tax Sale Invoices · GST Sales Summary & Company Management" icon={Receipt}>
        <button onClick={() => exportToCsv("sale_invoices.csv", safeInvoices)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
        <button onClick={handleOpenCreate} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Plus className="h-4 w-4" /> New Sale Invoice
        </button>
      </PageHeader>

      {/* TOP SUMMARY CARDS WITH HOVER EXPAND / NO SHRINK */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-cyan-500/10 to-blue-500/5 border-cyan-500/25 group relative cursor-pointer" title={`Total Companies: ${summary.uniqueCompanies}`}>
          <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 shrink-0"><Building2 className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Companies</p>
            <p className="text-lg font-bold font-mono text-cyan-300 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:absolute group-hover:bg-slate-900 group-hover:p-2 group-hover:z-20 group-hover:shadow-lg group-hover:rounded-lg">{summary.uniqueCompanies}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/25 group relative cursor-pointer" title={`Total Sales: ${inr(summary.totalSales)}`}>
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0"><IndianRupee className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Sales</p>
            <p className="text-lg font-bold font-mono text-emerald-300 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:absolute group-hover:bg-slate-900 group-hover:p-2 group-hover:z-20 group-hover:shadow-lg group-hover:rounded-lg">{inr(summary.totalSales)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/25 group relative cursor-pointer" title={`Total Paid: ${inr(summary.totalPaid)}`}>
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0"><Wallet className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Paid</p>
            <p className="text-lg font-bold font-mono text-amber-300 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:absolute group-hover:bg-slate-900 group-hover:p-2 group-hover:z-20 group-hover:shadow-lg group-hover:rounded-lg">{inr(summary.totalPaid)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/25 group relative cursor-pointer" title={`Total Outstanding: ${inr(summary.totalBalance)}`}>
          <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0"><Receipt className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Outstanding</p>
            <p className="text-lg font-bold font-mono text-red-300 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:absolute group-hover:bg-slate-900 group-hover:p-2 group-hover:z-20 group-hover:shadow-lg group-hover:rounded-lg">{inr(summary.totalBalance)}</p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-500/25 sm:col-span-2 xl:col-span-1 group relative cursor-pointer" title={`Total Brandy Waste: ${summary.totalBrandyWaste.toFixed(2)} kg`}>
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0"><Scale className="h-5 w-5" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Brandy Waste</p>
            <p className="text-lg font-bold font-mono text-purple-300 truncate group-hover:whitespace-normal group-hover:overflow-visible group-hover:absolute group-hover:bg-slate-900 group-hover:p-2 group-hover:z-20 group-hover:shadow-lg group-hover:rounded-lg">{summary.totalBrandyWaste.toFixed(2)} kg</p>
          </div>
        </Card>
      </div>

      {/* VIEW TABS */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => setActiveTab("invoices")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "invoices" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
          All Sale Invoices ({safeInvoices.length})
        </button>
        <button onClick={() => setActiveTab("companies")} className={`px-4 py-2 rounded-xl text-sm font-medium transition ${activeTab === "companies" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
          Company Directory ({companyList.length})
        </button>
      </div>

      {activeTab === "invoices" ? (
        <>
          <Card className="p-4 mb-4 flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no / party name / wine shop / truck…"
                className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-mono">From:</span>
              <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
              <span className="text-xs text-slate-400 font-mono">To:</span>
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
                    <th className="p-4">Party / Company Name</th>
                    <th className="p-4">Mobile & Address</th>
                    <th className="p-4 text-center">Brandy Waste</th>
                    <th className="p-4 text-right">Taxable Amount</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((i) => {
                    const brandyWaste = i.waste_kg !== undefined && i.waste_kg !== null 
                      ? Number(i.waste_kg) 
                      : (Array.isArray(i.items) ? i.items : []).reduce((sum, item) => {
                          const desc = (item.description || "").toLowerCase();
                          if (desc.includes("brandy")) {
                            return sum + (Number(item.quantity || 0) * BRANDY_BOX_WEIGHT);
                          }
                          return sum;
                        }, 0);

                    return (
                      <tr key={i.id || i._id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-cyan-300 cursor-pointer underline" onClick={() => handleViewInvoice(i)}>{i.invoice_no}</td>
                        <td className="p-4 text-slate-400 font-mono">{fmtDate(i.invoice_date)}</td>
                        <td className="p-4 font-semibold text-black-200">
                          {i.party_name || i.customer_name || i.shop_name}
                          {i.supervisor && <span className="block text-xs font-normal text-slate-400">Supervisor: {i.supervisor}</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-300">
                          {i.contact && <div className="flex items-center gap-1"><Phone className="h-3 w-3 text-cyan-400" />{i.contact}</div>}
                          {i.location && <div className="flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3 text-emerald-400" />{i.location}</div>}
                          {!i.contact && !i.location && <span className="text-slate-500">-</span>}
                        </td>
                        <td className="p-4 text-center font-mono text-amber-400 font-semibold">
                          {brandyWaste > 0 ? `${brandyWaste.toFixed(2)} kg` : "-"}
                        </td>
                        <td className="p-4 text-right font-mono">{inr(i.taxable_amount)}</td>
                        <td className="p-4 text-right font-mono">{inr(i.total_amount ?? i.grand_total)}</td>
                        <td className="p-4 text-center"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[i.status] || STATUS.unpaid}`}>{(i.status || "unpaid").toUpperCase()}</span></td>
                        <td className="p-4">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleViewInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition" title="View Invoice"><Eye className="h-4 w-4" /></button>
                            {canManage && (
                              <>
                                <button onClick={() => handleOpenEdit(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-amber-300 transition" title="Edit Invoice"><Edit className="h-4 w-4" /></button>
                                <button onClick={() => handleDeleteInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400 transition" title="Delete Invoice"><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {rows.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-slate-500">No sale invoices found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="px-4"><Pager page={page} pageCount={pageCount} total={safeInvoices.length} onPage={setPage} /></div>
          </Card>
        </>
      ) : (
        <Card className="overflow-hidden">
          <div className="p-4 border-b border-white/10 font-bold text-black-200">Company Details Directory (From Sales Invoices)</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                  <th className="p-4">Company Name</th>
                  <th className="p-4">Location / Address</th>
                  <th className="p-4">Contact / Mobile</th>
                  <th className="p-4">Supervisor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {companyList.map((c, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 font-semibold text-amber-300">{c.name}</td>
                    <td className="p-4 text-slate-300">{c.location}</td>
                    <td className="p-4 font-mono text-emerald-400">{c.contact}</td>
                    <td className="p-4 text-slate-400">{c.supervisor}</td>
                  </tr>
                ))}
                {companyList.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-slate-500">No companies recorded from invoices.</td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(false)} />
          <form onSubmit={saveInvoice} className="glass relative z-10 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto text-slate-800 bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-slate-900">{editId ? "Edit Sale Invoice" : "New Sale Invoice"}</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-500 hover:text-slate-700" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-600 font-medium">Invoice No.</label>
                <input type="text" required placeholder="INV-20261002-1234" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono text-cyan-700 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs text-amber-600 font-medium">Party / Company Name</label>
                <input type="text" required placeholder="Enter Company / Party Name" value={partyName} onChange={(e) => setPartyName(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-amber-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-600 font-medium">Location / Address</label>
                <input type="text" placeholder="Location Name" value={location} onChange={(e) => setLocation(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Supervisor / Contact Person</label>
                <input type="text" placeholder="Supervisor Name" value={supervisor} onChange={(e) => setSupervisor(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Mobile No.</label>
                <input type="tel" placeholder="9876543210" value={contact} onChange={(e) => setContact(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="text-xs text-slate-600 font-medium">Invoice Date</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Truck No.</label>
                <input type="text" placeholder="TN 01 AB 1234" value={truckNo} onChange={(e) => setTruckNo(e.target.value)} className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Total Weight (kg)</label>
                <input type="number" step="0.01" min="0" placeholder="Auto Calculated" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400 font-semibold" />
              </div>
            </div>

            <label className="text-xs text-slate-600 font-medium">Line Items</label>
            <div className="mt-1 space-y-2">
              {items.map((it, i) => {
                const isBrandy = (it.description || "").toLowerCase().includes("brandy");
                const isBeer = (it.description || "").toLowerCase().includes("beer");
                const perBoxWeight = isBrandy ? BRANDY_BOX_WEIGHT : isBeer ? BEER_BOX_WEIGHT : 0;
                const perBoxRate = (perBoxWeight * Number(it.rate || 0)).toFixed(2);

                return (
                  <div key={i} className="flex flex-col gap-1 border border-slate-200 p-2 rounded-lg bg-slate-50">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <select value={BOX_TYPES.includes(it.description) ? it.description : ""} onChange={(e) => setItems((arr) => arr.map((x, idx) => idx === i ? { ...x, description: e.target.value, rate: rateFor(e.target.value) } : x))}
                        className="col-span-4 rounded-lg bg-white border border-slate-300 py-2 px-2.5 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500">
                        {BOX_TYPES.map((t) => <option key={t} value={t} className="bg-white text-slate-800">{t}</option>)}
                      </select>
                      <input value={it.hsn} onChange={(e) => setItem(i, "hsn", e.target.value)} placeholder="HSN"
                        className="col-span-2 rounded-lg bg-white border border-slate-300 py-2 px-2.5 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
                      <input type="number" min="1" value={it.quantity} onChange={(e) => setItem(i, "quantity", e.target.value)} placeholder="Box Qty"
                        className="col-span-2 rounded-lg bg-white border border-slate-300 py-2 px-2.5 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
                      <input type="number" step="0.01" value={it.rate} onChange={(e) => setItem(i, "rate", e.target.value)} placeholder="Rate / KG"
                        className="col-span-3 rounded-lg bg-white border border-slate-300 py-2 px-2.5 text-xs text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
                      <button type="button" onClick={() => removeItem(i)} className="col-span-1 p-2 text-red-500 hover:text-red-700 flex justify-center"><Trash2 className="h-4 w-4" /></button>
                    </div>
                    {perBoxWeight > 0 && (
                      <div className="text-[11px] text-cyan-700 font-medium px-1 flex justify-between">
                        <span>Default Weight: {perBoxWeight * 1000}g / box</span>
                        <span>Rate per box: ₹{perBoxRate}</span>
                      </div>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addItem} className="text-xs font-semibold text-cyan-600 hover:text-cyan-700 flex items-center gap-1 mt-2">
                <Plus className="h-3.5 w-3.5" /> Add Line Item
              </button>
            </div>

            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between font-medium text-amber-900">
                <span className="flex items-center gap-1"><Scale className="h-3.5 w-3.5 text-amber-600" /> Brandy Waste Deducted:</span>
                <span className="font-bold">{calculatedWasteKg.toFixed(2)} kg</span>
              </div>
              <p className="text-[11px] text-amber-700">Calculated strictly at 420g/box and deducted from taxable billing amount.</p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-200 text-xs space-y-1">
              <div className="flex justify-between text-slate-600"><span>Gross Taxable Amount</span><span>₹{grossTaxable.toFixed(2)}</span></div>
              <div className="flex justify-between text-red-600 font-medium"><span>Less Waste Deduction Value</span><span>- ₹{wasteDeductionVal.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-slate-800 border-t pt-1"><span>Net Taxable Amount</span><span>₹{taxable.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>CGST ({cgp}%)</span><span>₹{cgst.toFixed(2)}</span></div>
              <div className="flex justify-between text-slate-600"><span>SGST ({sgp}%)</span><span>₹{sgst.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200"><span>Grand Total</span><span>₹{total.toFixed(2)}</span></div>
            </div>

            <button type="submit" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 py-3 text-sm font-semibold text-white active:scale-95 transition shadow-sm">
              {saving ? "Saving…" : editId ? "Update Sale Invoice" : "Create Sale Invoice"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}