import React, { useEffect, useState, useMemo } from "react";
import { Coins, Download, Search, IndianRupee, Calendar, Printer } from "lucide-react";
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
  const [selectedDate, setSelectedDate] = useState("");

  useEffect(() => {
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

  const totalCottonBoxPurchases = useMemo(() => {
    return entriesData.reduce(
      (sum, e) => sum + Number(e.total_amount || e.grand_total || e.amount || 0),
      0
    );
  }, [entriesData]);

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
  
  // Net Profit = total purchase + expense - sale invoice amount (totalRevenue)
  const netProfit = totalPurchases + totalExpenses - totalRevenue;

  const closingBalance = Math.max(0, currentOpeningBalance);

  const filtered = useMemo(() => {
    let result = rowsData;

    if (selectedDate) {
      result = result.filter((r) => {
        const itemDate = r.date || r.created_at || r.invoice_date;
        if (!itemDate) return false;
        return itemDate.slice(0, 10) === selectedDate;
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
  }, [rowsData, search, selectedDate]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handlePrintA4 = () => {
    window.print();
  };

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 no-print">
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
            Tracking total sales invoice amounts with GST, purchase deductions, expenses, and net profit
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintA4}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Printer className="h-4 w-4" /> Print Summary
          </button>
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
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 no-print">
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
            <p className="text-xs text-slate-500 font-medium">Net Profit (Purch + Exp - Sale)</p>
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

      {/* Search Input & Single Date Calendar Filter */}
      <div className="p-4 mb-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 no-print">
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
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setPage(1);
              }}
              className="bg-transparent text-sm text-slate-800 outline-none cursor-pointer"
            />
          </div>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate("")}
              className="text-xs text-rose-500 hover:underline px-2"
            >
              Clear Date
            </button>
          )}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden no-print">
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
                    No shops or collection data found for this date.
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

      {/* PRINTABLE REPORT VIEW (A4 Print Layout) */}
      <div className="hidden print:block printable-report bg-white p-6">
        <div className="mb-4 pb-4 border-b border-slate-300">
          <h2 className="text-2xl font-bold text-slate-900">Auro Products - Collections & Balances Report</h2>
          <p className="text-xs text-slate-600 mt-1">
            Generated on: {new Date().toLocaleString()} {selectedDate ? `(Date Filter: ${selectedDate})` : ''}
          </p>
        </div>

        {/* Print Summary Cards */}
        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="font-semibold text-slate-500 uppercase">Opening Balance:</span>
            <div className="text-sm font-bold text-slate-900">{inr(currentOpeningBalance)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Total Revenue:</span>
            <div className="text-sm font-bold text-slate-900">{inr(totalRevenue)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Net Profit:</span>
            <div className={`text-sm font-bold ${netProfit < 0 ? "text-rose-600" : "text-slate-900"}`}>{inr(netProfit)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Closing Balance:</span>
            <div className="text-sm font-bold text-indigo-600">{inr(closingBalance)}</div>
          </div>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
              <th className="p-2">Date</th>
              <th className="p-2">Shop No</th>
              <th className="p-2">Name</th>
              <th className="p-2">Location</th>
              <th className="p-2 text-right">Purchase (GST)</th>
              <th className="p-2 text-right">Invoiced (GST)</th>
              <th className="p-2 text-right">Paid</th>
              <th className="p-2 text-right">Outstanding</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="p-4 text-center text-slate-400">
                  No records found.
                </td>
              </tr>
            ) : (
              filtered.map((r, idx) => {
                const shopOut = Math.max(
                  0,
                  Number(r.purchase_amount || 0) +
                    Number(r.invoiced || 0) -
                    Number(r.paid || 0)
                );
                return (
                  <tr key={idx}>
                    <td className="p-2 text-slate-600">{r.date || r.created_at || r.invoice_date || "-"}</td>
                    <td className="p-2 font-bold">{r.shop_no || "-"}</td>
                    <td className="p-2">{r.name || "-"}</td>
                    <td className="p-2">{r.location || "-"}</td>
                    <td className="p-2 text-right font-bold">{inr(r.purchase_amount || 0)}</td>
                    <td className="p-2 text-right">{inr(r.invoiced || 0)}</td>
                    <td className="p-2 text-right text-emerald-700">{inr(r.paid || 0)}</td>
                    <td className="p-2 text-right text-rose-700 font-bold">{inr(shopOut)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}