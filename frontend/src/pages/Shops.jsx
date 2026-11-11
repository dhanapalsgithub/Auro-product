import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { exportToCsv, inr, fmtDate } from "@/lib/helpers";
import { toast } from "sonner";

import {
  Store,
  Search,
  Download,
  Plus,
  Pencil,
  Trash2,
  MapPin,
  X,
  Upload,
  IndianRupee,
  Calendar,
  History,
  Printer,
} from "lucide-react";

const PAGE_SIZE = 5;
const empty = {
  shop_no: "",
  name: "",
  district: "",
  location: "",
  supervisor: "",
  contact: "",
  gst_number: "",
  cycle_days: 5,
};

export default function Shops() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [shops, setShops] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [invoiceParties, setInvoiceParties] = useState([]);
  const [search, setSearch] = useState(params.get("q") || "");
  const [district, setDistrict] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");
  const [openingModal, setOpeningModal] = useState(false);
  const [globalOpening, setGlobalOpening] = useState("");
  const [openingHistory, setOpeningHistory] = useState([]);
  const [deductionBreakdown, setDeductionBreakdown] = useState(null);
  const [enteredBy, setEnteredBy] = useState("");
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [mode, setMode] = useState("replace");
  const [saving, setSaving] = useState(false);
  const [updatingOpening, setUpdatingOpening] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const canEdit = localStorage.getItem("auro_can_edit") === "true";
  const canManageBalance =
    localStorage.getItem("auro_can_manage_balance") === "true";

  const load = () => {
    api
      .get("/shops", { params: { search, district } })
      .then((res) => {
        setShops(res.data);
      });

    api
      .get("/invoices")
      .then((res) => {
        if (Array.isArray(res.data)) {
          const names = [
            ...new Set(
              res.data
                .map((inv) => inv.party_name || inv.party || inv.customer_name)
                .filter(Boolean)
            ),
          ].sort();
          setInvoiceParties(names);
        }
      })
      .catch(() => {});

    api
      .get("/settings/opening-balance")
      .then((res) => {
        if (res.data) {
          if (res.data.opening_balance !== undefined) {
            setGlobalOpening(res.data.opening_balance);
          }
          if (res.data.history) {
            setOpeningHistory(res.data.history);
          }
        }
      })
      .catch(() => {});

    api
      .get("/settings/opening-balance-breakdown")
      .then((res) => {
        if (res.data) {
          setDeductionBreakdown(res.data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
  }, [search, district]);

  useEffect(() => {
    api
      .get("/shops/districts")
      .then((r) => {
        const rawData = Array.isArray(r.data)
          ? r.data
          : Array.isArray(r.data?.districts)
          ? r.data.districts
          : Array.isArray(r.data?.data)
          ? r.data.data
          : [];

        const sortedDistricts = [...rawData].sort((a, b) =>
          String(a).localeCompare(String(b))
        );

        setDistricts(sortedDistricts);
      })
      .catch((err) => {
        console.error("Failed to load districts:", err);
        setDistricts([]);
      });
  }, []);

  const filteredShops = useMemo(() => {
    return (shops || [])
      .filter((s) => {
        const q = search.toLowerCase().trim();
        const matchesSearch =
          !q ||
          (s.shop_no && s.shop_no.toString().toLowerCase().includes(q)) ||
          (s.name && s.name.toString().toLowerCase().includes(q)) ||
          (s.location && s.location.toString().toLowerCase().includes(q)) ||
          (s.gst_number && s.gst_number.toString().toLowerCase().includes(q));

        const matchesDistrict = !district || s.district === district;

        const isParty = s.shop_no?.startsWith("CUST-") || s.type === "party";
        let matchesType = true;
        if (typeFilter === "shop") matchesType = !isParty;
        else if (typeFilter === "party") matchesType = isParty;
        else if (typeFilter !== "all") {
          const shopName = (s.name || s.shop_no || "").toLowerCase();
          matchesType = shopName.includes(typeFilter.toLowerCase());
        }

        const rawDate = s.created_at || s.entry_date || s.date || s.updated_at;
        const shopDateStr = rawDate ? String(rawDate).slice(0, 10) : null;

        let matchesDate = true;
        if (shopDateStr) {
          if (fromDate && shopDateStr < fromDate) matchesDate = false;
          if (toDate && shopDateStr > toDate) matchesDate = false;
        }

        return matchesSearch && matchesDistrict && matchesType && matchesDate;
      })
      .sort((a, b) => {
        const dateA = a.created_at || a.entry_date || a.date || a.updated_at || 0;
        const dateB = b.created_at || b.entry_date || b.date || b.updated_at || 0;
        return new Date(dateB) - new Date(dateA) || (b.id || 0) - (a.id || 0);
      });
  }, [shops, search, district, typeFilter, fromDate, toDate]);

  const sortedShops = useMemo(() => {
    return [...filteredShops].sort((a, b) => (b.id || 0) - (a.id || 0));
  }, [filteredShops]);

  const pageCount = Math.max(1, Math.ceil(sortedShops.length / PAGE_SIZE));
  const rows = useMemo(
    () => sortedShops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [sortedShops, page]
  );

  const save = async (e) => {
    e.preventDefault();
    if (!canEdit) {
      toast.error("Permission denied: Only admins can edit shops.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...modal, cycle_days: parseInt(modal.cycle_days) };
      if (modal.id) await api.put(`/shops/${modal.id}`, payload);
      else await api.post("/shops", payload);
      toast.success(modal.id ? "Shop updated" : "Shop added");
      setModal(null);
      load();
    } catch (err) {
      toast.error("Failed to save shop");
    } finally {
      setSaving(false);
    }
  };

  const saveGlobalOpening = async (e) => {
    e.preventDefault();
    if (!canManageBalance) {
      toast.error(
        "Permission denied: Only admins can manage opening balances."
      );
      return;
    }
    setUpdatingOpening(true);
    try {
      const inputAmount = parseFloat(globalOpening) || 0;
      const payload = {
        opening_balance: inputAmount,
        mode: mode,
        timestamp: new Date().toISOString(),
        entry_date: entryDate,
        entered_by: enteredBy || "Admin",
      };

      const res = await api.post("/settings/opening-balance", payload);
      if (res.data && res.data.opening_balance !== undefined) {
        setGlobalOpening(res.data.opening_balance);
        if (res.data.history) setOpeningHistory(res.data.history);
      }
      
      const breakdownRes = await api.get("/settings/opening-balance-breakdown");
      if (breakdownRes.data) {
        setDeductionBreakdown(breakdownRes.data);
      }

      toast.success("Opening balance updated & history recorded successfully");
      setOpeningModal(false);
      load();
    } catch (err) {
      toast.error("Failed to update opening balance");
    } finally {
      setUpdatingOpening(false);
    }
  };

 const deleteOpeningHistoryLog = async (logId) => {
    if (!window.confirm("Are you sure you want to delete this opening balance entry history?")) return;
    try {
      const res = await api.delete(`/settings/opening-balance-history/${logId}`);
      if (res.data) {
        setGlobalOpening(res.data.opening_balance);
        if (res.data.history) setOpeningHistory(res.data.history);
      }
      
      // Refresh breakdown and list data
      const breakdownRes = await api.get("/settings/opening-balance-breakdown");
      if (breakdownRes.data) {
        setDeductionBreakdown(breakdownRes.data);
      }
      
      toast.success("Opening balance history deleted & recalculated successfully");
      load();
    } catch (err) {
      toast.error("Failed to delete opening balance history");
    }
  };

  const triggerA4Print = () => {
    if (!deductionBreakdown || !deductionBreakdown.breakdown) {
      toast.error("No deduction breakdown data available to print.");
      return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Pop-up blocked! Please allow pop-ups for printing.");
      return;
    }

    const rowsHtml = deductionBreakdown.breakdown.map((row, idx) => `
      <tr>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid black; padding: 6px;">${fmtDate(row.entry_date)}</td>
        <td style="border: 1px solid black; padding: 6px; font-weight: bold;">${row.shop_no} - ${row.shop_name}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right;">₹${Number(row.original_amount).toFixed(2)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; color: #047857; font-weight: bold;">₹${Number(row.opening_deducted).toFixed(2)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">₹${Number(row.net_payable).toFixed(2)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; font-family: monospace;">₹${Number(row.remaining_opening_pool).toFixed(2)}</td>
      </tr>
    `).join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Opening Balance Deduction Audit Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; }
            h1 { text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 4px; }
            p { text-align: center; font-size: 12px; color: #333; margin: 2px 0 15px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background: #f3f4f6; border: 1px solid black; padding: 6px; text-align: left; text-transform: uppercase; font-size: 10px; }
            .summary { border: 2px solid black; padding: 12px; margin-top: 20px; background: #f9fafb; font-size: 12px; border-radius: 6px; }
            .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Auro Products Billing Suite</h1>
          <p>Opening Balance Sequential FIFO Deduction Audit Report</p>
          <p style="font-weight: bold; color: #1e40af;">Opening Balance Base: ₹${Number(deductionBreakdown.initial_opening_balance).toLocaleString("en-IN")}</p>
          
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Date</th>
                <th>Shop Details</th>
                <th style="text-align: right;">Entry Total (₹)</th>
                <th style="text-align: right;">Opening Deducted (₹)</th>
                <th style="text-align: right;">Net Payable (₹)</th>
                <th style="text-align: right;">Remaining Pool (₹)</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>

          <div class="summary">
            <h3 style="margin-top: 0; text-transform: uppercase; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Audit Summary</h3>
            <div class="summary-row"><span>Initial Opening Balance:</span><strong>₹${Number(deductionBreakdown.initial_opening_balance).toFixed(2)}</strong></div>
            <div class="summary-row" style="color: #047857; border-top: 1px solid #e5e7eb;"><span>Total Opening Balance Deducted:</span><strong>₹${Number(deductionBreakdown.total_deducted).toFixed(2)}</strong></div>
            <div class="summary-row" style="font-weight: bold; font-size: 13px; border-top: 2px solid black; margin-top: 4px; padding-top: 4px;"><span>Remaining Opening Balance Pool:</span><span>₹${Number(deductionBreakdown.remaining_opening_balance).toFixed(2)}</span></div>
          </div>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    // Fallback trigger if onload fired before assignment
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };
  const deleteEntryItem = async (entryId) => {
    if (!window.confirm("Are you sure you want to delete this entry?")) return;
    try {
      await api.delete(`/entries/${entryId}`);
      toast.success("Entry deleted successfully");
      load();
    } catch (err) {
      toast.error("Failed to delete entry");
    }
  };

  const del = async (id) => {
    if (!canEdit) {
      toast.error("Permission denied: Only admins can delete shops.");
      return;
    }
    if (!window.confirm("Delete this shop?")) return;

    try {
      await api.delete(`/shops/${id}`);
      toast.success("Shop deleted");
      load();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Failed to delete shop."
      );
    }
  };

  const onImport = async (e) => {
    if (!canEdit) {
      toast.error("Permission denied: Import requires admin rights.");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await api.post("/shops/import", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(
        `Import done · ${res.data.updated} updated, ${res.data.created} created`
      );
      load();
      api.get("/shops/districts").then((r) => setDistricts(r.data.sort()));
    } catch (err) {
      toast.error("Import failed. Use columns: shop_no, supervisor, contact");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const doExport = () =>
    exportToCsv("wine-shops.csv", sortedShops, [
      { label: "shop_no", accessor: "shop_no" },
      { label: "name", accessor: "name" },
      { label: "district", accessor: "district" },
      { label: "location", accessor: "location" },
      { label: "supervisor", accessor: "supervisor" },
      { label: "contact", accessor: "contact" },
      { label: "gst_number", accessor: "gst_number" },
      { label: "cycle_days", accessor: "cycle_days" },
    ]);

  return (
    <div>
      <PageHeader
        title="149 Wine Shops"
        subtitle="TASMAC shop directory by shop number & location"
        icon={Store}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={onImport}
          className="hidden"
          data-testid="import-file-input"
        />

        {canManageBalance && (
          <button
            data-testid="global-opening-button"
            onClick={() => setOpeningModal(true)}
            className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition"
          >
            <IndianRupee className="h-4 w-4" /> Opening Balance{" "}
            {deductionBreakdown?.remaining_opening_balance !== undefined
              ? `(${inr(deductionBreakdown.remaining_opening_balance)})`
              : globalOpening !== "" && `(${inr(globalOpening)})`}
          </button>
        )}

        {canEdit && (
          <button
            data-testid="import-shops-button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
          >
            <Upload className="h-4 w-4" /> Import
          </button>
        )}

        <button
          data-testid="export-shops-button"
          onClick={doExport}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
        >
          <Download className="h-4 w-4" /> Export
        </button>

        {canEdit && (
          <button
            data-testid="add-shop-button"
            onClick={() => setModal({ ...empty })}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition"
          >
            <Plus className="h-4 w-4" /> Add Shop
          </button>
        )}
      </PageHeader>

      <Card className="p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
        <div className="relative lg:col-span-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            data-testid="shops-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search shop no, name, location, GST…"
            className="w-full rounded-xl bg-transparent/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50"
          />
        </div>

        <div className="lg:col-span-3">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-4 text-sm outline-none focus:border-cyan-500/50"
          >
            <option value="all" className="bg-slate-900 text-slate-200">
              All Entries
            </option>
            <option value="shop" className="bg-slate-900 text-slate-200">
              Wine Shops Only
            </option>
            <option value="party" className="bg-slate-900 text-slate-200">
              Party / Purchase Entries Only
            </option>
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            data-testid="shops-district-filter"
            value={district}
            onChange={(e) => {
              setDistrict(e.target.value);
              setPage(1);
            }}
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-4 text-sm outline-none focus:border-cyan-500/50"
          >
            <option value="" className="bg-slate-900 text-slate-200">
              All Districts
            </option>
            {districts.map((d) => (
              <option key={d} value={d} className="bg-slate-900 text-slate-200">
                {d}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-2 relative">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus-within:border-cyan-500/50">
            <span className="text-[8px] font-bold text-slate-100 uppercase mr-1 font-mono">
              From
            </span>
            <input
              type="date"
              data-testid="shops-from-date-filter"
              value={fromDate}
              max={toDate || undefined}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-900 outline-none rounded-lg px-2 py-1 font-medium [color-scheme:light]"
            />
          </div>
        </div>

        <div className="lg:col-span-2 relative">
          <div className="flex items-center rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm focus-within:border-cyan-500/50">
            <span className="text-[10px] font-bold text-slate-300 uppercase mr-2 font-mono">
              To
            </span>
            <input
              type="date"
              data-testid="shops-to-date-filter"
              value={toDate}
              min={fromDate || undefined}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-transparent text-xs text-slate-900 placeholder:text-slate-900 outline-none rounded-lg px-2 py-1 font-medium [color-scheme:light]"
            />
          </div>
        </div>

        {(search || district || fromDate || toDate || typeFilter !== "all") && (
          <div className="lg:col-span-1 flex items-center justify-end">
            <button
              onClick={() => {
                setSearch("");
                setDistrict("");
                setFromDate("");
                setToDate("");
                setTypeFilter("all");
                setPage(1);
              }}
              className="text-xs text-cyan-400 hover:text-cyan-300 font-mono hover:underline px-2 py-1"
            >
              Reset
            </button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="shops-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Shop No</th>
                <th className="p-4">Location</th>
                <th className="p-4">Supervisor</th>
                <th className="p-4">Contact</th>
                <th className="p-4 text-center">Cycle</th>
                {canEdit && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((s) => (
                <tr
                  key={s.id}
                  data-testid={`shop-row-${s.shop_no}`}
                  className="hover:bg-white/5 transition-colors"
                >
                  <td className="p-4">
                    <button
                      onClick={() => navigate(`/payments?shop=${s.id}`)}
                      className="font-mono text-cyan-300 hover:underline"
                    >
                      {s.shop_no}
                    </button>
                    <div className="text-xs text-slate-500">{s.name}</div>
                  </td>
                  <td className="p-4 text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {s.location || "—"}
                    </span>
                    {s.gst_number && (
                      <div className="text-[11px] font-mono text-cyan-400 mt-1 pl-5">
                        GST: {s.gst_number}
                      </div>
                    )}
                  </td>
                  <td className="p-4 text-slate-400">{s.supervisor || "—"}</td>
                  <td className="p-4 text-slate-400">{s.contact || "—"}</td>
                  <td className="p-4 text-center">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        s.cycle_days === 2
                          ? "bg-amber-500/15 text-amber-300"
                          : "bg-cyan-500/15 text-cyan-300"
                      }`}
                    >
                      {s.cycle_days}d
                    </span>
                  </td>
                  {canEdit && (
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          data-testid={`edit-shop-${s.shop_no}`}
                          onClick={() => setModal({ ...s })}
                          className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          data-testid={`delete-shop-${s.shop_no}`}
                          onClick={() => del(s.id)}
                          className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={canEdit ? 6 : 5}
                    className="p-8 text-center text-slate-500"
                  >
                    No shops found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <Pager
            page={page}
            pageCount={pageCount}
            total={sortedShops.length}
            onPage={setPage}
            testid="shops-pager"
          />
        </div>
      </Card>

      {modal && canEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="shop-modal"
        >
          <div
            className="absolute inset-0 bg-white/80 backdrop-blur-sm"
            onClick={() => setModal(null)}
          />
          <form
            onSubmit={save}
            className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto text-slate-800"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                {modal.id ? "Edit Shop" : "Add Shop"}
              </h3>
              <button type="button" onClick={() => setModal(null)}>
                <X className="h-5 w-5 text-slate-400 hover:text-slate-600" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                ["shop_no", "Shop No"],
                ["name", "Shop Name"],
                ["district", "District"],
                ["location", "Location"],
                ["supervisor", "Supervisor"],
                ["contact", "Contact"],
                ["gst_number", "GST Number"],
              ].map(([k, label]) => (
                <div
                  key={k}
                  className={
                    k === "location" || k === "name" || k === "gst_number"
                      ? "sm:col-span-2"
                      : ""
                  }
                >
                  <label className="text-xs text-slate-600 font-medium">
                    {label}
                  </label>
                  <input
                    data-testid={`shop-field-${k}`}
                    required={k === "shop_no" || k === "name"}
                    value={modal[k] || ""}
                    onChange={(e) =>
                      setModal({ ...modal, [k]: e.target.value })
                    }
                    placeholder={k === "gst_number" ? "e.g. 33AAAAA0000A1Z5" : ""}
                    className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 py-2 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:bg-white transition"
                  />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-600 font-medium">
                  Cycle Days
                </label>
                <select
                  data-testid="shop-field-cycle"
                  value={modal.cycle_days}
                  onChange={(e) =>
                    setModal({ ...modal, cycle_days: parseInt(e.target.value) })
                  }
                  className="mt-1 w-full rounded-lg bg-slate-50 border border-slate-200 py-2 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:bg-white transition"
                >
                  <option value={2}>Every 2 days</option>
                  <option value={5}>Every 5 days</option>
                  <option value={7}>Every 7 days</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="w-1/3 rounded-xl border border-slate-200 bg-slate-100 py-3 font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                Exit
              </button>
              <button
                data-testid="save-shop-button"
                disabled={saving}
                className="w-2/3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-white active:scale-95 transition disabled:opacity-60 shadow-md"
              >
                {saving ? "Saving…" : "Save Shop"}
              </button>
            </div>
          </form>
        </div>
      )}

      {openingModal && canManageBalance && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          data-testid="global-opening-modal"
        >
          <div
            className="absolute inset-0 bg-white/60 backdrop-blur-sm"
            onClick={() => setOpeningModal(false)}
          />
          <form
            onSubmit={saveGlobalOpening}
            className="glass relative z-10 w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2 text-white">
                <History className="h-5 w-5 text-cyan-400" /> Manage Opening Balance
              </h3>
              <button type="button" onClick={() => setOpeningModal(false)}>
                <X className="h-5 w-5 text-slate-400 hover:text-white" />
              </button>
            </div>

            <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 text-xs mb-4 flex justify-between items-center">
              <div>
                <span className="font-bold">Dynamic FIFO Deduction Audit</span>
                <p className="text-[11px] text-slate-400 mt-0.5">Deducted sequentially per entry based on user opening balance amount.</p>
              </div>
              <button
                type="button"
                onClick={triggerA4Print}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500 text-slate-900 font-bold rounded-lg hover:bg-cyan-400 transition text-xs shadow-md"
              >
                <Printer className="h-3.5 w-3.5" /> Print A4 Deduction Audit
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Opening Balance Amount (₹)</label>
                  <input
                    data-testid="global-opening-input"
                    type="number"
                    step="0.01"
                    required
                    value={globalOpening}
                    onChange={(e) => setGlobalOpening(e.target.value)}
                    placeholder="Enter amount..."
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm text-cyan-400 font-mono outline-none focus:border-cyan-500/50"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Entry Mode</label>
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm text-cyan-400 outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                  >
                    <option value="replace" className="bg-slate-900 text-slate-200">Reset & Replace</option>
                    <option value="add" className="bg-slate-900 text-slate-200">Add to Existing</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" /> Entry Date
                  </label>
                  <input
                    type="date"
                    required
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm text-cyan-400 outline-none focus:border-cyan-500/50 [color-scheme:dark]"
                  />
                </div>
              </div>

              {openingHistory && openingHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-2 block flex justify-between items-center">
                    <span>Opening Balance Entry History (Audit Logs)</span>
                    <span className="text-[10px] text-amber-400">Deleting log recalculates balance</span>
                  </label>
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-white/10 bg-black/40 text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 font-mono">
                          <th className="p-2">Date</th>
                          <th className="p-2">Mode</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-right">Total After</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {openingHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-white/5">
                            <td className="p-2 text-slate-400">{fmtDate(h.entry_date)}</td>
                            <td className="p-2 text-cyan-300 capitalize">{h.mode}</td>
                            <td className="p-2 text-right text-emerald-400">₹{Number(h.amount).toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-300">₹{Number(h.total_after).toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => deleteOpeningHistoryLog(h.id)}
                                title="Delete History Log"
                                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {deductionBreakdown && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <label className="text-xs font-mono uppercase tracking-wider text-slate-300 mb-2 block flex justify-between items-center">
                    <span>Sequential FIFO Entry Deductions (Traceability)</span>
                    <span className="text-[10px] text-cyan-400">Click Trash to Delete Entry</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-black/40 text-xs">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-white/10 text-[10px] uppercase text-slate-400 font-mono">
                          <th className="p-2">Date</th>
                          <th className="p-2">Shop</th>
                          <th className="p-2 text-right">Entry Amt</th>
                          <th className="p-2 text-right text-emerald-400">Deducted</th>
                          <th className="p-2 text-right">Net Amt</th>
                          <th className="p-2 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 font-mono">
                        {deductionBreakdown.breakdown.map((b) => (
                          <tr key={b.entry_id} className="hover:bg-white/5">
                            <td className="p-2 text-slate-400">{fmtDate(b.entry_date)}</td>
                            <td className="p-2 text-cyan-300">{b.shop_no}</td>
                            <td className="p-2 text-right">₹{b.original_amount.toFixed(2)}</td>
                            <td className="p-2 text-right text-emerald-400">₹{b.opening_deducted.toFixed(2)}</td>
                            <td className="p-2 text-right text-slate-300">₹{b.net_payable.toFixed(2)}</td>
                            <td className="p-2 text-center">
                              <button
                                type="button"
                                onClick={() => deleteEntryItem(b.entry_id)}
                                title="Delete Entry"
                                className="p-1 hover:bg-red-500/20 text-red-400 rounded transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                type="button"
                onClick={() => setOpeningModal(false)}
                className="w-1/3 rounded-xl border border-white/10 bg-white/5 py-3 font-semibold text-slate-300 hover:bg-white/10 transition"
              >
                Exit
              </button>
              <button
                data-testid="save-global-opening-button"
                disabled={updatingOpening}
                className="w-2/3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60"
              >
                {updatingOpening ? "Saving…" : "Save Opening Balance"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}