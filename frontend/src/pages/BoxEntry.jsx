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
  Calendar,
  AlertCircle,
} from "lucide-react";

const PAGE_SIZE = 5;

export default function BoxEntry() {
  const [params] = useSearchParams();
  const [shops, setShops] = useState([]);
  const [entries, setEntries] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [canManage] = useState(localStorage.getItem("auro_can_edit") === "true");

  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [shopSearchInput, setShopSearchInput] = useState("");
  const [showShopDropdown, setShowShopDropdown] = useState(false);

  const [shopId, setShopId] = useState(params.get("shop") || "");
  const [brandyQty, setBrandyQty] = useState("");
  const [brandyRate, setBrandyRate] = useState("4.31");
  const [beerQty, setBeerQty] = useState("");
  const [beerRate, setBeerRate] = useState("4.31");
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
  const loadInvoices = () => api.get("/invoices").then((r) => setInvoices(safeExtractArray(r))).catch(() => setInvoices([]));

  useEffect(() => {
    loadShops();
    api.get("/settings").then((r) => setDivisor(Number(r.data?.waste_divisor) || 12)).catch(() => {});
    loadEntries();
    loadInvoices();
  }, []);

  useEffect(() => {
    const sParam = params.get("shop");
    if (sParam) {
      setShopId(sParam);
    }
  }, [params]);

  const safeShops = useMemo(() => (Array.isArray(shops) ? shops : []), [shops]);

  const shopMap = useMemo(() => {
    const map = {};
    safeShops.forEach((s) => {
      if (s && (s.id || s._id)) map[s.id || s._id] = s;
    });
    return map;
  }, [safeShops]);

  useEffect(() => {
    if (shopId && shopMap[shopId]) {
      const selected = shopMap[shopId];
      setShopSearchInput(`${selected.shop_no} · ${selected.name}`);
    }
  }, [shopId, shopMap]);

  const filteredShopsForSelect = useMemo(() => {
    if (!shopSearchInput.trim()) return safeShops;
    const query = shopSearchInput.toLowerCase().trim();
    return safeShops.filter(
      (s) =>
        (s.shop_no || "").toString().toLowerCase().includes(query) ||
        (s.name || "").toString().toLowerCase().includes(query)
    );
  }, [safeShops, shopSearchInput]);

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
  const waste = bQtyNum > 0 ? bQtyNum / divisor : 0;

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

  const submit = async (e) => {
    e.preventDefault();
    if (!shopId) {
      toast.error("Select a valid shop");
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
      await loadInvoices();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Failed to save entry");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setShopId(params.get("shop") || "");
    setShopSearchInput("");
    setShowShopDropdown(false);
    setBrandyQty("");
    setBrandyRate("4.31");
    setBeerQty("");
    setBeerRate("4.31");
    setEntryDate(new Date().toISOString().slice(0, 10));
    setNotes("");
  };

  // Populate form with row details for editing
  const populateEdit = (row) => {
    setEditingId(row.id);
    setShopId(row.shop_id || "");
    setBrandyQty(row.brandy_qty || "");
    setBrandyRate(row.brandy_rate ? row.brandy_rate.toString() : "4.31");
    setBeerQty(row.beer_qty || "");
    setBeerRate(row.beer_rate ? row.beer_rate.toString() : "4.31");
    if (row.entry_date) {
      setEntryDate(row.entry_date.slice(0, 10));
    }
    setNotes(row.notes || "");
    
    const shop = shopMap[row.shop_id];
    if (shop) {
      setShopSearchInput(`${shop.shop_no} · ${shop.name}`);
    } else if (row.shop_no && row.shop_name) {
      setShopSearchInput(`${row.shop_no} · ${row.shop_name}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (entryItem) => {
    const id = typeof entryItem === "object" ? entryItem.id : entryItem;
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await api.delete(`/entries/${id}`);
      toast.success("Entry deleted");
      if (editingId === id) resetForm();
      loadEntries();
      loadInvoices();
    } catch (err) {
      toast.error("Failed to delete entry");
    }
  };

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const rows = useMemo(
    () => filteredEntries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredEntries, page]
  );

  return (
    <div>
      <PageHeader
        title="Cotton Box Entry & Invoicing"
        subtitle="Manage Brandy and Beer boxes, 5% GST calculations, and print Tax Invoices."
        icon={PackagePlus}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-6 bg-white border border-slate-200 text-slate-900 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-base font-semibold text-slate-900">
              {editingId ? "Edit Cotton Box Entry" : "New Cotton Box Entry & Invoice"}
            </h2>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-rose-600 hover:underline font-medium"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Wine Shop</label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search shop by no or name..."
                  value={shopSearchInput}
                  onFocus={() => setShowShopDropdown(true)}
                  onChange={(e) => {
                    setShopSearchInput(e.target.value);
                    setShowShopDropdown(true);
                    setShopId("");
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                />

                {showShopDropdown && (
                  <div className="absolute z-20 top-full left-0 right-0 mt-1 max-h-56 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-lg divide-y divide-slate-100">
                    {filteredShopsForSelect.length === 0 ? (
                      <div className="p-3 text-xs text-slate-400 text-center">No matching shops found</div>
                    ) : (
                      filteredShopsForSelect.map((s) => (
                        <div
                          key={s.id || s._id}
                          onClick={() => {
                            const sid = (s.id || s._id).toString();
                            setShopId(sid);
                            setShopSearchInput(`${s.shop_no} · ${s.name}`);
                            setShowShopDropdown(false);
                          }}
                          className="p-2.5 text-xs text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 cursor-pointer transition flex justify-between items-center"
                        >
                          <span className="font-bold text-slate-900">{s.shop_no}</span>
                          <span className="font-medium text-slate-600">{s.name}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 mb-1 block">Entry Date</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 outline-none"
              />
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <p className="text-xs font-bold text-slate-700 uppercase">Line Items & Rates</p>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-xs font-semibold">Brandy Cotton Box</div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={brandyQty}
                    onChange={(e) => setBrandyQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    step="0.01"
                    value={brandyRate}
                    onChange={(e) => setBrandyRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-5 text-xs font-semibold">Beer Cotton Box</div>
                <div className="col-span-3">
                  <input
                    type="number"
                    min="0"
                    placeholder="Qty"
                    value={beerQty}
                    onChange={(e) => setBeerQty(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    step="0.01"
                    value={beerRate}
                    onChange={(e) => setBeerRate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  />
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

        <Card className="p-6 bg-white text-black flex flex-col justify-between rounded-2xl shadow-sm border border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase mb-4">
              <Scale className="h-4 w-4 text-emerald-600" /> Summary
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Brandy Amount</span>
                <span className="font-semibold">₹{brandyAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Beer Amount</span>
                <span className="font-semibold">₹{beerAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t border-slate-200">
                <span>Cotton Box Amount</span>
                <span>₹{cottonBoxAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-emerald-600 text-xs">
                <span>Total GST (5%)</span>
                <span>₹{totalGstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-700 text-lg pt-2 border-t border-slate-200">
                <span>Grand Total</span>
                <span>₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card className="p-6 bg-white border border-slate-200 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 uppercase">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Shop No & Name</th>
                <th className="py-3 px-4 text-center">Brandy</th>
                <th className="py-3 px-4 text-center">Beer</th>
                <th className="py-3 px-4 text-right">Total Amount</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">No entries found.</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-medium">{fmtDate(row.entry_date)}</td>
                    <td className="py-3 px-4 font-semibold">{row.shop_no} · {row.shop_name}</td>
                    <td className="py-3 px-4 text-center">{row.brandy_qty} pcs</td>
                    <td className="py-3 px-4 text-center">{row.beer_qty} pcs</td>
                    <td className="py-3 px-4 text-right font-bold text-emerald-700">₹{Number(row.total_amount).toFixed(2)}</td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => populateEdit(row)} 
                          className="p-1.5 text-slate-400 hover:text-cyan-600 rounded-lg"
                          title="Edit Entry"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => del(row)} className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg" title="Delete Entry">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
          <Pager page={page} pageCount={pageCount} onPage={setPage} onPageChange={setPage} />
        </div>
      </Card>
    </div>
  );
}