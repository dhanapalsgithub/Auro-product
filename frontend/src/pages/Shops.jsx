import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { exportToCsv, inr } from "@/lib/helpers";
import { toast } from "sonner";
import { Store, Search, Download, Plus, Pencil, Trash2, MapPin, X, Upload } from "lucide-react";

const PAGE_SIZE = 12;
const empty = { shop_no: "", name: "", district: "", location: "", supervisor: "", contact: "", cycle_days: 5, opening_balance: 0 };

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
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/shops", { params: { search, district } }).then((res) => { setShops(res.data); setPage(1); });
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [search, district]);
  useEffect(() => { api.get("/shops/districts").then((r) => setDistricts(r.data.sort())); }, []);

  const pageCount = Math.max(1, Math.ceil(shops.length / PAGE_SIZE));
  const rows = useMemo(() => shops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [shops, page]);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...modal, cycle_days: parseInt(modal.cycle_days), opening_balance: parseFloat(modal.opening_balance) || 0 };
      if (modal.id) await api.put(`/shops/${modal.id}`, payload);
      else await api.post("/shops", payload);
      toast.success(modal.id ? "Shop updated" : "Shop added");
      setModal(null); load();
    } catch (err) { toast.error("Failed to save shop"); }
    finally { setSaving(false); }
  };

  const del = async (id) => { if (!window.confirm("Delete this shop?")) return; await api.delete(`/shops/${id}`); toast.success("Shop deleted"); load(); };

  const onImport = async (e) => {
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
    { label: "cycle_days", accessor: "cycle_days" }, { label: "opening_balance", accessor: "opening_balance" },
  ]);

  return (
    <div>
      <PageHeader title="149 Wine Shops" subtitle="TASMAC shop directory by shop number & location" icon={Store}>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" onChange={onImport} className="hidden" data-testid="import-file-input" />
        <button data-testid="import-shops-button" onClick={() => fileRef.current?.click()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Upload className="h-4 w-4" /> Import
        </button>
        <button data-testid="export-shops-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
        <button data-testid="add-shop-button" onClick={() => setModal({ ...empty })} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Plus className="h-4 w-4" /> Add Shop
        </button>
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
                <th className="p-4">Contact</th><th className="p-4 text-center">Cycle</th><th className="p-4 text-right">Opening Bal</th><th className="p-4 text-right">Actions</th>
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
                  <td className="p-4 text-right font-mono text-slate-400">{inr(s.opening_balance || 0)}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button data-testid={`edit-shop-${s.shop_no}`} onClick={() => setModal({ ...s })} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-cyan-300"><Pencil className="h-4 w-4" /></button>
                      <button data-testid={`delete-shop-${s.shop_no}`} onClick={() => del(s.id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No shops found.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={shops.length} onPage={setPage} testid="shops-pager" /></div>
      </Card>

      {modal && (
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
              <div>
                <label className="text-xs text-slate-500">Cycle Days</label>
                <select data-testid="shop-field-cycle" value={modal.cycle_days} onChange={(e) => setModal({ ...modal, cycle_days: parseInt(e.target.value) })}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50">
                  <option value={2}>Every 2 days</option><option value={5}>Every 5 days</option><option value={7}>Every 7 days</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">Opening Balance (₹)</label>
                <input data-testid="shop-field-opening" type="number" step="0.01" value={modal.opening_balance || 0} onChange={(e) => setModal({ ...modal, opening_balance: e.target.value })}
                  className="mt-1 w-full rounded-lg bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
              </div>
            </div>
            <button data-testid="save-shop-button" disabled={saving} className="mt-5 w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
              {saving ? "Saving…" : "Save Shop"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
