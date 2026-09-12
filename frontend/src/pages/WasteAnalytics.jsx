import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { exportToCsv } from "@/lib/helpers";
import { Scale, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from "recharts";

export default function WasteAnalytics() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/analytics/waste").then((r) => setData(r.data)); }, []);

  const byShop = (data?.by_shop || []).slice(0, 10);
  const byMonth = data?.by_month || [];
  const byTypeMonth = data?.by_type_month || [];
  const totalWaste = (data?.by_shop || []).reduce((s, r) => s + r.waste, 0);
  const totalBoxes = (data?.by_shop || []).reduce((s, r) => s + r.boxes, 0);

  const doExport = () => exportToCsv("waste-by-shop.csv", data?.by_shop || [], [
    { label: "Shop", accessor: "shop" }, { label: "Boxes", accessor: "boxes" }, { label: "Waste (kg)", accessor: "waste" },
  ]);

  return (
    <div>
      <PageHeader title="Waste Analytics" subtitle="Cotton box waste generated across shops (qty ÷ 12 kg)" icon={Scale}>
        <button data-testid="export-waste-button" onClick={doExport} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <Download className="h-4 w-4" /> Export
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs uppercase tracking-widest text-slate-500 font-mono">Total Boxes</p><p className="font-display text-3xl font-bold mt-2">{totalBoxes.toLocaleString("en-IN")}</p></Card>
        <Card className="p-5 border-emerald-500/20"><p className="text-xs uppercase tracking-widest text-slate-500 font-mono">Total Waste</p><p className="font-display text-3xl font-bold text-emerald-300 mt-2">{totalWaste.toFixed(2)} kg</p></Card>
      </div>

      <Card className="p-5 mb-6">
        <h2 className="font-display text-lg font-semibold mb-4">Top 10 Shops by Waste</h2>
        <div style={{ width: "100%", height: 320 }} data-testid="waste-shop-chart">
          <ResponsiveContainer>
            <BarChart data={byShop} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="shop" tick={{ fill: "#64748b", fontSize: 10 }} angle={-25} textAnchor="end" height={70} interval={0} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a" }} />
              <Bar dataKey="waste" fill="#10b981" radius={[6, 6, 0, 0]} name="Waste (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold mb-4">Monthly Waste Trend</h2>
        <div style={{ width: "100%", height: 280 }} data-testid="waste-month-chart">
          <ResponsiveContainer>
            <LineChart data={byMonth} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a" }} />
              <Line type="monotone" dataKey="waste" stroke="#06b6d4" strokeWidth={2.5} dot={{ fill: "#06b6d4" }} name="Waste (kg)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="p-5 mt-6">
        <h2 className="font-display text-lg font-semibold mb-4">Beer vs Brandy Box Waste by Month</h2>
        <div style={{ width: "100%", height: 300 }} data-testid="waste-type-chart">
          <ResponsiveContainer>
            <BarChart data={byTypeMonth} margin={{ left: -10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="month" tick={{ fill: "#64748b", fontSize: 11 }} />
              <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a" }} />
              <Legend />
              <Bar dataKey="beer" fill="#06b6d4" radius={[6, 6, 0, 0]} name="Beer Box Waste (kg)" />
              <Bar dataKey="brandy" fill="#f59e0b" radius={[6, 6, 0, 0]} name="Brandy Box Waste (kg)" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
