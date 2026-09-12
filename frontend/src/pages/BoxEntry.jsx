import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { exportToCsv, fmtDate } from "@/lib/helpers";
import { toast } from "sonner";
import { PackagePlus, Scale, Package, Download, Trash2 } from "lucide-react";

const PAGE_SIZE = 10;

export default function BoxEntry() {
  const [params] = useSearchParams();
  const [shops, setShops] = useState([]);
  const [entries, setEntries] = useState([]);
  const [shopId, setShopId] = useState(params.get("shop") || "");
  const [quantity, setQuantity] = useState("");
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [divisor, setDivisor] = useState(12);
  const [page, setPage] = useState(1);
  const [saving, setSaving] = useState(false);

  const load = () => api.get("/entries").then((r) => setEntries(r.data));
  useEffect(() => {
    api.get("/shops").then((r) => setShops(r.data));
    api.get("/settings").then((r) => setDivisor(r.data.waste_divisor || 12));
    load();
  }, []);

  const waste = quantity ? (parseFloat(quantity) / divisor) : 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!shopId || !quantity) { toast.error("Select a shop and enter quantity"); return; }
    setSaving(true);
    try {
      await api.post("/entries", { shop_id: shopId, quantity: parseInt(quantity), entry_date: new Date(entryDate).toISOString(), notes });
      toast.success("Inventory entry saved — reminder scheduled");
      setQuantity(""); setNotes(""); load();
    } catch (err) { toast.error("Failed to save entry"); }
    finally { setSaving(false); }
  };

  const del = async (id) => { await api.delete(`/entries/${id}`); toast.success("Entry deleted"); load(); };

  const pageCount = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const rows = useMemo(() => entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [entries, page]);

  const doExport = () => exportToCsv("box-entries.csv", entries, [
    { label: "Date", accessor: (r) => fmtDate(r.entry_date) }, { label: "Shop No", accessor: "shop_no" },
    { label: "Shop", accessor: "shop_name" }, { label: "Boxes (pcs)", accessor: "quantity" },
    { label: "Waste (kg)", accessor: "waste_kg" }, { label: "Notes", accessor: "notes" },
  ]);

  return (
    <div>
      <PageHeader title="Cotton Box Entry" subtitle={`Enter boxes in PCS · waste auto-calculated as qty ÷ ${divisor} kg`} icon={PackagePlus}>
        <button data-testid="export-entries-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="lg:col-span-2 p-6">
          <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500">Wine Shop</label>
              <select data-testid="entry-shop-select" value={shopId} onChange={(e) => setShopId(e.target.value)} required
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50">
                <option value="">Select shop…</option>
                {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name} ({s.location})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Cotton Boxes (PCS)</label>
              <input data-testid="entry-quantity-input" type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)} required placeholder="e.g. 2500"
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
            </div>
            <div>
              <label className="text-xs text-slate-500">Entry Date</label>
              <input data-testid="entry-date-input" type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500">Notes (optional)</label>
              <input data-testid="entry-notes-input" value={notes} onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-xl bg-white/5 border border-white/10 py-2.5 px-3 text-sm outline-none focus:border-cyan-500/50" />
            </div>
            <button data-testid="save-entry-button" disabled={saving} className="sm:col-span-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 active:scale-95 transition disabled:opacity-60">
              {saving ? "Saving…" : "Save Entry"}
            </button>
          </form>
        </Card>

        <Card className="p-6 flex flex-col justify-center items-center text-center border-emerald-500/20">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-300 mb-3"><Scale className="h-6 w-6" /></div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-mono">Calculated Waste</p>
          <p data-testid="waste-calc-output" className="font-display text-4xl font-bold text-emerald-300 mt-2">{waste.toFixed(2)} <span className="text-lg">kg</span></p>
          <p className="text-xs text-slate-500 mt-2">{quantity || 0} pcs ÷ {divisor}</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-5 border-b border-white/10 flex items-center gap-2">
          <Package className="h-4 w-4 text-cyan-300" />
          <h2 className="font-display text-lg font-semibold">Recent Entries</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="entries-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Date</th><th className="p-4">Shop</th><th className="p-4 text-right">Boxes</th><th className="p-4 text-right">Waste (kg)</th><th className="p-4">Notes</th><th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((e) => (
                <tr key={e.id} data-testid={`entry-row-${e.id}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-4 font-mono text-slate-400">{fmtDate(e.entry_date)}</td>
                  <td className="p-4"><span className="text-cyan-300 font-mono">{e.shop_no}</span> · {e.shop_name}</td>
                  <td className="p-4 text-right font-mono">{e.quantity.toLocaleString("en-IN")}</td>
                  <td className="p-4 text-right font-mono text-emerald-300">{e.waste_kg}</td>
                  <td className="p-4 text-slate-400 truncate max-w-[160px]">{e.notes || "—"}</td>
                  <td className="p-4 text-right"><button data-testid={`delete-entry-${e.id}`} onClick={() => del(e.id)} className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-slate-500">No entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={entries.length} onPage={setPage} testid="entries-pager" /></div>
      </Card>
    </div>
  );
}
