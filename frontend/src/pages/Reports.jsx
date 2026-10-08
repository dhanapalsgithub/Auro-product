import React, { useEffect, useState } from "react";
import api from "../lib/apiClient";
import { FileBarChart } from "lucide-react";

const inr = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Reports() {
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => {
    api
      .get("/reports/daily", { params: { day } })
      .then((r) => setDaily(r.data))
      .catch(() => setDaily(null));
  }, [day]);

  useEffect(() => {
    api
      .get("/reports/monthly", { params: { month } })
      .then((r) => setMonthly(r.data))
      .catch(() => setMonthly(null));
  }, [month]);

  const activeData = tab === "daily" ? daily : monthly;

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-100 text-cyan-700">
              <FileBarChart className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Daily & monthly summary of invoices and GST
          </p>
        </div>

        <div className="flex items-center gap-3">
          {tab === "daily" ? (
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none text-slate-700 shadow-sm focus:border-cyan-500"
            />
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none text-slate-700 shadow-sm focus:border-cyan-500"
            />
          )}

          <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-sm">
            <button
              onClick={() => setTab("daily")}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
                tab === "daily"
                  ? "bg-cyan-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => setTab("monthly")}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
                tab === "monthly"
                  ? "bg-cyan-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Purchase Invoice
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {inr(activeData?.purchase_invoice_total || 0)}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Sale Invoice
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {inr(activeData?.sale_invoice_total || 0)}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Sale GST
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {inr(activeData?.gst_collected_sales || 0)}
          </p>
        </div>
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Purchase GST
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {inr(activeData?.gst_collected_purchase || 0)}
          </p>
        </div>
      </div>
    </div>
  );
}