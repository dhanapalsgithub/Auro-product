import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/apiClient";
import { Scale, Download, Search } from "lucide-react";

const PAGE_SIZE = 10;

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

export default function WasteAnalytics() {
  const [data, setData] = useState({ breakdown: [], total_boxes: 0, total_waste_kg: 0 });
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { 
    api.get("/analytics/waste")
      .then((r) => setData(r.data))
      .catch(() => {}); 
  }, []);

  const shopList = data?.breakdown || data?.by_shop || [];

  // Filter and Search logic
  const filteredShops = useMemo(() => {
    let result = shopList;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (shop) =>
          (shop.shop_no && String(shop.shop_no).toLowerCase().includes(q)) ||
          (shop.shop_name && String(shop.shop_name).toLowerCase().includes(q))
      );
    }

    return result;
  }, [shopList, search]);

  const totalBoxes = Number(data?.total_boxes || filteredShops.reduce((s, r) => s + (Number(r.total_boxes || r.boxes) || 0), 0));
  const totalWaste = Number(data?.total_waste_kg || filteredShops.reduce((s, r) => s + (Number(r.total_waste_kg || r.waste) || 0), 0));

  const totalPages = Math.ceil(filteredShops.length / PAGE_SIZE) || 1;
  const paginatedShops = filteredShops.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-cyan-100 text-cyan-700">
            <Scale className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Waste Analytics
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Cotton box waste generated across shops
            </p>
          </div>
        </div>

        <button
          onClick={() =>
            exportToCsv("waste_analytics.csv", filteredShops, [
              { label: "Shop No", accessor: "shop_no" },
              { label: "Shop Name", accessor: "shop_name" },
              { label: "Total Boxes", accessor: "total_boxes" },
              { label: "Total Waste (Kg)", accessor: "total_waste_kg" },
            ])
          }
          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100 transition shadow-sm"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Total Boxes
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {totalBoxes.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Total Waste
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {totalWaste.toFixed(2)} kg
          </p>
        </div>
      </div>

      {/* Search & Date Filters */}
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

      {/* Breakdown List & Pagination */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-semibold text-sm text-slate-800 bg-slate-50">
          Waste Breakdown by Shop
        </div>

        <div className="divide-y divide-slate-100">
          {paginatedShops.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No waste data recorded.
            </div>
          ) : (
            paginatedShops.map((shop, idx) => (
              <div
                key={shop.shop_id || idx}
                className="flex items-center justify-between p-4 hover:bg-slate-50 text-sm transition"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {shop.shop_no || "—"} · {shop.shop_name || "—"}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {shop.total_boxes || shop.boxes || 0} boxes collected
                  </p>
                </div>
                <div className="text-right font-semibold text-emerald-600">
                  {Number(shop.total_waste_kg || shop.waste || 0).toFixed(2)} kg
                </div>
              </div>
            ))
          )}
        </div>

        {filteredShops.length > PAGE_SIZE && (
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