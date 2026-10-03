import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr } from "@/lib/helpers";
import { FileBarChart } from "lucide-react";

export default function Reports() {
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => {
    api.get("/reports/daily", { params: { day } })
      .then((r) => setDaily(r.data))
      .catch(() => setDaily(null));
  }, [day]);

  useEffect(() => {
    api.get("/reports/monthly", { params: { month } })
      .then((r) => setMonthly(r.data))
      .catch(() => setMonthly(null));
  }, [month]);

  const activeData = tab === "daily" ? daily : monthly;

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily & monthly summary of invoices and GST" icon={FileBarChart}>
        <div className="flex items-center gap-3">
          {tab === "daily" ? (
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="bg-white/5 border border-white/10 text-xs px-2 py-1 rounded outline-none text-white"
            />
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="bg-white/5 border border-white/10 text-xs px-2 py-1 rounded outline-none text-white"
            />
          )}

          <div className="flex gap-1 border border-white/10 rounded-xl p-1 bg-white/5">
            <button
              onClick={() => setTab("daily")}
              className={`px-3 py-1 text-xs rounded-lg transition ${tab === "daily" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400"}`}
            >
              Daily
            </button>
            <button
              onClick={() => setTab("monthly")}
              className={`px-3 py-1 text-xs rounded-lg transition ${tab === "monthly" ? "bg-cyan-500/20 text-cyan-300 font-semibold" : "text-slate-400"}`}
            >
              Monthly
            </button>
          </div>
        </div>
      </PageHeader>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-xs text-slate-500 font-mono">PURCHASE INVOICE</p>
          <p className="text-xl font-bold mt-1">{inr(activeData?.purchase_invoice_total || 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 font-mono">SALE INVOICE</p>
          <p className="text-xl font-bold mt-1">{inr(activeData?.sale_invoice_total || 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 font-mono">SALE GST</p>
          <p className="text-xl font-bold mt-1">{inr(activeData?.gst_collected_sales || 0)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-slate-500 font-mono">PURCHASE GST</p>
          <p className="text-xl font-bold mt-1">{inr(activeData?.gst_collected_purchase || 0)}</p>
        </Card>
      </div>
    </div>
  );
}