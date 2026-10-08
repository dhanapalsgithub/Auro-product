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
  Users,
  Edit2,
  Trash2,
  X,
  Check
} from "lucide-react";

const PAGE_SIZE = 5;
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

  const [editingExpense, setEditingExpense] = useState(null);
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

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editingExpense || !editingExpense.amount || Number(editingExpense.amount) <= 0) return;

    setLoading(true);
    const payload = {
      ...editingExpense,
      amount: parseFloat(editingExpense.amount)
    };

    // Try PUT request first, fallback to POST
    api.put(`/expenses/${editingExpense.id}`, payload)
      .catch(() => api.post(`/expenses/${editingExpense.id}`, payload))
      .then(() => {
        setEditingExpense(null);
        fetchExpenses();
      })
      .finally(() => setLoading(false));
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;

    api.delete(`/expenses/${id}`)
      .then(() => {
        fetchExpenses();
      })
      .catch((err) => {
        alert(err?.response?.data?.detail || "Failed to delete expense");
      });
  };

  const handleExportCsv = () => {
    const list = filteredExpenses;
    const csvData = list.map((exp) => ({
      ID: exp.id,
      Category: exp.category,
      Amount: exp.amount,
      Date: exp.expense_date,
      Notes: exp.notes
    }));
    exportToCsv("Expenses_Report.csv", csvData);
  };

  // Client-side date filtering fallback if server doesn't filter
  const safeExpenses = expensesData?.expenses || [];
  const filteredExpenses = useMemo(() => {
    return safeExpenses.filter((exp) => {
      const expDate = exp.expense_date ? exp.expense_date.slice(0, 10) : "";
      if (startDate && expDate < startDate) return false;
      if (endDate && expDate > endDate) return false;
      if (categoryFilter && exp.category !== categoryFilter) return false;
      return true;
    });
  }, [safeExpenses, startDate, endDate, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
  const paginatedExpenses = useMemo(() => {
    const startIdx = (page - 1) * PAGE_SIZE;
    return filteredExpenses.slice(startIdx, startIdx + PAGE_SIZE);
  }, [filteredExpenses, page]);

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
        {/* <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" /> TOTAL REVENUE
          </p>
          <p className="text-2xl font-bold mt-1 text-black">{inr(expensesData?.total_revenue || 0)}</p>
        </Card> */}

        <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-rose-400" /> TOTAL EXPENSES
          </p>
          <p className="text-2xl font-bold mt-1 text-black-300">{inr(expensesData?.total_expenses || 0)}</p>
        </Card>

        {/* <Card className="p-5">
          <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-cyan-400" /> NET PROFIT
          </p>
          <p className={`text-2xl font-bold mt-1 ${(expensesData?.net_profit || 0) >= 0 ? "text-emerald-300" : "text-rose-400"}`}>
            {inr(expensesData?.net_profit || 0)}
          </p>
        </Card> */}
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
              className="w-full bg-white/5 border border-black/10 rounded-lg p-2 text-black outline-none focus:border-cyan-500"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat} className="bg-white-900 text-black">
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
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-black outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Date</label>
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-black outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="Driver name, route, or labour details"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-black outline-none focus:border-cyan-500"
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

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 rounded">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400 text-[10px] uppercase font-mono">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                className="bg-transparent text-black outline-none cursor-pointer"
              />
              <span className="text-black-400 text-[10px] uppercase font-mono ml-1">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                className="bg-transparent text-black outline-none cursor-pointer"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
              className="bg-white/5 border border-black/10 px-2 py-1.5 rounded text-black outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">All Categories</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c} className="bg-white-900">{c}</option>
              ))}
            </select>

            {(startDate || endDate || categoryFilter) && (
              <button
                onClick={() => { setStartDate(""); setEndDate(""); setCategoryFilter(""); setPage(1); }}
                className="text-xs text-rose-400 hover:text-rose-300 underline px-1"
              >
                Clear Filters
              </button>
            )}
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
                <th className="p-3 font-mono text-center">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-500">
                    No expense records found.
                  </td>
                </tr>
              ) : (
                paginatedExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-3 whitespace-nowrap">{fmtDate(exp.expense_date)}</td>
                    <td className="p-3 font-medium whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded text-black">
                        {exp.category === "Auto Rent" && <Truck className="h-3 w-3 text-black-400" />}
                        {exp.category === "Labour Record" && <Users className="h-3 w-3 text-black-400" />}
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-3 text-black-400">{exp.notes || "—"}</td>
                    <td className="p-3 text-right font-mono font-semibold text-rose-300 whitespace-nowrap">
                      {inr(exp.amount)}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setEditingExpense({
                            ...exp,
                            expense_date: exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10)
                          })}
                          className="p-1 rounded text-slate-400 hover:text-cyan-400 hover:bg-white/10 transition"
                          title="Edit"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(exp.id)}
                          className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-white/10 transition"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex items-center justify-between p-4 border-t border-white/10 text-xs">
          <span className="text-slate-400">
            Showing {filteredExpenses.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0} to{" "}
            {Math.min(page * PAGE_SIZE, filteredExpenses.length)} of {filteredExpenses.length} entries
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-slate-300 font-mono font-semibold px-2">
              {page} / {pageCount}
            </span>
            <button
              disabled={page === pageCount}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
              className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Card>

      {/* Edit Expense Modal */}
      {editingExpense && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-md text-xs shadow-2xl relative">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-cyan-400" /> Edit Expense
              </h3>
              <button
                onClick={() => setEditingExpense(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-slate-400 mb-1">Category</label>
                <select
                  value={editingExpense.category}
                  onChange={(e) => setEditingExpense({ ...editingExpense, category: e.target.value })}
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
                  value={editingExpense.amount}
                  onChange={(e) => setEditingExpense({ ...editingExpense, amount: e.target.value })}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Date</label>
                <input
                  type="date"
                  value={editingExpense.expense_date}
                  onChange={(e) => setEditingExpense({ ...editingExpense, expense_date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes / Description</label>
                <input
                  type="text"
                  value={editingExpense.notes || ""}
                  onChange={(e) => setEditingExpense({ ...editingExpense, notes: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingExpense(null)}
                  className="px-3 py-1.5 border border-white/10 rounded-lg text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-1.5 bg-cyan-500 text-slate-950 font-semibold px-4 py-1.5 rounded-lg hover:bg-cyan-400 transition"
                >
                  <Check className="h-4 w-4" />
                  {loading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}