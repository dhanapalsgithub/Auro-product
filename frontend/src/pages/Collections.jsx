import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Coins, Download, Search, Store, Wallet, IndianRupee } from "lucide-react";
import api from "../lib/apiClient";

const PAGE_SIZE = 10;

const inr = (val) => `₹${Number(val || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const exportToCsv = (filename, rows, headers) => {
  if (!rows || !rows.length) return;
  const csvContent = [
    headers.map(h => h.label).join(","),
    ...rows.map(r => headers.map(h => `"${String(r[h.accessor] || "").replace(/"/g, '""')}"`).join(","))
  ].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export default function Collections() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { 
    api.get("/collections")
       .then((r) => setData(r.data))
       .catch(() => setData(null)); 
  }, []);

  const rowsData = useMemo(() => data?.rows || [], [data]);

  const openingBalance = data?.global_opening_balance ?? 0;
  const totalRevenue = data?.total_revenue ?? rowsData.reduce((sum, r) => sum + Number(r.invoiced || 0), 0);
  const totalPurchases = data?.total_purchases ?? rowsData.reduce((sum, r) => sum + Number(r.purchase_amount || 0), 0);
  const netProfit = data?.net_profit ?? (totalRevenue - totalPurchases);
  
  // Closing / Outstanding Balance = Adjusted Opening (Opening - Purchases) + Sales Invoiced (with GST) - Paid Amount
  const outstandingBalance = data?.total_outstanding ?? rowsData.reduce((sum, r) => {
    const adjOpening = Number(r.opening || 0) - Number(r.purchase_amount || 0);
    const salesInvoiced = Number(r.invoiced || 0);
    const paidAmt = Number(r.paid || 0);
    return sum + Math.max(0, adjOpening + salesInvoiced - paidAmt);
  }, 0);

  const totalCollected = data?.total_collected ?? rowsData.reduce((sum, r) => sum + Number(r.paid || 0), 0);
  const shopsWithDues = data?.shops_with_dues ?? rowsData.filter(r => {
    const adjOpening = Number(r.opening || 0) - Number(r.purchase_amount || 0);
    const salesInvoiced = Number(r.invoiced || 0);
    const paidAmt = Number(r.paid || 0);
    return (adjOpening + salesInvoiced - paidAmt) > 0;
  }).length;

  const filtered = useMemo(() => {
    if (!search) return rowsData;
    const q = search.toLowerCase();
    return rowsData.filter((r) => 
      (r.shop_no && r.shop_no.toLowerCase().includes(q)) || 
      (r.name && r.name.toLowerCase().includes(q)) || 
      (r.location && r.location.toLowerCase().includes(q))
    );
  }, [rowsData, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const doExport = () => exportToCsv("collections-outstanding.csv", rowsData, [
    { label: "Shop No", accessor: "shop_no" }, 
    { label: "Name", accessor: "name" }, 
    { label: "Location", accessor: "location" },
    { label: "Opening", accessor: "opening" }, 
    { label: "Purchase (GST)", accessor: "purchase_amount" },
    { label: "Sales Invoiced (GST)", accessor: "invoiced" }, 
    { label: "Paid", accessor: "paid" }, 
    { label: "Sales Outstanding", accessor: (r) => {
        const adj = Number(r.opening || 0) - Number(r.purchase_amount || 0);
        return Math.max(0, adj + Number(r.invoiced || 0) - Number(r.paid || 0));
      } 
    },
  ]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-500/15 text-cyan-400">
              <Coins className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Collections & Balances</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">Tracking sales invoice amounts with GST minus purchase deductions and collections</p>
        </div>
        <button data-testid="export-collections-button" onClick={doExport} className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-500/15 text-cyan-300"><IndianRupee className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Opening Balance</p><p className="text-lg font-bold">{inr(openingBalance)}</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/15 text-blue-300"><IndianRupee className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Total Revenue (Sales)</p><p className="text-lg font-bold">{inr(totalRevenue)}</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-300"><IndianRupee className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Net Profit</p><p className="text-lg font-bold">{inr(netProfit)}</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-500/15 text-red-300"><IndianRupee className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Closing Balance</p><p className="text-lg font-bold">{inr(outstandingBalance)}</p></div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-red-500/15 text-red-300"><IndianRupee className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Sales Outstanding</p><p className="text-lg font-bold">{inr(outstandingBalance)}</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/15 text-amber-300"><Store className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Shops With Dues</p><p className="text-lg font-bold">{shopsWithDues}</p></div>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/10 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-300"><Wallet className="h-6 w-6" /></div>
          <div><p className="text-xs text-slate-400">Total Collected Amount</p><p className="text-lg font-bold">{inr(totalCollected)}</p></div>
        </div>
      </div>

      <div className="p-4 mb-4 rounded-2xl bg-slate-900/40 border border-white/10">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input data-testid="collections-search-input" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Shop no / name…"
            className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50" />
        </div>
      </div>

      <div className="rounded-2xl bg-slate-900/40 border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-3">Shop No</th>
                <th className="p-3">Name</th>
                <th className="p-3">Location</th>
                <th className="p-3 text-right">Purchase (GST)</th>
                <th className="p-3 text-right">Invoiced (GST)</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-6 text-center text-slate-500">No collection records found.</td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const adjOpening = Number(r.opening || 0) - Number(r.purchase_amount || 0);
                  const shopOutstanding = Math.max(0, adjOpening + Number(r.invoiced || 0) - Number(r.paid || 0));
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition">
                      <td className="p-3 font-medium text-cyan-400">{r.shop_no || "-"}</td>
                      <td className="p-3">{r.name || r.shop_name || "-"}</td>
                      <td className="p-3 text-slate-400">{r.location || "-"}</td>
                      <td className="p-3 text-right text-slate-300">{inr(r.purchase_amount || 0)}</td>
                      <td className="p-3 text-right text-slate-300">{inr(r.invoiced || 0)}</td>
                      <td className="p-3 text-right text-emerald-400">{inr(r.paid || 0)}</td>
                      <td className="p-3 text-right font-semibold text-red-400">{inr(shopOutstanding)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/10 text-sm text-slate-400">
            <span>Page {page} of {pageCount}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 transition">Prev</button>
              <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded bg-white/5 disabled:opacity-30 hover:bg-white/10 transition">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}