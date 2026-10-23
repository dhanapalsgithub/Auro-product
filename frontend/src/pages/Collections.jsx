import React, { useEffect, useState, useMemo } from "react";
import { Coins, Download, Search, IndianRupee } from "lucide-react";
import api from "../lib/apiClient";

const PAGE_SIZE = 10;
const inr = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const exportToCsv = (filename, rows, headers) => {
  if (!rows || !rows.length) return;
  const csvContent = [
    headers.map((h) => h.label).join(","),
    ...rows.map((r) =>
      headers
        .map((h) => `"${String(r[h.accessor] || "").replace(/"/g, '""')}"`)
        .join(",")
    ),
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
  const [collectionsData, setCollectionsData] = useState(null);
  const [entriesData, setEntriesData] = useState([]);
  const [initialOpeningBalance, setInitialOpeningBalance] = useState(0);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    // Fetch all required data concurrently to ensure accuracy
    Promise.allSettled([
      api.get("/collections"),
      api.get("/entries"),
      api.get("/settings/opening-balance")
    ]).then(([colRes, entRes, obRes]) => {
      if (colRes.status === "fulfilled") setCollectionsData(colRes.value.data);
      if (entRes.status === "fulfilled") {
        const entArr = Array.isArray(entRes.value.data)
          ? entRes.value.data
          : entRes.value.data?.data || [];
        setEntriesData(entArr);
      }
      if (obRes.status === "fulfilled") {
        setInitialOpeningBalance(Number(obRes.value.data?.opening_balance || 0));
      }
    });
  }, []);

  // Map entries total purchase per shop (Cotton Box Entry with GST)
  const entriesByShop = useMemo(() => {
    const shopMap = {};
    const shopNoMap = {};

    entriesData.forEach((entry) => {
      const amt = Number(entry.total_amount || entry.grand_total || entry.amount || 0);
      if (entry.shop_id) {
        shopMap[entry.shop_id] = (shopMap[entry.shop_id] || 0) + amt;
      }
      if (entry.shop_no && entry.shop_no !== "—") {
        shopNoMap[String(entry.shop_no).trim()] = (shopNoMap[String(entry.shop_no).trim()] || 0) + amt;
      }
    });

    return { shopMap, shopNoMap };
  }, [entriesData]);

  // Total Purchase Entries (Cotton Box Entries with GST) across all shops
  const totalCottonBoxPurchases = useMemo(() => {
    return entriesData.reduce(
      (sum, e) => sum + Number(e.total_amount || e.grand_total || e.amount || 0),
      0
    );
  }, [entriesData]);

  // Merge shop rows with precise Cotton Box purchase amounts
  const rowsData = useMemo(() => {
    const rawRows = Array.isArray(collectionsData?.rows) ? collectionsData.rows : [];

    return rawRows.map((r) => {
      const shopIdKey = r.shop_id;
      const shopNoKey = String(r.shop_no || "").trim();

      const entryPurchaseAmt =
        (shopIdKey && entriesByShop.shopMap[shopIdKey]) ||
        (shopNoKey && entriesByShop.shopNoMap[shopNoKey]) ||
        0;

      const finalPurchaseAmt = Math.max(Number(r.purchase_amount || 0), entryPurchaseAmt);

      return {
        ...r,
        purchase_amount: finalPurchaseAmt
      };
    });
  }, [collectionsData, entriesByShop]);

  // Calculation for Opening & Closing Balance
  const currentOpeningBalance = Number(collectionsData?.global_opening_balance || initialOpeningBalance);
  
  const totalRevenue = useMemo(() => {
    if (typeof collectionsData?.total_revenue === "number" && collectionsData.total_revenue > 0) {
      return collectionsData.total_revenue;
    }
    return rowsData.reduce((sum, r) => sum + Number(r.invoiced || 0), 0);
  }, [collectionsData, rowsData]);

  const totalPurchases = useMemo(() => {
    return Math.max(
      totalCottonBoxPurchases,
      rowsData.reduce((sum, r) => sum + Number(r.purchase_amount || 0), 0)
    );
  }, [totalCottonBoxPurchases, rowsData]);

  const totalExpenses = Number(collectionsData?.total_expenses || 0);
  const netProfit = totalRevenue - (totalPurchases + totalExpenses);

  // Closing Balance = Opening Balance minus Total Cotton Box Purchase Entries with GST
  const closingBalance = Math.max(0, currentOpeningBalance - totalPurchases);

  const filtered = useMemo(() => {
    let result = rowsData;

    if (fromDate || toDate) {
      result = result.filter((r) => {
        const itemDate = r.date || r.created_at || r.invoice_date;
        if (!itemDate) return false;
        if (fromDate && itemDate < fromDate) return false;
        if (toDate && itemDate > toDate) return false;
        return true;
      });
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          (r.shop_no && String(r.shop_no).toLowerCase().includes(q)) ||
          (r.name && r.name.toLowerCase().includes(q)) ||
          (r.location && r.location.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      const dateA = new Date(a.date || a.created_at || a.invoice_date || 0);
      const dateB = new Date(b.date || b.created_at || b.invoice_date || 0);
      return dateB - dateA;
    });
  }, [rowsData, search, fromDate, toDate]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-100 text-cyan-700">
              <Coins className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Collections & Balances
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Tracking total sales invoice amounts with GST minus purchase deductions, expenses, and collections
          </p>
        </div>
        <button
          onClick={() =>
            exportToCsv("collections.csv", rowsData, [
              { label: "Date", accessor: "date" },
              { label: "Shop No", accessor: "shop_no" },
              { label: "Name", accessor: "name" },
              { label: "Purchase (GST)", accessor: "purchase_amount" },
              { label: "Invoiced", accessor: "invoiced" },
              { label: "Paid", accessor: "paid" },
            ])
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition shadow-sm"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-cyan-50 text-cyan-600">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Opening Balance</p>
            <p className="text-lg font-bold text-slate-900">{inr(currentOpeningBalance)}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Revenue (Sales GST)</p>
            <p className="text-lg font-bold text-slate-900">{inr(totalRevenue)}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Net Profit</p>
            <p className={`text-lg font-bold ${netProfit < 0 ? "text-rose-600" : "text-slate-900"}`}>
              {inr(netProfit)}
            </p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-rose-50 text-rose-600">
            <IndianRupee className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Closing Balance</p>
            <p className="text-lg font-bold text-indigo-600">{inr(closingBalance)}</p>
          </div>
        </div>
      </div>

      {/* Search Input & Date Filters */}
      <div className="p-4 mb-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search shop no / name…"
            className="w-full rounded-xl bg-slate-50 border border-slate-200 py-2.5 pl-10 pr-4 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="rounded-xl bg-slate-50 border border-slate-200 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="rounded-xl bg-slate-50 border border-slate-200 py-2.5 px-3 text-sm text-slate-800 outline-none focus:border-cyan-500"
          />
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 font-medium">
              <tr>
                <th className="p-3">Date</th>
                <th className="p-3">Shop No</th>
                <th className="p-3">Name</th>
                <th className="p-3">Location</th>
                <th className="p-3 text-right">Purchase (GST)</th>
                <th className="p-3 text-right">Invoiced (GST)</th>
                <th className="p-3 text-right">Paid</th>
                <th className="p-3 text-right">Outstanding</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-400 text-xs">
                    No shops or collection data found.
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => {
                  const shopOut = Math.max(
                    0,
                    Number(r.purchase_amount || 0) +
                      Number(r.invoiced || 0) -
                      Number(r.paid || 0)
                  );
                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 text-slate-500">
                        {r.date || r.created_at || r.invoice_date || "-"}
                      </td>
                      <td className="p-3 font-semibold text-cyan-700">
                        {r.shop_no || "-"}
                      </td>
                      <td className="p-3 font-medium text-slate-800">
                        {r.name || "-"}
                      </td>
                      <td className="p-3 text-slate-500">{r.location || "-"}</td>
                      <td className="p-3 text-right font-semibold text-slate-800">
                        {inr(r.purchase_amount || 0)}
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {inr(r.invoiced || 0)}
                      </td>
                      <td className="p-3 text-right font-medium text-emerald-600">
                        {inr(r.paid || 0)}
                      </td>
                      <td className="p-3 text-right font-semibold text-rose-600">
                        {inr(shopOut)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 text-slate-600"
            >
              Previous
            </button>
            <span className="text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border bg-white disabled:opacity-50 text-slate-600"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}