import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { fmtDate } from "@/lib/helpers";
import { toast } from "sonner";
import {
  PackagePlus,
  Scale,
  Package,
  Trash2,
  Pencil,
  X,
  Eye,
  Printer,
  Download,
  ArrowLeft,
  Search,
  RefreshCw,
} from "lucide-react";

const PAGE_SIZE = 5;

export default function BoxEntry() {
  const [params] = useSearchParams();
  const [shops, setShops] = useState([]);
  const [entries, setEntries] = useState([]);
  const [canManage] = useState(localStorage.getItem("auro_can_edit") === "true");

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Form state
  const [shopId, setShopId] = useState(params.get("shop") || "");
  const [brandyQty, setBrandyQty] = useState("");
  const [brandyRate, setBrandyRate] = useState("16.00");
  const [beerQty, setBeerQty] = useState("");
  const [beerRate, setBeerRate] = useState("16.00");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [divisor, setDivisor] = useState(12);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [previewEntry, setPreviewEntry] = useState(null);

  const safeExtractArray = (res) => {
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.rows)) return res.data.rows;
    if (Array.isArray(res)) return res;
    return [];
  };

  const loadEntries = () => api.get("/entries").then((r) => setEntries(safeExtractArray(r))).catch(() => setEntries([]));
  const loadShops = () => api.get("/shops").then((r) => setShops(safeExtractArray(r))).catch(() => setShops([]));

  useEffect(() => {
    loadShops();
    api.get("/settings").then((r) => setDivisor(Number(r.data?.waste_divisor) || 12)).catch(() => {});
    loadEntries();
  }, []);

  // Sync route params when updated
  useEffect(() => {
    const sParam = params.get("shop");
    if (sParam) {
      setShopId(sParam);
    }
  }, [params]);

  const shopMap = useMemo(() => {
    const map = {};
    const safeShops = Array.isArray(shops) ? shops : [];
    safeShops.forEach((s) => {
      if (s && (s.id || s._id)) map[s.id || s._id] = s;
    });
    return map;
  }, [shops]);

  const bQtyNum = parseInt(brandyQty || "0", 10);
  const bRateNum = parseFloat(brandyRate || "0");
  const brandyAmount = bQtyNum * bRateNum;

  const beerQtyNum = parseInt(beerQty || "0", 10);
  const beerRateNum = parseFloat(beerRate || "0");
  const beerAmount = beerQtyNum * beerRateNum;

  const cottonBoxAmount = brandyAmount + beerAmount;
  const cgstAmount = cottonBoxAmount * 0.025;
  const sgstAmount = cottonBoxAmount * 0.025;
  const totalGstAmount = cgstAmount + sgstAmount;
  const grandTotal = Math.round(cottonBoxAmount + totalGstAmount);

  const totalBoxes = bQtyNum + beerQtyNum;
  const waste = totalBoxes > 0 ? totalBoxes / divisor : 0;

  const filteredEntries = useMemo(() => {
    const safeEntries = Array.isArray(entries) ? entries : [];
    return safeEntries
      .filter((item) => {
        if (!item) return false;
        const shop = shopMap[item.shop_id];
        const shopNo = (shop?.shop_no || item.shop_no || "").toString().toLowerCase();
        const shopName = (shop?.name || item.shop_name || "").toString().toLowerCase();
        const query = searchTerm.toLowerCase().trim();

        const matchesSearch = !query || shopNo.includes(query) || shopName.includes(query);

        const itemDate = item.entry_date ? new Date(item.entry_date.slice(0, 10)) : null;
        const start = fromDate ? new Date(fromDate) : null;
        const end = toDate ? new Date(toDate) : null;

        let matchesDate = true;
        if (itemDate) {
          if (start && itemDate < start) matchesDate = false;
          if (end && itemDate > end) matchesDate = false;
        }

        return matchesSearch && matchesDate;
      })
      .sort((a, b) => new Date(b.entry_date || 0) - new Date(a.entry_date || 0) || (b.id || 0) - (a.id || 0));
  }, [entries, shopMap, searchTerm, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const rows = useMemo(
    () => filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredEntries, page]
  );

  const submit = async (e) => {
    e.preventDefault();
    if (!canManage && editingId) {
      toast.error("Unauthorized: Only admins can edit entries");
      return;
    }
    if (!shopId) {
      toast.error("Select a shop");
      return;
    }
    if (bQtyNum <= 0 && beerQtyNum <= 0) {
      toast.error("Enter quantity for Brandy or Beer boxes");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        shop_id: Number(shopId),
        brandy_qty: bQtyNum,
        brandy_rate: bRateNum,
        beer_qty: beerQtyNum,
        beer_rate: beerRateNum,
        cotton_box_amount: cottonBoxAmount,
        cgst_amount: cgstAmount,
        sgst_amount: sgstAmount,
        gst_amount: totalGstAmount,
        total_amount: grandTotal,
        quantity: totalBoxes,
        waste_kg: parseFloat(waste.toFixed(2)),
        entry_date: new Date(entryDate).toISOString(),
        notes,
      };

      if (editingId) {
        await api.put(`/entries/${editingId}`, payload);
        toast.success("Entry updated successfully");
      } else {
        await api.post("/entries", payload);
        toast.success("Entry saved successfully");
        setPage(1);
      }

      resetForm();
      await loadEntries();
    } catch (err) {
      toast.error("Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entryItem) => {
    if (!canManage) {
      toast.error("Unauthorized: Only admins can edit entries");
      return;
    }
    setEditingId(entryItem.id);
    setShopId(entryItem.shop_id ? entryItem.shop_id.toString() : "");
    setBrandyQty(entryItem.brandy_qty !== undefined ? entryItem.brandy_qty.toString() : "0");
    setBrandyRate(entryItem.brandy_rate !== undefined ? entryItem.brandy_rate.toString() : "16.00");
    setBeerQty(entryItem.beer_qty !== undefined ? entryItem.beer_qty.toString() : "0");
    setBeerRate(entryItem.beer_rate !== undefined ? entryItem.beer_rate.toString() : "16.00");
    setEntryDate(
      entryItem.entry_date
        ? entryItem.entry_date.slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setNotes(entryItem.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const resetForm = () => {
    setEditingId(null);
    setShopId(params.get("shop") || "");
    setBrandyQty("");
    setBrandyRate("16.00");
    setBeerQty("");
    setBeerRate("16.00");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  };

  const del = async (entryItem) => {
    const id = typeof entryItem === "object" ? entryItem.id : entryItem;
    if (!canManage) {
      toast.error("Unauthorized: Only admins can delete entries");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await api.delete(`/entries/${id}`);
      toast.success("Entry deleted");
      if (editingId === id) resetForm();
      loadEntries();
    } catch (err) {
      toast.error("Failed to delete entry");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const currentShop = useMemo(() => {
    if (!previewEntry) return null;
    const safeShops = Array.isArray(shops) ? shops : [];
    return safeShops.find((s) => s.id === previewEntry.shop_id || s._id === previewEntry.shop_id) || {
      shop_no: previewEntry.shop_no,
      name: previewEntry.shop_name,
      location: previewEntry.location || "kovur",
    };
  }, [previewEntry, shops]);

  const renderInvoiceCopy = (copyTitle) => {
    if (!previewEntry) return null;

    const bQty = previewEntry.brandy_qty ?? 0;
    const bRate = previewEntry.brandy_rate ?? 16.0;
    const bAmt = bQty * bRate;

    const beerQty = previewEntry.beer_qty ?? 0;
    const beerRate = previewEntry.beer_rate ?? 16.0;
    const beerAmt = beerQty * beerRate;

    const boxAmount = bQty > 0 || beerQty > 0 ? (bAmt + beerAmt) : (previewEntry.cotton_box_amount ?? 0);
    const cgstVal = boxAmount * 0.025;
    const sgstVal = boxAmount * 0.025;
    const totVal = boxAmount + cgstVal + sgstVal;

    let lineNo = 1;

    return (
      <div
        key={copyTitle}
        className="invoice-page bg-white flex flex-col justify-between font-sans box-border text-black p-4"
      >
        <div className="border-2 border-black flex-1 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center border-b-2 border-black p-1.5 font-bold text-xs uppercase bg-slate-50">
              <span>TAX INVOICE</span>
              <span className="text-black font-extrabold">{copyTitle}</span>
            </div>

            <div className="flex items-center gap-4 border-b-2 border-black p-3">
              <div className="h-24 w-24 rounded-full bg-slate-900 text-white font-extrabold text-lg flex items-center justify-center border border-white shrink-0 overflow-hidden">
                <img src="/logo4.png" alt="Logo" className="h-full w-full object-cover" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight uppercase">
                  Auro Products Billing Suite
                </h1>
                <p className="text-[11px] text-slate-800">
                  2 B 52c Viswas Nagar 2nd Main road Tiruchirappall, Trichy , Tamil Nadu, 625007
                </p>
                <p className="text-[11px] text-slate-800">
                  <span className="font-bold">GSTIN:</span> 33AITPM1982E1Z1 | <span className="font-bold">State:</span> Tamil Nadu (33)
                </p>
              </div>
            </div>

            <table className="w-full text-xs text-left border-collapse table-fixed">
              <colgroup>
                <col className="w-[8%]" />
                <col className="w-[42%]" />
                <col className="w-[10%]" />
                <col className="w-[8%]" />
                <col className="w-[8%]" />
                <col className="w-[12%]" />
                <col className="w-[12%]" />
              </colgroup>

              <tbody>
                <tr className="border-b-2 border-black">
                  <td colSpan={2} className="p-2.5 border-r-2 border-black align-top space-y-1">
                    <p><span className="font-bold">Invoice No:</span> INV-{new Date(previewEntry.entry_date).getFullYear()}{String(previewEntry.id).padStart(6, "0")}</p>
                    <p><span className="font-bold">Invoice Date:</span> {fmtDate(previewEntry.entry_date)}</p>
                  </td>
                  <td colSpan={5} className="p-2.5 align-top space-y-1">
                    <p className="font-bold">Bill To:</p>
                    <p className="font-semibold">{currentShop?.shop_no} · {currentShop?.name}</p>
                    <p className="text-slate-800 text-[11px]">{currentShop?.location || ""}</p>
                  </td>
                </tr>

                <tr className="border-b-2 border-black bg-slate-100 font-bold">
                  <th className="p-2 border-r-2 border-black text-center">#</th>
                  <th className="p-2 border-r-2 border-black">Description of Goods</th>
                  <th className="p-2 border-r-2 border-black text-center">HSN</th>
                  <th className="p-2 border-r-2 border-black text-center">Qty</th>
                  <th className="p-2 border-r-2 border-black text-center">Unit</th>
                  <th className="p-2 border-r-2 border-black text-right">Rate</th>
                  <th className="p-2 text-right">Amount (₹)</th>
                </tr>

                {bQty > 0 && (
                  <tr className="border-b border-black">
                    <td className="p-2 border-r-2 border-black text-center">{lineNo++}</td>
                    <td className="p-2 border-r-2 border-black font-semibold">Brandy Bottle Cotton Box</td>
                    <td className="p-2 border-r-2 border-black text-center">4819</td>
                    <td className="p-2 border-r-2 border-black text-center">{bQty}</td>
                    <td className="p-2 border-r-2 border-black text-center">PCS</td>
                    <td className="p-2 border-r-2 border-black text-right">{bRate.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">{bAmt.toFixed(2)}</td>
                  </tr>
                )}
                {beerQty > 0 && (
                  <tr className="border-b border-black">
                    <td className="p-2 border-r-2 border-black text-center">{lineNo++}</td>
                    <td className="p-2 border-r-2 border-black font-semibold">Beer Bottle Cotton Box</td>
                    <td className="p-2 border-r-2 border-black text-center">4819</td>
                    <td className="p-2 border-r-2 border-black text-center">{beerQty}</td>
                    <td className="p-2 border-r-2 border-black text-center">PCS</td>
                    <td className="p-2 border-r-2 border-black text-right">{beerRate.toFixed(2)}</td>
                    <td className="p-2 text-right font-semibold">{beerAmt.toFixed(2)}</td>
                  </tr>
                )}

                <tr className="h-36 border-b-2 border-black">
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  <td className="border-r-2 border-black"></td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <table className="w-full text-xs text-left border-collapse table-fixed border-b-2 border-black">
              <colgroup>
                <col className="w-[50%]" />
                <col className="w-[50%]" />
              </colgroup>
              <tbody>
                <tr>
                  <td className="p-2.5 border-r-2 border-black align-bottom">
                    <p className="font-bold">Terms & Conditions:</p>
                    <p className="text-[10px] text-slate-800 mt-0.5">
                      1. Goods once sold will not be taken back.<br />
                      2. Subject to local jurisdiction.
                    </p>
                  </td>
                  <td className="p-0 align-top">
                    <div className="divide-y-2 divide-black">
                      <div className="flex justify-between p-1.5 font-bold bg-slate-50">
                        <span>Cotton Box Amount</span>
                        <span>₹{boxAmount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-1.5">
                        <span>CGST @ 2.5%</span>
                        <span>₹{cgstVal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-1.5">
                        <span>SGST @ 2.5%</span>
                        <span>₹{sgstVal.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between p-2 font-black text-sm bg-slate-100">
                        <span>Grand Total Payable</span>
                        <span>₹{totVal.toFixed(2)}</span>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="p-4 text-xs flex justify-between items-end">
              <div></div>
              <div className="text-center">
                <p className="font-bold mb-8">For Auro Products Billing Suite</p>
                <p className="border-t-2 border-black pt-1 w-48 font-semibold">Authorized Signatory</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const safeShops = Array.isArray(shops) ? shops : [];

  return (
    <div>
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 0 !important;
          }

          body * {
            visibility: hidden !important;
          }

          #print-area, #print-area * {
            visibility: visible !important;
          }

          #print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          .invoice-page {
            width: 100% !important;
            min-height: 285mm !important;
            padding: 10mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .invoice-page:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }
        }
      `}</style>

      <PageHeader
        title="Cotton Box Entry & Invoicing"
        subtitle="Manage Brandy and Beer boxes, 5% GST calculations, and print Tax Invoices."
        icon={PackagePlus}
      />

      {/* Hidden Print Area */}
      {previewEntry && (
        <div id="print-area" className="hidden print:block">
          {renderInvoiceCopy("ORIGINAL FOR RECIPIENT")}
          {renderInvoiceCopy("DUPLICATE FOR TRANSPORTER")}
          {renderInvoiceCopy("TRIPLICATE FOR SUPPLIER")}
        </div>
      )}

      {/* Invoice Preview Modal */}
      {previewEntry && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 md:p-6 overflow-hidden print:hidden">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh] relative">
            <div className="modal-header flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 rounded-t-2xl">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPreviewEntry(null)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-emerald-600" /> Tax Invoice Preview
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg font-semibold hover:bg-emerald-700 transition text-xs"
                >
                  <Printer className="h-4 w-4" /> Print 3 Copies
                </button>
                <button
                  onClick={() => setPreviewEntry(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg transition ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto flex-1 bg-slate-100 space-y-8">
              {renderInvoiceCopy("ORIGINAL FOR RECIPIENT")}
              {renderInvoiceCopy("DUPLICATE FOR TRANSPORTER")}
              {renderInvoiceCopy("TRIPLICATE FOR SUPPLIER")}
            </div>
          </div>
        </div>
      )}

      {/* Main Entry Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-6 bg-white border border-slate-200 text-slate-900 shadow-sm">
          <h2 className="font-display text-base font-semibold text-slate-900 mb-4">
            {editingId ? "Edit Cotton Box Entry" : "New Cotton Box Entry & Invoice"}
          </h2>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Wine Shop</label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 transition font-medium"
              >
                <option value="">Select shop…</option>
                {safeShops.map((s) => (
                  <option key={s.id || s._id} value={s.id || s._id}>
                    {s.shop_no} · {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Line Items & Rates</p>

              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-xs font-semibold text-slate-800">Brandy Bottle Cotton Box</div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty (pcs)"
                    value={brandyQty}
                    onChange={(e) => setBrandyQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="col-span-4">
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
                    <span className="text-xs font-bold text-slate-500 mr-1">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Rate"
                      value={brandyRate}
                      onChange={(e) => setBrandyRate(e.target.value)}
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-xs font-semibold text-slate-800">Beer Bottle Cotton Box</div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty (pcs)"
                    value={beerQty}
                    onChange={(e) => setBeerQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500"
                  />
                </div>
                <div className="col-span-4">
                  <div className="flex items-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5">
                    <span className="text-xs font-bold text-slate-500 mr-1">₹</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Rate"
                      value={beerRate}
                      onChange={(e) => setBeerRate(e.target.value)}
                      className="w-full bg-transparent text-xs font-semibold text-slate-900 outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 transition"
            >
              {saving ? "Saving..." : editingId ? "Update Entry" : "Save Entry"}
            </button>
          </form>
        </Card>

        {/* Calculation Summary Box */}
        <Card className="p-6 bg-white text-black flex flex-col justify-between rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider mb-4">
              <Scale className="h-4 w-4 text-emerald-600" /> Summary
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Brandy Amount ({bQtyNum} pcs)</span>
                <span className="font-semibold text-black">₹{brandyAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Beer Amount ({beerQtyNum} pcs)</span>
                <span className="font-semibold text-black">₹{beerAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-black pt-2 border-t border-slate-200">
                <span>Cotton Box Amount</span>
                <span>₹{cottonBoxAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-amber-600 text-xs font-medium">
                <span>CGST (2.5%)</span>
                <span>₹{cgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-amber-600 text-xs font-medium">
                <span>SGST (2.5%)</span>
                <span>₹{sgstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold text-emerald-600 text-xs">
                <span>Total GST (5%)</span>
                <span>₹{totalGstAmount.toFixed(2)}</span>
              </div>

              <div className="flex justify-between text-slate-700 font-medium pt-2 border-t border-slate-200">
                <span>Waste Boxes ({totalBoxes} / {divisor || 12})</span>
                <span className="font-semibold">{waste.toFixed(2)} Boxes</span>
              </div>

              <div className="flex justify-between text-emerald-700 font-bold text-lg pt-2 border-t border-slate-200">
                <span>Grand Total Payable</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Table Records Card */}
      <Card className="p-6 bg-white border border-slate-200 text-slate-900 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <h2 className="font-display text-base font-semibold text-slate-900 flex items-center gap-2">
            <Package className="h-4 w-4 text-emerald-600" /> Cotton Box Entry Records
          </h2>

          <button
            onClick={() => {
              const headers = ["Date", "Shop No", "Shop Name", "Brandy Boxes", "Beer Boxes", "Cotton Box Amount", "GST Amount (5%)", "Total Amount (INR)", "Waste (kg)"];
              const csvRows = [
                headers.join(","),
                ...filteredEntries.map((row) => {
                  const shop = shopMap[row.shop_id];
                  const shopNo = `"${shop?.shop_no || row.shop_no || ""}"`;
                  const shopName = `"${shop?.name || row.shop_name || ""}"`;
                  const date = fmtDate(row.entry_date);
                  const bQty = row.brandy_qty ?? 0;
                  const beerQty = row.beer_qty ?? 0;
                  const boxAmt = Number(row.cotton_box_amount ?? 0).toFixed(2);
                  const gstAmt = Number(row.gst_amount ?? 0).toFixed(2);
                  const totalAmt = Number(row.total_amount ?? 0).toFixed(2);
                  const wasteKg = Number(row.waste_kg ?? 0).toFixed(2);

                  return [date, shopNo, shopName, bQty, beerQty, boxAmt, gstAmt, totalAmt, wasteKg].join(",");
                }),
              ];

              const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `Cotton_Box_Records_${new Date().toISOString().slice(0, 10)}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 hover:bg-slate-200 rounded-xl transition"
          >
            <Download className="h-4 w-4 text-slate-600" /> Export CSV
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 mb-6 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
          <div className="lg:col-span-5 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Shop No or Shop Name..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="lg:col-span-3 relative">
            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 mr-2 uppercase">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs font-medium text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-3 relative">
            <div className="flex items-center bg-white border border-slate-300 rounded-lg px-2.5 py-1.5">
              <span className="text-[10px] font-bold text-slate-500 mr-2 uppercase">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="w-full bg-transparent text-xs font-medium text-slate-900 outline-none"
              />
            </div>
          </div>

          <div className="lg:col-span-1 flex items-center justify-end">
            <button
              onClick={() => {
                setSearchTerm("");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              title="Reset Filters"
              className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Shop No</th>
                <th className="py-3 px-4">Shop Name</th>
                <th className="py-3 px-4 text-center">Brandy Boxes</th>
                <th className="py-3 px-4 text-center">Beer Boxes</th>
                <th className="py-3 px-4 text-right">Cotton Box Amt</th>
                <th className="py-3 px-4 text-right">GST Amt (5%)</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Waste (kg)</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-400">
                    No matching box entries found.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const shop = shopMap[row.shop_id];
                  const shopNo = shop?.shop_no || row.shop_no || "—";
                  const shopName = shop?.name || row.shop_name || "—";
                  const bQty = row.brandy_qty ?? 0;
                  const beerQty = row.beer_qty ?? 0;
                  const boxAmt = bQty > 0 || beerQty > 0 ? ((bQty * (row.brandy_rate ?? 16)) + (beerQty * (row.beer_rate ?? 16))) : (row.cotton_box_amount ?? 0);
                  const gstAmt = boxAmt * 0.05;
                  const totalAmt = boxAmt + gstAmt;
                  const wasteKg = row.waste_kg ?? 0;

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-4 font-medium text-slate-900">{fmtDate(row.entry_date)}</td>
                      <td className="py-3 px-4 font-semibold text-slate-700">{shopNo}</td>
                      <td className="py-3 px-4 text-slate-800">{shopName}</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">{bQty} pcs</td>
                      <td className="py-3 px-4 text-center font-semibold text-slate-800">{beerQty} pcs</td>
                      <td className="py-3 px-4 text-right font-semibold text-slate-800">₹{Number(boxAmt).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-amber-700">₹{Number(gstAmt).toFixed(2)}</td>
                      <td className="py-3 px-4 text-right font-bold text-emerald-700">₹{Number(totalAmt).toFixed(2)}</td>
                      <td className="py-3 px-4 text-center font-medium text-slate-700">{Number(wasteKg).toFixed(2)} kg</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPreviewEntry(row)}
                            title="Preview Invoice"
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canManage && (
                            <>
                              <button
                                onClick={() => startEdit(row)}
                                title="Edit Entry"
                                className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => del(row)}
                                title="Delete Entry"
                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-between items-center border-t border-slate-100 pt-4">
          <Pager page={page} pageCount={pageCount} onPage={setPage} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
}