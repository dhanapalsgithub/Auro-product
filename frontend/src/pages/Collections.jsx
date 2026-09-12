import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { inr, exportToCsv } from "@/lib/helpers";
import { Coins, Download, Search, IndianRupee, Store, Wallet } from "lucide-react";

const PAGE_SIZE = 12;

export default function Collections() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { api.get("/collections").then((r) => setData(r.data)); }, []);

  const filtered = useMemo(() => {
    const rows = data?.rows || [];
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.shop_no.toLowerCase().includes(q) || r.name.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
  }, [data, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const doExport = () => exportToCsv("collections-outstanding.csv", data?.rows || [], [
    { label: "Shop No", accessor: "shop_no" }, { label: "Name", accessor: "name" }, { label: "Location", accessor: "location" },
    { label: "Opening", accessor: "opening" }, { label: "Invoiced", accessor: "invoiced" }, { label: "Paid", accessor: "paid" }, { label: "Outstanding", accessor: "outstanding" },
  ]);

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500 font-mono">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></div></div></Card>
  );

  return (
    <div>
      <PageHeader title="Collections" subtitle="Running outstanding balance across all 149 shops — chase pending payments fast" icon={Coins}>
        <button data-testid="export-collections-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"><Download className="h-4 w-4" /> Export</button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat icon={IndianRupee} label="Total Outstanding" value={inr(data?.total_outstanding ?? 0)} accent="bg-red-500/15 text-red-300" />
        <Stat icon={Store} label="Shops With Dues" value={data?.shops_with_dues ?? 0} accent="bg-amber-500/15 text-amber-300" />
        <Stat icon={Wallet} label="Total Collected" value={inr(data?.total_paid ?? 0)} accent="bg-emerald-500/15 text-emerald-300" />
      </div>

      <Card className="p-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input data-testid="collections-search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search shop…"
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="collections-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Shop</th><th className="p-4">Location</th><th className="p-4 text-right">Opening</th><th className="p-4 text-right">Invoiced</th><th className="p-4 text-right">Paid</th><th className="p-4 text-right">Outstanding</th><th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((r) => (
                <tr key={r.shop_id} data-testid={`collection-row-${r.shop_no}`} className="hover:bg-white/5 transition-colors">
                  <td className="p-4"><span className="font-mono text-cyan-300">{r.shop_no}</span><div className="text-xs text-slate-500">{r.name}</div></td>
                  <td className="p-4 text-slate-400">{r.location}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{inr(r.opening)}</td>
                  <td className="p-4 text-right font-mono text-slate-400">{inr(r.invoiced)}</td>
                  <td className="p-4 text-right font-mono text-emerald-300">{inr(r.paid)}</td>
                  <td className="p-4 text-right font-mono font-semibold text-red-300">{inr(r.outstanding)}</td>
                  <td className="p-4 text-right">
                    <button data-testid={`collect-${r.shop_no}`} onClick={() => navigate(`/payments?shop=${r.shop_id}`)} className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/25 transition">Collect</button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-slate-500">No outstanding dues. All shops settled!</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="px-4"><Pager page={page} pageCount={pageCount} total={filtered.length} onPage={setPage} testid="collections-pager" /></div>
      </Card>
    </div>
  );
}
