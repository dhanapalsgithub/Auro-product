import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { toast } from "sonner";
import { Receipt, Plus, Download, Search, Eye, Edit, Trash2, X, Wallet, Building2, Phone, MapPin, IndianRupee, Scale, Printer, ArrowLeft } from "lucide-react";
import { BOX_TYPES } from "@/lib/boxTypes";

const PAGE_SIZE = 10;
const STATUS = {
  paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  partial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unpaid: "bg-red-500/15 text-red-300 border-red-500/30",
};

const BRANDY_BOX_WEIGHT = 0.420; // 420g
const BEER_BOX_WEIGHT = 0.220;   // 220g

const blankItem = () => ({ description: BOX_TYPES[0] || "Brandy Box (420g)", unit: "PCS", quantity: 1, rate: "" });

function numberToWords(num) {
  if (!num || isNaN(num)) return "Zero Rupees Only";
  const amount = Math.round(num);
  if (amount === 0) return "Zero Rupees Only";

  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n) {
    let str = '';
    if (n >= 10000000) {
      str += inWords(Math.floor(n / 10000000)) + 'Crore ';
      n %= 10000000;
    }
    if (n >= 100000) {
      str += inWords(Math.floor(n / 100000)) + 'Lakh ';
      n %= 100000;
    }
    if (n >= 1000) {
      str += inWords(Math.floor(n / 1000)) + 'Thousand ';
      n %= 1000;
    }
    if (n >= 100) {
      str += inWords(Math.floor(n / 100)) + 'Hundred ';
      n %= 100;
    }
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) {
        str += a[n];
      } else {
        str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
      }
    }
    return str;
  }

  return inWords(amount).trim() + " Rupees Only";
}

export default function Invoices() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [settings, setSettings] = useState({ cgst_percent: 2.5, sgst_percent: 2.5 });
  const [activeTab, setActiveTab] = useState("invoices");

  const [search, setSearch] = useState("");
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);

  const [viewModal, setViewModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const [location, setLocation] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [contact, setContact] = useState("");

  const [invoiceNo, setInvoiceNo] = useState("AP-INV-00001");
  const [shopId, setShopId] = useState("");
  const [partyName, setPartyName] = useState("");
  const [invDate, setInvDate] = useState(new Date().toISOString().slice(0, 10));
  const [truckNo, setTruckNo] = useState("");
  const [totalWeight, setTotalWeight] = useState("");
  const [items, setItems] = useState([blankItem()]);

  const [beerQty, setBeerQty] = useState(0);
  const [brandyQty, setBrandyQty] = useState(0);

  // User Rates per KG
  const [beerRateKg, setBeerRateKg] = useState("");
  const [brandyRateKg, setBrandyRateKg] = useState("");
  const [totalWasteRateKg, setTotalWasteRateKg] = useState("");

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
      if (r.data) setSettings(r.data);
    }).catch(() => {});
  }, []);

  // Fetch entries on date selection
  useEffect(() => {
    if (modal && invDate && !editId) {
      api.get("/entries", { params: { date: invDate, shop_id: shopId || undefined } })
        .then((res) => {
          const entryList = safeExtractArray(res);
          let totalBrandy = 0;
          let totalBeer = 0;
          let apiTotalWeight = 0;

          if (entryList.length > 0) {
            entryList.forEach((e) => {
              totalBrandy += Number(e.brandy_qty || 0);
              totalBeer += Number(e.beer_qty || 0);
              apiTotalWeight += Number(e.waste_kg || e.total_weight || e.weight || 0);
              if (!e.brandy_qty && !e.beer_qty && e.quantity) {
                totalBrandy += Number(e.quantity);
              }
            });
            toast.success(`Loaded box entries for ${invDate}`);
          }
          setBeerQty(totalBeer);
          setBrandyQty(totalBrandy);
          if (apiTotalWeight > 0) {
            setTotalWeight(apiTotalWeight.toFixed(2));
          } else {
            setTotalWeight("0.00");
          }
        })
        .catch(() => {
          setBeerQty(0);
          setBrandyQty(0);
          setTotalWeight("0.00");
        });
    }
  }, [invDate, shopId, modal, editId]);

  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  const pageCount = Math.max(1, Math.ceil(safeInvoices.length / PAGE_SIZE));
  const rows = useMemo(() => safeInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [safeInvoices, page]);
  const companyList = useMemo(() => companies, [companies]);

  // Weight Calculations
  const parsedBeerWeight = Number((beerQty * BEER_BOX_WEIGHT).toFixed(2));
  const parsedBrandyWeight = Number((brandyQty * BRANDY_BOX_WEIGHT).toFixed(2));
  const parsedTotalWeight = Number(totalWeight || 0);
  const totalWasteNos = parsedTotalWeight > 0 ? Math.round(parsedTotalWeight / 0.42) : 0;

  // Amount Calculations (All based on Weight (kg) * Rate / kg)
  const beerTotalAmount = parsedBeerWeight * (Number(beerRateKg) || 0);
  const brandyTotalAmount = parsedBrandyWeight * (Number(brandyRateKg) || 0);
  const totalWasteTotalAmount = parsedTotalWeight * (Number(totalWasteRateKg) || 0);

  const itemsGross = items.reduce((s, it) => s + (Number(it.quantity || 0) * Number(it.rate || 0)), 0);
  const grossTaxable = itemsGross + beerTotalAmount + brandyTotalAmount + totalWasteTotalAmount;

  const cgp = settings?.cgst_percent || 2.5, sgp = settings?.sgst_percent || 2.5;
  const cgst = grossTaxable * cgp / 100, sgst = grossTaxable * sgp / 100;
  const total = Math.round(grossTaxable + cgst + sgst);

  const addItem = () => setItems((arr) => [...arr, { ...blankItem(), rate: "" }]);
  const removeItem = (i) => setItems((arr) => arr.length === 1 ? arr : arr.filter((_, idx) => idx !== i));

  const handleViewInvoice = async (inv) => {
    const targetId = inv.id || inv._id || inv.invoice_id;
    if (!targetId) {
      toast.error("Invalid invoice reference ID");
      return;
    }
    try {
      const res = await api.get(`/invoices/${targetId}`);
      setSelectedInvoice(res.data);
      setViewModal(true);
    } catch {
      setSelectedInvoice(inv);
      setViewModal(true);
    }
  };

  const handleDeleteInvoice = async (inv) => {
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
    setShopId("");
    setPartyName("");
    setLocation("");
    setSupervisor("");
    setContact("");
    setInvDate(new Date().toISOString().slice(0, 10));
    setTruckNo("");
    setTotalWeight("");
    setBeerRateKg("");
    setBrandyRateKg("");
    setTotalWasteRateKg("");
    setBeerQty(0);
    setBrandyQty(0);
    setItems([{ ...blankItem(), rate: "" }]);

    if (safeInvoices.length > 0) {
      let maxNum = 0;
      safeInvoices.forEach(inv => {
        const parts = (inv.invoice_no || "").split("-");
        const lastPart = parts[parts.length - 1];
        if (!isNaN(lastPart)) {
          const num = parseInt(lastPart, 10);
          if (num > maxNum) maxNum = num;
        }
      });
      setInvoiceNo(`AP-INV-${String(maxNum + 1).padStart(5, '0')}`);
    } else {
      setInvoiceNo("AP-INV-00001");
    }

    setModal(true);
  };

  const handleOpenEdit = (inv) => {
    const targetId = inv.id || inv._id;
    setEditId(targetId);
    setInvoiceNo(inv.invoice_no || "AP-INV-00001");
    setShopId(inv.shop_id || inv.shopId || "");
    setPartyName(inv.party_name || inv.customer_name || "");
    setLocation(inv.location || inv.address || "");
    setSupervisor(inv.supervisor || "");
    setContact(inv.contact || inv.mobile || "");
    setTruckNo(inv.truck_no || "");
    setTotalWeight(inv.total_weight || inv.waste_kg || "");

    if (inv.invoice_date) setInvDate(inv.invoice_date.slice(0, 10));

    if (inv.items && inv.items.length > 0) {
      setItems(inv.items.map(it => ({
        description: it.description || BOX_TYPES[0],
        unit: it.unit || "PCS",
        quantity: Math.round(Number(it.quantity || 1)),
        rate: it.rate || ""
      })));
    } else {
      setItems([{ ...blankItem(), rate: "" }]);
    }

    setModal(true);
  };

  const saveInvoice = async (e) => {
    e.preventDefault();
    if (!partyName) { toast.error("Enter Party / Company Name"); return; }

    const addedDescriptions = new Set();
    const clean = [];

    items.forEach((it) => {
      if (it.quantity !== "" && it.rate !== "") {
        if (!addedDescriptions.has(it.description)) {
          addedDescriptions.add(it.description);
          clean.push({
            description: it.description,
            quantity: Math.round(Number(it.quantity)),
            rate: Number(it.rate),
            amount: Number(it.quantity) * Number(it.rate)
          });
        }
      }
    });

    if (parsedBeerWeight > 0 && beerRateKg !== "") {
      const desc = `Beer Bottle Cotton Box (${beerQty} nos)`;
      if (!addedDescriptions.has(desc)) {
        addedDescriptions.add(desc);
        clean.push({
          description: desc,
          quantity: Number(beerQty),
          rate: Number(beerRateKg) || 0,
          amount: beerTotalAmount,
          unit: "PCS"
        });
      }
    }

    if (parsedBrandyWeight > 0 && brandyRateKg !== "") {
      const desc = `Brandy Bottle Cotton Box (${brandyQty} nos)`;
      if (!addedDescriptions.has(desc)) {
        addedDescriptions.add(desc);
        clean.push({
          description: desc,
          quantity: Number(brandyQty),
          rate: Number(brandyRateKg) || 0,
          amount: brandyTotalAmount,
          unit: "PCS"
        });
      }
    }

    if (parsedTotalWeight > 0 && totalWasteRateKg !== "") {
      const desc = `Total Weight Waste Generated (${totalWasteNos} nos)`;
      if (!addedDescriptions.has(desc)) {
        addedDescriptions.add(desc);
        clean.push({
          description: desc,
          quantity: Number(totalWasteNos),
          rate: Number(totalWasteRateKg) || 0,
          amount: totalWasteTotalAmount,
          unit: "PCS"
        });
      }
    }

    if (clean.length === 0) { toast.error("Add at least one line item with rate"); return; }

    setSaving(true);
    try {
      const payload = {
        invoice_no: invoiceNo || undefined,
        shop_id: shopId ? Number(shopId) : null,
        party_name: partyName,
        customer_name: partyName,
        location: location || null,
        supervisor: supervisor || null,
        contact: contact || null,
        invoice_date: new Date(invDate).toISOString(),
        invoice_type: "SALES",
        truck_no: truckNo,
        total_weight: parsedTotalWeight ? Number(parsedTotalWeight) : null,
        waste_kg: parsedTotalWeight ? Number(parsedTotalWeight) : null,
        items: clean,
        taxable_amount: grossTaxable,
        total_amount: total,
      };

      if (editId) {
        await api.put(`/invoices/${editId}`, payload);
        toast.success("Sale Invoice updated successfully");
      } else {
        await api.post("/invoices", payload);
        toast.success(`Sale Invoice created successfully`);
      }
      setModal(false);
      load();
    } catch (err) {
      toast.error(err?.response?.data?.detail?.[0]?.msg || (editId ? "Failed to update invoice" : "Failed to create invoice"));
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const SingleA4InvoiceBill = ({ copyTitle }) => {
    const rawItems = selectedInvoice?.items || [];
    const netTaxable = selectedInvoice?.taxable_amount ?? 0;
    const cgstVal = netTaxable * 0.025;
    const sgstVal = netTaxable * 0.025;
    const totalPayable = selectedInvoice?.total_amount ?? Math.round(netTaxable + cgstVal + sgstVal);

    return (
      <div className="relative border-2 border-slate-900 p-8 text-slate-900 bg-white shadow-md mx-auto w-full max-w-[210mm] min-h-[297mm] flex flex-col justify-between print-page-break print:shadow-none print:border-2 print:m-0">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-10 z-0 select-none">
          <img src="/logo4.png" alt="Auro Products Watermark" className="w-[450px] h-[450px] object-contain filter grayscale" />
        </div>

        <div className="relative z-10 flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b-2 border-slate-900 pb-4 mb-4">
              <div className="flex items-center gap-4">
                <img src="/logo4.png" alt="Auro Products Logo" className="w-16 h-16 rounded-full object-cover border-2 border-slate-900 shrink-0 bg-white" />
                <div>
                  <h1 className="text-3xl font-black tracking-wide text-slate-900 uppercase">AURO PRODUCTS</h1>
                  <p className="text-xs font-semibold text-slate-700">Industrial Area, Tamil Nadu</p>
                  <p className="text-xs font-mono text-slate-800"><span className="font-bold">GSTIN:</span> 33AAAAA0000A1Z5 | <span className="font-bold">State:</span> Tamil Nadu (33)</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-block px-3 py-1 bg-slate-100 border border-slate-900 text-slate-900 font-black text-xs uppercase tracking-wider">
                  TAX INVOICE ({copyTitle})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-2 border-slate-900 p-3 mb-4 text-xs bg-slate-50/50">
              <div className="space-y-1">
                <p><span className="font-bold">Invoice No:</span> <span className="font-mono font-bold text-slate-900">{selectedInvoice.invoice_no}</span></p>
                <p><span className="font-bold">Invoice Date:</span> {fmtDate(selectedInvoice.invoice_date)}</p>
                <p><span className="font-bold">Place of Supply:</span> Tamil Nadu (33)</p>
                <p><span className="font-bold">Total Weight:</span> <span className="font-semibold">{Number(selectedInvoice.waste_kg || selectedInvoice.total_weight || 0).toFixed(2)} kg</span></p>
              </div>
              <div className="space-y-1 border-l-2 pl-4 border-slate-300">
                <p className="font-bold text-slate-900 underline uppercase text-[11px]">Bill To (Party / Company):</p>
                <p className="font-bold text-sm text-slate-900">{selectedInvoice.party_name || selectedInvoice.customer_name}</p>
                <p><span className="font-bold">Address/Location:</span> {selectedInvoice.location || selectedInvoice.address || "—"}</p>
                <p><span className="font-bold">Contact:</span> {selectedInvoice.contact || selectedInvoice.mobile || "—"}</p>
                <p><span className="font-bold">Supervisor:</span> {selectedInvoice.supervisor || "—"}</p>
              </div>
            </div>

            <table className="w-full border-2 border-slate-900 text-xs border-collapse mb-4">
              <thead>
                <tr className="bg-slate-200 border-b-2 border-slate-900 font-bold text-slate-900">
                  <th className="border-r border-slate-900 p-2 text-center w-8">#</th>
                  <th className="border-r border-slate-900 p-2 text-left">Description of Goods</th>
                  <th className="border-r border-slate-900 p-2 text-center w-16">HSN</th>
                  <th className="border-r border-slate-900 p-2 text-center w-16">Qty</th>
                  <th className="border-r border-slate-900 p-2 text-center w-14">Unit</th>
                  <th className="border-r border-slate-900 p-2 text-right w-20">Rate</th>
                  <th className="p-2 text-right w-24">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 font-medium">
                {rawItems.map((r, idx) => (
                  <tr key={idx}>
                    <td className="border-r border-slate-900 p-2 text-center font-mono">{idx + 1}</td>
                    <td className="border-r border-slate-900 p-2 font-semibold text-slate-900">{r.description}</td>
                    <td className="border-r border-slate-900 p-2 text-center font-mono">4819</td>
                    <td className="border-r border-slate-900 p-2 text-center font-mono">{r.quantity}</td>
                    <td className="border-r border-slate-900 p-2 text-center uppercase">{r.unit || "PCS"}</td>
                    <td className="border-r border-slate-900 p-2 text-right font-mono">{Number(r.rate || 0).toFixed(2)}</td>
                    <td className="p-2 text-right font-mono font-bold">{Number(r.amount || 0).toFixed(2)}</td>
                  </tr>
                ))}
                
                <tr className="border-t border-slate-900 font-bold bg-slate-100">
                  <td colSpan={6} className="border-r border-slate-900 p-2 text-right">Net Taxable Value</td>
                  <td className="p-2 text-right font-mono">₹{netTaxable.toFixed(2)}</td>
                </tr>

                <tr>
                  <td colSpan={6} className="border-r border-slate-900 p-2 text-right font-medium text-slate-700">CGST @ 2.5%</td>
                  <td className="p-2 text-right font-mono text-slate-800">₹{cgstVal.toFixed(2)}</td>
                </tr>

                <tr>
                  <td colSpan={6} className="border-r border-slate-900 p-2 text-right font-medium text-slate-700">SGST @ 2.5%</td>
                  <td className="p-2 text-right font-mono text-slate-800">₹{sgstVal.toFixed(2)}</td>
                </tr>

                <tr className="border-t-2 border-slate-900 bg-slate-200 font-black text-sm">
                  <td colSpan={6} className="border-r border-slate-900 p-2.5 text-right uppercase tracking-wider">Total Amount Payable</td>
                  <td className="p-2.5 text-right font-mono text-slate-900">₹{totalPayable.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>

            <div className="border-2 border-slate-900 p-3 text-xs font-semibold bg-slate-50 mb-4">
              <span className="font-bold text-slate-900">Amount in Words: </span>
              <span className="italic text-slate-800">{numberToWords(totalPayable)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 border-2 border-slate-900 p-3 text-xs bg-white">
            <div className="space-y-1">
              <p className="font-bold text-slate-900 underline uppercase">Bank Account Details:</p>
              <p><span className="font-semibold">Bank Name:</span> State Bank of India</p>
              <p><span className="font-semibold">A/C No:</span> 38901234567</p>
              <p><span className="font-semibold">IFSC Code:</span> SBIN0001234</p>
            </div>
            <div className="flex flex-col justify-between text-right pl-4 border-l border-slate-300">
              <p className="font-bold text-slate-900 uppercase">For Auro Products</p>
              <p className="font-bold text-slate-800 pt-8">(Authorized Signatory)</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-3 sm:p-6">
      <PageHeader title="Sale Invoices" subtitle="Tamil Nadu Tax Sale Invoices · GST Sales Summary & Company Management" icon={Receipt}>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button onClick={() => exportToCsv("sale_invoices.csv", safeInvoices)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm hover:bg-white/10 transition">
            <Download className="h-4 w-4" /> Export
          </button>
          <button onClick={handleOpenCreate} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-3.5 py-2 text-xs sm:text-sm font-semibold text-slate-900 active:scale-95 transition">
            <Plus className="h-4 w-4" /> New Sale Invoice
          </button>
        </div>
      </PageHeader>
{/* SUMMARY CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border-emerald-500/25 shadow-sm">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
            <IndianRupee className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Sales</p>
            <p className="text-sm sm:text-base font-bold font-mono text-emerald-300 truncate">
              {inr(safeInvoices.reduce((a, c) => a + (Number(c.total_amount) || 0), 0))}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-amber-500/10 to-orange-500/5 border-amber-500/25 shadow-sm">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Paid</p>
            <p className="text-sm sm:text-base font-bold font-mono text-amber-300 truncate">
              {inr(safeInvoices.reduce((a, c) => a + (Number(c.amount_paid) || 0), 0))}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-red-500/10 to-rose-500/5 border-red-500/25 shadow-sm">
          <div className="p-2.5 rounded-xl bg-red-500/20 text-red-400 shrink-0">
            <Receipt className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Outstanding</p>
            <p className="text-sm sm:text-base font-bold font-mono text-red-300 truncate">
              {inr(safeInvoices.reduce((a, c) => a + ((Number(c.total_amount) || 0) - (Number(c.amount_paid) || 0)), 0))}
            </p>
          </div>
        </Card>

        <Card className="p-4 flex items-center gap-3 bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border-purple-500/25 shadow-sm">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 shrink-0">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] text-slate-400 uppercase font-mono truncate">Total Weight</p>
            <p className="text-sm sm:text-base font-bold font-mono text-purple-300 truncate">
              {safeInvoices.reduce((acc, i) => acc + (Number(i.waste_kg || i.total_weight) || 0), 0).toFixed(2)} kg
            </p>
          </div>
        </Card>
      </div>

      {/* VIEW TABS */}
      <div className="flex items-center gap-3 mb-4 overflow-x-auto whitespace-nowrap pb-1">
        <button onClick={() => setActiveTab("invoices")} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition shrink-0 ${activeTab === "invoices" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
          All Sale Invoices ({safeInvoices.length})
        </button>
        {/* <button onClick={() => setActiveTab("companies")} className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium transition shrink-0 ${activeTab === "companies" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" : "bg-white/5 text-slate-400 hover:bg-white/10"}`}>
          Company Directory ({companyList.length})
        </button> */}
      </div>

      {activeTab === "invoices" ? (
        <>
          <Card className="p-3 sm:p-4 mb-4 flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search invoice no / party name / wine shop / truck…"
                className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">From:</span>
              <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
              <span className="text-xs text-slate-400 font-mono whitespace-nowrap">To:</span>
              <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1000px]">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                    <th className="p-4">Invoice</th>
                    <th className="p-4">Date</th>
                    <th className="p-4">Party / Company Name</th>
                    <th className="p-4">Mobile & Address</th>
                    <th className="p-4 text-center">Total Weight</th>
                    <th className="p-4 text-right">Taxable Amount</th>
                    <th className="p-4 text-right">Total Amount</th>
                    <th className="p-4 text-center">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {rows.map((i) => {
                    const totalWaste = Number(i.waste_kg || i.total_weight || 0);

                    return (
                      <tr key={i.id || i._id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 font-mono text-cyan-300 cursor-pointer underline whitespace-nowrap" onClick={() => handleViewInvoice(i)}>{i.invoice_no}</td>
                        <td className="p-4 text-slate-400 font-mono whitespace-nowrap">{fmtDate(i.invoice_date)}</td>
                        <td className="p-4 font-semibold text-black-200">
                          {i.party_name || i.customer_name || i.shop_name}
                          {i.supervisor && <span className="block text-xs font-normal text-slate-400">Supervisor: {i.supervisor}</span>}
                        </td>
                        <td className="p-4 text-xs text-slate-300">
                          {i.contact && <div className="flex items-center gap-1 whitespace-nowrap"><Phone className="h-3 w-3 text-cyan-400" />{i.contact}</div>}
                          {i.location && <div className="flex items-center gap-1 text-slate-400"><MapPin className="h-3 w-3 text-emerald-400" />{i.location}</div>}
                          {!i.contact && !i.location && <span className="text-slate-500">-</span>}
                        </td>
                        <td className="p-4 text-center font-mono text-amber-400 font-semibold whitespace-nowrap">
                          {totalWaste > 0 ? `${totalWaste.toFixed(2)} kg` : "-"}
                        </td>
                        <td className="p-4 text-right font-mono whitespace-nowrap">{inr(i.taxable_amount)}</td>
                        <td className="p-4 text-right font-mono whitespace-nowrap">{inr(i.total_amount ?? i.grand_total)}</td>
                        <td className="p-4 text-center whitespace-nowrap"><span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS[i.status] || STATUS.unpaid}`}>{(i.status || "unpaid").toUpperCase()}</span></td>
                        <td className="p-4 whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button onClick={() => handleViewInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition" title="View Invoice"><Eye className="h-4 w-4" /></button>
                            <button onClick={() => handleOpenEdit(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-amber-300 transition" title="Edit Invoice"><Edit className="h-4 w-4" /></button>
                            <button onClick={() => handleDeleteInvoice(i)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400 transition" title="Delete Invoice"><Trash2 className="h-4 w-4" /></button>
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
            <table className="w-full text-sm min-w-[700px]">
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

      {/* PRINT PREVIEW MODAL */}
      {viewModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-slate-100 text-slate-900 rounded-2xl shadow-2xl my-6 font-sans border border-slate-300 overflow-hidden flex flex-col max-h-[92vh] print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-white print:m-0 print:max-w-none">
            <div className="sticky top-0 z-30 flex justify-between items-center border-b border-slate-300 bg-white px-6 py-4 shadow-sm print:hidden">
              <button onClick={() => setViewModal(false)} className="flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl hover:bg-slate-300 transition">
                <ArrowLeft className="h-4 w-4" /> Back to Invoices
              </button>
              <div className="flex items-center gap-3">
                <button onClick={handlePrint} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-emerald-600 text-white text-xs font-bold rounded-xl shadow-md hover:from-cyan-500 hover:to-emerald-500 transition">
                  <Printer className="h-4 w-4" /> Print A4 Copies
                </button>
                <button onClick={() => setViewModal(false)} className="p-2 text-slate-400 hover:text-slate-800"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="overflow-y-auto p-4 sm:p-6 space-y-8 flex-1 print:p-0 print:overflow-visible print:space-y-0">
              <div className="print-single-page space-y-8 print:space-y-0">
                <SingleA4InvoiceBill copyTitle="ORIGINAL FOR RECIPIENT" />
                <SingleA4InvoiceBill copyTitle="DUPLICATE FOR TRANSPORTER" />
                <SingleA4InvoiceBill copyTitle="TRIPLICATE FOR SUPPLIER" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setModal(false)} />
          <form onSubmit={saveInvoice} className="glass relative z-10 w-full max-w-3xl rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto text-slate-800 bg-white shadow-xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-slate-900">{editId ? "Edit Sale Invoice" : "New Sale Invoice"}</h3>
              <button type="button" onClick={() => setModal(false)}><X className="h-5 w-5 text-slate-500 hover:text-slate-700" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-slate-600 font-medium">Invoice No.</label>
                <input type="text" required placeholder="AP-INV-00001" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)}
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
                <label className="text-xs text-cyan-700 font-bold">Select Date (Auto Load Entries)</label>
                <input type="date" value={invDate} onChange={(e) => setInvDate(e.target.value)} className="mt-1 w-full rounded-lg bg-cyan-50 border border-cyan-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-semibold" />
              </div>
              <div>
                <label className="text-xs text-slate-600 font-medium">Truck No.</label>
                <input type="text" placeholder="TN 01 AB 1234" value={truckNo} onChange={(e) => setTruckNo(e.target.value)} className="mt-1 w-full rounded-lg bg-white border border-slate-300 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 placeholder:text-slate-400" />
              </div>
              <div>
                <label className="text-xs text-purple-700 font-bold">Total waste Weight of the Day (kg)</label>
                <input type="number" step="0.01" min="0" placeholder="Auto Loaded" value={totalWeight} onChange={(e) => setTotalWeight(e.target.value)} className="mt-1 w-full rounded-lg bg-purple-50 border border-purple-300 py-2.5 px-3 text-sm text-purple-900 font-bold outline-none font-mono" />
              </div>
            </div>

            {/* DAILY BOTTLE BOX ENTRIES TABLE WITH RATE PER KG */}
            <div className="mb-4 border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <div className="bg-slate-100 px-3 py-2 border-b border-slate-200 font-semibold text-xs text-slate-700 flex justify-between items-center">
                <span>Daily Box Entries Summary ({invDate})</span>
                <span className="text-[11px] font-mono text-cyan-700 font-bold">Calculations: Weight (kg) × Rate / kg</span>
              </div>
              
              <div className="p-3 space-y-3">
                {/* 1st Row: Beer Box */}
                <div className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                  <div className="col-span-12 sm:col-span-3 text-xs font-bold text-slate-800">
                    Beer Box
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Weight (0.220 x nos)</label>
                    <div className="font-mono text-xs font-semibold text-cyan-700">{parsedBeerWeight.toFixed(2)} kg</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Nos (Qty)</label>
                    <div className="font-mono text-xs font-semibold text-slate-800">{beerQty} nos</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block font-medium">Rate / kg (₹)</label>
                    <input type="number" step="0.01" placeholder="Enter Rate / kg" value={beerRateKg} onChange={(e) => setBeerRateKg(e.target.value)} className="w-full rounded-md border border-slate-300 py-1 px-2 text-xs text-slate-800 outline-none focus:border-cyan-500 font-mono" />
                  </div>
                </div>

                {/* 2nd Row: Brandy Box */}
                <div className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                  <div className="col-span-12 sm:col-span-3 text-xs font-bold text-slate-800">
                    Brandy Box
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Weight (0.420 x nos)</label>
                    <div className="font-mono text-xs font-semibold text-cyan-700">{parsedBrandyWeight.toFixed(2)} kg</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Nos (Qty)</label>
                    <div className="font-mono text-xs font-semibold text-slate-800">{brandyQty} nos</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block font-medium">Rate / kg (₹)</label>
                    <input type="number" step="0.01" placeholder="Enter Rate / kg" value={brandyRateKg} onChange={(e) => setBrandyRateKg(e.target.value)} className="w-full rounded-md border border-slate-300 py-1 px-2 text-xs text-slate-800 outline-none focus:border-cyan-500 font-mono" />
                  </div>
                </div>

                {/* 3rd Row: Total Weight Waste Generated */}
                <div className="grid grid-cols-12 gap-3 items-center bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs">
                  <div className="col-span-12 sm:col-span-3 text-xs font-bold text-slate-800">
                    Total Weight Waste
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Total Weight</label>
                    <div className="font-mono text-xs font-semibold text-purple-700">{parsedTotalWeight.toFixed(2)} kg</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block">Nos (Weight ÷ 0.42)</label>
                    <div className="font-mono text-xs font-semibold text-slate-800">{totalWasteNos} nos</div>
                  </div>
                  <div className="col-span-4 sm:col-span-3">
                    <label className="text-[10px] text-slate-500 block font-medium">Rate / kg (₹)</label>
                    <input type="number" step="0.01" placeholder="Enter Rate / kg" value={totalWasteRateKg} onChange={(e) => setTotalWasteRateKg(e.target.value)} className="w-full rounded-md border border-slate-300 py-1 px-2 text-xs text-slate-800 outline-none focus:border-cyan-500 font-mono" />
                  </div>
                </div>
              </div>
            </div>

            {/* BILLING BREAKDOWN */}
            <div className="mt-4 pt-3 border-t border-slate-200 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-800 border-b pb-1"><span>Net Taxable Amount</span><span>₹{grossTaxable.toFixed(2)}</span></div>
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

      {/* PRINT CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-single-page, .print-single-page * {
            visibility: visible;
          }
          .print-single-page {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-page-break {
            page-break-after: always;
            break-after: page;
          }
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}