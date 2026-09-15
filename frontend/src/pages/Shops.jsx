import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { exportToCsv, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Store, Search, Download, Plus, Pencil, Trash2, MapPin, X, Upload, IndianRupee, Calendar, User, History } from "lucide-react";

const PAGE_SIZE = 5;
const HISTORY_PAGE_SIZE = 5;
const empty = { shop_no: "", name: "", district: "", location: "", supervisor: "", contact: "", cycle_days: 5 };

export default function Shops() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const fileRef = useRef();
  const [shops, setShops] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [search, setSearch] = useState(params.get("q") || "");
  const [district, setDistrict] = useState("");
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [openingModal, setOpeningModal] = useState(false);
  const [globalOpening, setGlobalOpening] = useState("");
  const [openingHistory, setOpeningHistory] = useState([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyDateFilter, setHistoryDateFilter] = useState("");
  const [enteredBy, setEnteredBy] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [mode, setMode] = useState("add");
  const [saving, setSaving] = useState(false);
  const [updatingOpening, setUpdatingOpening] = useState(false);

  // 🔒 Admin-only Permission Flags for opening balance, edits, and deletions
  const canEdit = localStorage.getItem("auro_can_edit") === "true";
  const canManageBalance = localStorage.getItem("auro_can_manage_balance") === "true";

  const load = () => {
    api.get("/shops", { params: { search, district } }).then((res) => { setShops(res.data); setPage(1); });
    api.get("/settings/opening-balance").then((res) => {
      if (res.data) {
        if (res.data.opening_balance !== undefined) {
          setGlobalOpening(res.data.opening_balance);
        }
        if (res.data.history) {
          setOpeningHistory(res.data.history);
        }
      }
    }).catch(() => {});
  };

  useEffect(() => { load(); }, [search, district]);
  useEffect(() => { api.get("/shops/districts").then((r) => setDistricts(r.data.sort())); }, []);

  const pageCount = Math.max(1, Math.ceil(shops.length / PAGE_SIZE));
  const rows = useMemo(() => shops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [shops, page]);

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
      setModal(null); load();
    } catch (err) { toast.error("Failed to save shop"); }
    finally { setSaving(false); }
  };

  const saveGlobalOpening = async (e) => {
    e.preventDefault();
    if (!canManageBalance) {
      toast.error("Permission denied: Only admins can manage opening balances.");
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
        entered_by: enteredBy || "Admin"
      };

      const res = await api.post("/settings/opening-balance", payload);
      if (res.data && res.data.opening_balance !== undefined) {
        setGlobalOpening(res.data.opening_balance);
        if (res.data.history) setOpeningHistory(res.data.history);
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

  const del = async (id) => { 
    if (!canEdit) {
      toast.error("Permission denied: Only admins can delete shops.");
      return;
    }
    if (!window.confirm("Delete this shop?")) return; 
    await api.delete(`/shops/${id}`); 
    toast.success("Shop deleted"); 
    load(); 
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
      const res = await api.post("/shops/import", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success(`Import done · ${res.data.updated} updated, ${res.data.created} created`);
      load();
      api.get("/shops/districts").then((r) => setDistricts(r.data.sort()));
    } catch (err) { toast.error("Import failed. Use columns: shop_no, supervisor, contact"); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };

  const doExport = () => exportToCsv("wine-shops.csv", shops, [
    { label: "shop_no", accessor: "shop_no" }, { label: "name", accessor: "name" },
    { label: "district", accessor: "district" }, { label: "location", accessor: "location" },
    { label: "supervisor", accessor: "supervisor" }, { label: "contact", accessor: "contact" },
    { label: "cycle_days", accessor: "cycle_days" },
  ]);

  return (
    <div>
      <PageHeader title="149 Wine Shops" subtitle="TASMAC shop directory by shop number & location" icon={Store}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onImport} className="hidden" data-testid="import-file-input" />
        
        {/* Opening balance button restricted strictly to admins */}
        {canManageBalance && (
          <button data-testid="global-opening-button" onClick={() => setOpeningModal(true)} className="flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-300 hover:bg-cyan-500/20 transition">
            <IndianRupee className="h-4 w-4" /> Opening Balance {globalOpening !== "" && `(${inr(globalOpening)})`}
          </button>
        )}

        {canEdit && (
          <button data-testid="import-shops-button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
            <Upload className="h-4 w-4" /> Import
          </button>
        )}

        <button data-testid="export-shops-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>

        {canEdit && (
          <button data-testid="add-shop-button" onClick={() => setModal({ ...empty })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
            <Plus className="h-4 w-4" /> Add Shop
          </button>
        )}
      </PageHeader>

      <Card className="p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input data-testid="shops-search-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search shop no, name, location…"
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
        </div>
        <select data-testid="shops-district-filter" value={district} onChange={(e) => setDistrict(e.target.value)}
          className="rounded-xl bg-white/5 border border-white/10 py-2.5 px-4 text-sm outline-none focus:border-cyan-500/50 min-w-[180px]">
          <option value="">All Districts</option>
          {districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="shops-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Shop No</th><th className="p-4">Location</th><th className="p-4">Supervisor</th>
                <th className="p-4">Contact</th><th className="p-4 text-center">Cycle</th>
                {canEdit && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((s) => (
                <tr key={s.id} data-testid={`shop-row-${s.shop_no}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-4"><button onClick={() => navigate(`/payments?shop=${s.id}`)} className="font-mono text-cyan-300 hover:underline">{s.shop_no}</button><div className="text-xs text-slate-500">{s.name}</div></td>
                  <td className="p-4 text-slate-400"><span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{s.location}</span></td>
                  <td className="p-4 text-slate-400">{s.supervisor || "—"}</td>
                  <td className="p-4 text-slate-400">{s.contact || "—"}</td>
                  <td className="p-4 text-center"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${s.cycle_days === 2 ? "bg-amber-500/15 text-amber-300" : "bg-cyan-500/15 text-cyan-300"}`}>{s.cycle_days}d</span></td>
                  {canEdit && (
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button data-testid={`edit-shop-${s.shop_no}`} onClick={() => setModal({ ...s })} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300"><Pencil className="h-4 w-4" /></button>
                        <button data-testid={`delete-shop-${s.shop_no}`} onClick={() => del(s.id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={canEdit ? 6 : 5} className="p-8 text-center text-slate-500">No shops found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={shops.length} onPage={setPage} testid="shops-pager" /></div>
      </Card>

      {modal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="shop-modal">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setModal(null)} />
          <form onSubmit={save} className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold">{modal.id ? "Edit Shop" : "Add Shop"}</h3>
              <button type="button" onClick={() => setModal(null)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[["shop_no", "Shop No"], ["name", "Shop Name"], ["district", "District"], ["location", "Location"], ["supervisor", "Supervisor"], ["contact", "Contact"]].map(([k, label]) => (
                <div key={k} className={k === "location" || k === "name" ? "sm:col-span-2" : ""}>
                  <label className="text-xs text-slate-500">{label}</label>
                  <input data-testid={`shop-field-${k}`} required={k === "shop_no" || k === "name"} value={modal[k] || ""} onChange={(e) => setModal({ ...modal, [k]: e.target.value })}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Cycle Days</label>
                <select data-testid="shop-field-cycle" value={modal.cycle_days} onChange={(e) => setModal({ ...modal, cycle_days: parseInt(e.target.value) })}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50">
                  <option value={2}>Every 2 days</option><option value={5}>Every 5 days</option><option value={7}>Every 7 days</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setModal(null)} className="w-1/3 rounded-xl border border-white/10 bg-white/5 py-3 font-semibold text-slate-300 hover:bg-white/10 transition">
                Exit
              </button>
              <button data-testid="save-shop-button" disabled={saving} className="w-2/3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
                {saving ? "Saving…" : "Save Shop"}
              </button>
            </div>
          </form>
        </div>
      )}

      {openingModal && canManageBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="global-opening-modal">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setOpeningModal(false)} />
          <form onSubmit={saveGlobalOpening} className="glass relative z-10 w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <History className="h-5 w-5 text-cyan-400" /> Manage Opening Balance
              </h3>
              <button type="button" onClick={() => setOpeningModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            
            <p className="text-xs text-slate-400 mb-4">Update universal opening balance, accumulate or overwrite, and track entry metadata logs.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500">Update Mode</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button type="button" onClick={() => setMode("add")} className={`py-2 px-3 text-xs rounded-lg border transition ${mode === "add" ? "bg-cyan-500/25 border-cyan-500 text-cyan-300 font-medium" : "bg-white/5 border-white/10 text-slate-400"}`}>
                    Add (+) to Existing
                  </button>
                  <button type="button" onClick={() => setMode("replace")} className={`py-2 px-3 text-xs rounded-lg border transition ${mode === "replace" ? "bg-cyan-500/25 border-cyan-500 text-cyan-300 font-medium" : "bg-white/5 border-white/10 text-slate-400"}`}>
                    Overwrite / Set Exact
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500">Amount (₹)</label>
                  <input data-testid="global-opening-input" type="number" step="0.01" required value={globalOpening} onChange={(e) => setGlobalOpening(e.target.value)} placeholder="Enter amount..."
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
                </div>
                <div>
                  <label className="text-xs text-slate-500 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Entry Date</label>
                  <input type="date" required value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                    className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50 text-slate-200" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 flex items-center gap-1"><User className="h-3.5 w-3.5" /> Entered By</label>
                <input type="text" placeholder="e.g. Accountant Name / Admin" value={enteredBy} onChange={(e) => setEnteredBy(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>

              {openingHistory.length > 0 && (
                <div className="mt-4 pt-3 border-t border-white/10">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                    <label className="text-xs font-mono uppercase tracking-wider text-slate-300">History Logs & Filter</label>
                    
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <Calendar className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                      <input 
                        type="date" 
                        value={historyDateFilter || ""} 
                        onChange={(e) => { setHistoryDateFilter(e.target.value); setHistoryPage(1); }}
                        className="rounded bg-white/10 border border-white/20 px-2 py-1 text-xs text-white outline-none focus:border-cyan-500"
                        placeholder="Filter by date"
                      />
                      {historyDateFilter && (
                        <button type="button" onClick={() => setHistoryDateFilter("")} className="text-xs text-red-300 hover:underline px-1">Clear</button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg bg-white p-3 border border-slate-200 text-xs text-slate-900 shadow-sm">
                    {(() => {
                      const filteredHistory = openingHistory.filter(h => {
                        if (!historyDateFilter) return true;
                        const logDate = h.entry_date || (h.timestamp ? h.timestamp.slice(0, 10) : "");
                        return logDate === historyDateFilter;
                      });

                      const currentFilteredPageCount = Math.max(1, Math.ceil(filteredHistory.length / HISTORY_PAGE_SIZE));
                      const displayedHistory = filteredHistory.slice((historyPage - 1) * HISTORY_PAGE_SIZE, historyPage * HISTORY_PAGE_SIZE);

                      if (displayedHistory.length === 0) {
                        return <div className="text-center py-3 text-slate-500">No history records found for this date.</div>;
                      }

                      return (
                        <>
                          {displayedHistory.map((h, idx) => (
                            <div key={idx} className="py-2 border-b border-slate-100 last:border-b-0 flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-2 text-slate-800">
                                  <span className="font-medium text-cyan-700">{h.entry_date || new Date(h.timestamp || Date.now()).toLocaleDateString()}</span>
                                  <span className="text-[10px] bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded text-slate-700">By: {h.entered_by || "Admin"}</span>
                                </div>
                                <span className="text-[10px] text-slate-500 block mt-0.5">Mode: <span className="uppercase text-amber-600 font-semibold">{h.mode}</span> (Amt: ₹{h.amount})</span>
                              </div>
                              <span className="font-mono font-semibold text-emerald-600 text-sm">₹{h.total_after}</span>
                            </div>
                          ))}

                          {filteredHistory.length > HISTORY_PAGE_SIZE && (
                            <div className="pt-3 mt-1 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-600">
                              <span>Page {historyPage} of {currentFilteredPageCount}</span>
                              <div className="flex gap-1">
                                <button type="button" disabled={historyPage === 1} onClick={() => setHistoryPage(p => Math.max(1, p - 1))} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 transition text-slate-700">Prev</button>
                                <button type="button" disabled={historyPage >= currentFilteredPageCount} onClick={() => setHistoryPage(p => p + 1)} className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 disabled:opacity-30 transition text-slate-700">Next</button>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button type="button" onClick={() => setOpeningModal(false)} className="w-1/3 rounded-xl border border-white/10 bg-white/5 py-3 font-semibold text-slate-300 hover:bg-white/10 transition">
                Exit
              </button>
              <button data-testid="save-global-opening-button" disabled={updatingOpening} className="w-2/3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
                {updatingOpening ? "Saving…" : "Save Opening Balance"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}