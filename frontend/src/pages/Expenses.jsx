import React, { useEffect, useState, useMemo } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import {
  Wallet,
  PlusCircle,
  Download,
  Calendar,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Truck,
  Users
} from "lucide-react";

const PAGE_SIZE = 10;
const CATEGORIES = ["Auto Rent", "Labour Record", "Raw Material", "Maintenance", "Misc"];

export default function Expenses() {
  const [expensesData, setExpensesData] = useState({
    expenses: [],
    total_revenue: 0,
    total_expenses: 0,
    net_profit: 0
  });

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [form, setForm] = useState({
    category: "Auto Rent",
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: ""
  });

  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);

  const fetchExpenses = () => {
    api.get("/expenses", {
      params: {
        start: startDate || undefined,
        end: endDate || undefined,
        category: categoryFilter || undefined
      }
    })
    .then((res) => {
      if (res.data && Array.isArray(res.data.expenses)) {
        setExpensesData(res.data);
      } else if (Array.isArray(res.data)) {
        setExpensesData({
          expenses: res.data,
          total_revenue: 0,
          total_expenses: res.data.reduce((sum, e) => sum + (e.amount || 0), 0),
          net_profit: 0
        });
      }
    })
    .catch(() => {});
  };

  useEffect(() => {
    fetchExpenses();
  }, [startDate, endDate, categoryFilter]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || Number(form.amount) <= 0) return;

    setLoading(true);
    api.post("/expenses", {
      ...form,
      amount: parseFloat(form.amount)
    })
    .then(() => {
      setForm({
        category: "Auto Rent",
        amount: "",
        expense_date: new Date().toISOString().slice(0, 10),
        notes: ""
      });
      fetchExpenses();
    })
    .finally(() => setLoading(false));
  };

  const handleExportCsv = () => {
    const list = expensesData?.expenses || [];
    const csvData = list.map((exp) => ({
      ID: exp.id,
      Category: exp.category,
      Amount: exp.amount,
      Date: exp.expense_date,
      Notes: exp.notes
    }));
    exportToCsv("Expenses_Report.csv", csvData);
  };

  const safeExpenses = expensesData?.expenses || [];
  const pageCount = Math.max(1, Math.ceil(safeExpenses.length / PAGE_SIZE));
  const paginatedExpenses = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return safeExpenses.slice(startIdx, startIdx + PAGE_SIZE);
  }, [safeExpenses, page]);

  return (
    <div>
      <PageHeader title="Expenses & Labour Records" subtitle="Track Auto Rent, Labour Costs, and view Net Profit calculations" icon={Wallet}>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-500/30 transition"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </PageHeader>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> TOTAL REVENUE
          </p>
          <p className="text-2xl font-bold mt-1 text-white">{inr(expensesData?.total_revenue || 0)}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" /> TOTAL EXPENSES
          </p>
          <p className="text-2xl font-bold mt-1 text-rose-300">{inr(expensesData?.total_expenses || 0)}</p>
        </Card>

        <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-cyan-400" /> NET PROFIT
          </p>
          <p className={`text-2xl font-bold mt-1 ${(expensesData?.net_profit || 0) >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
            {inr(expensesData?.net_profit || 0)}
          </p>
        </Card>
      </div>

      <Card className="p-5 mb-6">
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <PlusCircle className="h-4 w-4 text-cyan-400" /> Record New Expense / Labour Payment
        </h3>
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-slate-900 text-white">
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Amount (₹)</label>
            <input
              type="number"
              step="0.01"
              placeholder="e.g. 500"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="Driver name, route, or labour details"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
            />
          </div>

          <div className="md:col-span-4 flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="bg-cyan-500 text-slate-950 font-semibold px-4 py-2 rounded-lg hover:bg-cyan-400 transition"
            >
              {loading ? "Saving..." : "Add Expense Record"}
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between p-4 border-b border-white/10 gap-3">
          <h3 className="font-semibold text-sm">Expense Logs</h3>

          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white outline-none"
            />
            <span className="text-slate-500">to</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white outline-none"
            />

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="bg-white/5 border border-white/10 px-2 py-1 rounded text-white outline-none"
            >
              <option value="" className="bg-slate-900">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-white/5 text-slate-400 border-b border-white/10">
              <tr>
                <th className="p-3 font-mono">DATE</th>
                <th className="p-3 font-mono">CATEGORY</th>
                <th className="p-3 font-mono">NOTES</th>
                <th className="p-3 font-mono text-right">AMOUNT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-500">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-white/5">
                    <td className="p-3">{fmtDate(exp.expense_date)}</td>
                    <td className="p-3 font-medium">
                      <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-white">
                        {exp.category === "Auto Rent" && <Truck className="h-3 w-3 text-amber-400" />}
                        {exp.category === "Labour Record" && <Users className="h-3 w-3 text-cyan-400" />}
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 text-slate-400">{exp.notes || "—"}</td>
                    <td className="p-3 text-right font-mono font-semibold text-rose-300">
                      {inr(exp.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/10 text-xs">
            <span className="text-slate-400">Page {page} of {pageCount}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                disabled={page === pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}