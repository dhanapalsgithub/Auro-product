import React, { useEffect, useMemo, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import Pager from "@/components/Pager";
import { exportToCsv, fmtDate } from "@/lib/helpers";
import { Boxes, Package, Scale, Store, Download, Search, X } from "lucide-react";

const PAGE_SIZE = 10;

export default function Inventory() {
  const [data, setData] = useState(null);
  const [entries, setEntries] = useState([]);
  const [shops, setShops] = useState([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [filterTab, setFilterTab] = useState("all"); // "all" | "active" | "inactive"
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const safeExtractArray = (res) => {
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data?.rows)) return res.data.rows;
    if (Array.isArray(res)) return res;
    return [];
  };

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [invRes, entriesRes, shopsRes] = await Promise.allSettled([
          api.get("/inventory"),
          api.get("/entries"),
          api.get("/shops"),
        ]);

        if (invRes.status === "fulfilled" && invRes.value?.data) {
          setData(invRes.value.data);
        }

        if (entriesRes.status === "fulfilled") {
          setEntries(safeExtractArray(entriesRes.value));
        }

        if (shopsRes.status === "fulfilled") {
          setShops(safeExtractArray(shopsRes.value));
        }
      } catch (err) {
        console.error("Failed to load inventory data:", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // Compute records for ALL registered shops regardless of entry status
  const computedRows = useMemo(() => {
    const safeShops = Array.isArray(shops) ? shops : [];
    const safeEntries = Array.isArray(entries) ? entries : [];

    // Filter entries by date range if provided
    const filteredEntries = safeEntries.filter((entry) => {
      if (!entry) return false;
      const entryDateStr = entry.entry_date || entry.created_at;
      if (!entryDateStr) return true;

      const entryDate = new Date(entryDateStr).getTime();
      const start = startDate ? new Date(startDate).setHours(0, 0, 0, 0) : null;
      const end = endDate ? new Date(endDate).setHours(23, 59, 59, 999) : null;

      if (start && entryDate < start) return false;
      if (end && entryDate > end) return false;

      return true;
    });

    // Aggregate entries by shop_id
    const entryStatsMap = {};
    filteredEntries.forEach((entry) => {
      const sId = entry.shop_id;
      if (!sId) return;

      const brandyQty = Number(entry.brandy_qty || 0);
      const beerQty = Number(entry.beer_qty || 0);
      const boxes = brandyQty + beerQty || Number(entry.quantity || entry.boxes || 0);
      const waste = Number(entry.waste_kg || entry.waste || 0);
      const entryDate = entry.entry_date || entry.created_at;

      if (!entryStatsMap[sId]) {
        entryStatsMap[sId] = {
          total_boxes: 0,
          total_waste: 0,
          entries: 0,
          last_entry: entryDate,
        };
      }

      entryStatsMap[sId].total_boxes += boxes;
      entryStatsMap[sId].total_waste += waste;
      entryStatsMap[sId].entries += 1;

      if (new Date(entryDate) > new Date(entryStatsMap[sId].last_entry)) {
        entryStatsMap[sId].last_entry = entryDate;
      }
    });

    // Map over ALL registered shops to ensure 0-entry shops are displayed
    return safeShops.map((shop) => {
      const stats = entryStatsMap[shop.id] || {
        total_boxes: 0,
        total_waste: 0,
        entries: 0,
        last_entry: null,
      };

      return {
        shop_id: shop.id,
        shop_no: shop.shop_no || `Shop #${shop.id}`,
        name: shop.name || "Unknown Shop",
        location: shop.location || shop.district || "—",
        total_boxes: stats.total_boxes,
        total_waste: stats.total_waste,
        entries: stats.entries,
        last_entry: stats.last_entry,
      };
    });
  }, [shops, entries, startDate, endDate]);

  // Apply Search & Tab Filters
  const filtered = useMemo(() => {
    let result = computedRows;

    if (filterTab === "active") {
      result = result.filter((r) => r.entries > 0);
    } else if (filterTab === "inactive") {
      result = result.filter((r) => r.entries === 0);
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

    return result;
  }, [computedRows, search, filterTab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalShopsCount = computedRows.length;
  const activeShopsCount = useMemo(
    () => computedRows.filter((r) => r.entries > 0).length,
    [computedRows]
  );
  const inactiveShopsCount = totalShopsCount - activeShopsCount;

  const totalBoxes = useMemo(() => {
    const entryBoxes = computedRows.reduce((sum, r) => sum + Number(r.total_boxes || 0), 0);
    return data?.total_boxes ?? entryBoxes;
  }, [computedRows, data]);

  const totalWaste = useMemo(() => {
    return computedRows.reduce((sum, r) => sum + Number(r.total_waste || 0), 0);
  }, [computedRows]);

  const doExport = () =>
    exportToCsv("inventory.csv", filtered, [
      { label: "Shop No", accessor: "shop_no" },
      { label: "Name", accessor: "name" },
      { label: "Location", accessor: "location" },
      { label: "Total Boxes", accessor: "total_boxes" },
      {
        label: "Total Waste (kg)",
        accessor: (r) => Number(r.total_waste || 0).toFixed(2),
      },
      { label: "Entries", accessor: "entries" },
      { label: "Last Entry", accessor: (r) => (r.last_entry ? fmtDate(r.last_entry) : "No Entries") },
    ]);

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-mono">
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Inventory Dashboard"
        subtitle="Cotton boxes supplied & waste generated per shop"
        icon={Boxes}
      >
        <button
          data-testid="export-inventory-button"
          onClick={doExport}
          className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"
        >
          <Download className="h-4 w-4" /> Export
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Stat
          icon={Package}
          label="Total Boxes Purchased"
          value={Number(totalBoxes).toLocaleString("en-IN")}
          accent="bg-cyan-500/15 text-cyan-300"
        />
        <Stat
          icon={Scale}
          label="Total Waste (kg)"
          value={`${Number(totalWaste).toFixed(2)} kg`}
          accent="bg-emerald-500/15 text-emerald-300"
        />
        <Stat
          icon={Store}
          label="Active / Total Shops"
          value={`${activeShopsCount} / ${totalShopsCount}`}
          accent="bg-amber-500/15 text-amber-300"
        />
      </div>

      <Card className="p-4 mb-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Tab Selection */}
          <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 border border-white/10 w-full md:w-auto">
            <button
              onClick={() => {
                setFilterTab("all");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTab === "all"
                  ? "bg-cyan-500 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              All Shops ({totalShopsCount})
            </button>
            <button
              onClick={() => {
                setFilterTab("active");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTab === "active"
                  ? "bg-emerald-500 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Active ({activeShopsCount})
            </button>
            <button
              onClick={() => {
                setFilterTab("inactive");
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filterTab === "inactive"
                  ? "bg-rose-500 text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              No Entries ({inactiveShopsCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              data-testid="inventory-search-input"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search shop by no or location…"
              className="w-full rounded-xl bg-white/5 border border-white/10 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/50"
            />
          </div>

          {/* Date Range Inputs */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm w-full sm:w-auto">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-200 outline-none text-xs sm:text-sm"
              />
              <span className="text-slate-500">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="bg-transparent text-slate-200 outline-none text-xs sm:text-sm"
              />
            </div>

            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setPage(1);
                }}
                className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-white/10 transition"
                title="Clear Date Filter"
              >
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="inventory-table">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono">
                <th className="p-4">Shop</th>
                <th className="p-4">Location</th>
                <th className="p-4 text-right">Boxes</th>
                <th className="p-4 text-right">Waste (kg)</th>
                <th className="p-4 text-center">Entries</th>
                <th className="p-4">Last Entry</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    Loading inventory records...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    No shops found matching the selected filters.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.shop_id || r.shop_no}
                    data-testid={`inventory-row-${r.shop_no}`}
                    className="hover:bg-white/5 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-mono text-cyan-300">{r.shop_no}</span>
                      <div className="text-xs text-slate-500">{r.name}</div>
                    </td>
                    <td className="p-4 text-slate-400">{r.location || "—"}</td>
                    <td className="p-4 text-right font-mono">
                      {Number(r.total_boxes || 0).toLocaleString("en-IN")}
                    </td>
                    <td className="p-4 text-right font-mono text-emerald-300">
                      {Number(r.total_waste || 0).toFixed(2)}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${
                          r.entries > 0
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-slate-500/10 text-slate-400"
                        }`}
                      >
                        {r.entries}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400 font-mono">
                      {r.last_entry ? fmtDate(r.last_entry) : <span className="text-slate-600">No entry</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <Pager
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            onPage={setPage}
            testid="inventory-pager"
          />
        </div>
      </Card>
    </div>
  );
}