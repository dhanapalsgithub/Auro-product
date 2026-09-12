import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { FileBarChart, Download, Package, Scale, Receipt, IndianRupee } from "lucide-react";
import { downloadElementPdf } from "@/lib/pdf";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Reports() {
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);

  useEffect(() => { api.get("/reports/daily", { params: { day } }).then((r) => setDaily(r.data)); }, [day]);
  useEffect(() => { api.get("/reports/monthly", { params: { month } }).then((r) => setMonthly(r.data)); }, [month]);

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500 font-mono">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></div></div></Card>
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily & monthly summary of boxes, invoices and collections" icon={FileBarChart}>
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button data-testid="tab-daily" onClick={() => setTab("daily")} className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === "daily" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Daily</button>
          <button data-testid="tab-monthly" onClick={() => setTab("monthly")} className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === "monthly" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Monthly</button>
        </div>
      </PageHeader>

      {tab === "daily" && daily && (
        <div data-testid="daily-report">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-slate-400">Date</label>
            <input data-testid="report-day-input" type="date" value={day} onChange={(e) => setDay(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
            <button data-testid="export-daily-button" onClick={() => exportToCsv(`daily-${day}.csv`, [{ ...daily }], [{ label: "Day", accessor: "day" }, { label: "Boxes", accessor: "boxes" }, { label: "Waste", accessor: "waste_kg" }, { label: "Invoices", accessor: "invoice_count" }, { label: "Invoiced", accessor: "invoice_total" }, { label: "Collections", accessor: "collections" }])} className="ml-auto flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"><Download className="h-4 w-4" /> Export</button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat icon={Package} label="Boxes" value={daily.boxes.toLocaleString("en-IN")} accent="bg-cyan-500/15 text-cyan-300" />
            <Stat icon={Scale} label="Waste (kg)" value={daily.waste_kg} accent="bg-emerald-500/15 text-emerald-300" />
            <Stat icon={Receipt} label="Invoiced" value={inr(daily.invoice_total)} accent="bg-blue-500/15 text-blue-300" />
            <Stat icon={IndianRupee} label="Collections" value={inr(daily.collections)} accent="bg-amber-500/15 text-amber-300" />
          </div>
          <Card className="overflow-hidden">
            <div className="p-5 border-b border-white/10"><h2 className="font-display text-lg font-semibold">Invoices on {fmtDate(daily.day)}</h2></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-white/10 text-left text-xs uppercase tracking-wider text-slate-500 font-mono"><th className="p-4">Invoice</th><th className="p-4">Shop</th><th className="p-4 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-white/5">
                {daily.invoices.map((i) => <tr key={i.id} className="hover:bg-white/5"><td className="p-4 font-mono text-cyan-300">{i.invoice_no}</td><td className="p-4">{i.shop_no} · {i.shop_name}</td><td className="p-4 text-right font-mono">{inr(i.grand_total)}</td></tr>)}
                {daily.invoices.length === 0 && <tr><td colSpan={3} className="p-6 text-center text-slate-500">No invoices this day.</td></tr>}
              </tbody></table></div>
          </Card>
        </div>
      )}

      {tab === "monthly" && monthly && (
        <div data-testid="monthly-report" id="monthly-report-sheet">
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm text-slate-400">Month</label>
            <input data-testid="report-month-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
            <div className="ml-auto flex items-center gap-2">
              <button data-testid="download-monthly-pdf" onClick={() => downloadElementPdf("monthly-report-sheet", `monthly-report-${month}.pdf`, "#090d16")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"><Download className="h-4 w-4" /> PDF</button>
              <button data-testid="export-monthly-button" onClick={() => exportToCsv(`monthly-${month}.csv`, monthly.daily, [{ label: "Date", accessor: "date" }, { label: "Boxes", accessor: "boxes" }, { label: "Waste", accessor: "waste" }, { label: "Invoiced", accessor: "invoiced" }, { label: "Collected", accessor: "collected" }])} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition"><Download className="h-4 w-4" /> CSV</button>
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            <Stat icon={Package} label="Boxes" value={monthly.total_boxes.toLocaleString("en-IN")} accent="bg-cyan-500/15 text-cyan-300" />
            <Stat icon={Scale} label="Waste (kg)" value={monthly.total_waste} accent="bg-emerald-500/15 text-emerald-300" />
            <Stat icon={Receipt} label="Invoiced" value={inr(monthly.total_invoiced)} accent="bg-blue-500/15 text-blue-300" />
            <Stat icon={IndianRupee} label="Collected" value={inr(monthly.total_collected)} accent="bg-amber-500/15 text-amber-300" />
            <Stat icon={IndianRupee} label="Outstanding" value={inr(monthly.outstanding)} accent="bg-red-500/15 text-red-300" />
          </div>
          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold mb-4">Daily Breakdown — {month}</h2>
            <div style={{ width: "100%", height: 300 }} data-testid="monthly-chart">
              <ResponsiveContainer>
                <BarChart data={monthly.daily} margin={{ left: -10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 12, color: "#fff" }} />
                  <Bar dataKey="invoiced" fill="#06b6d4" radius={[6, 6, 0, 0]} name="Invoiced (₹)" />
                  <Bar dataKey="collected" fill="#10b981" radius={[6, 6, 0, 0]} name="Collected (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
