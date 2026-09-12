import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr, fmtDate, exportToCsv } from "@/lib/helpers";
import { FileBarChart, Download, Package, Scale, Receipt, IndianRupee, BookOpen } from "lucide-react";
import { downloadElementPdf } from "@/lib/pdf";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export default function Reports() {
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [daily, setDaily] = useState(null);
  const [monthly, setMonthly] = useState(null);
  const [shops, setShops] = useState([]);
  const [stShop, setStShop] = useState("");
  const [stStart, setStStart] = useState(new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10));
  const [stEnd, setStEnd] = useState(new Date().toISOString().slice(0, 10));
  const [statement, setStatement] = useState(null);

  useEffect(() => { api.get("/reports/daily", { params: { day } }).then((r) => setDaily(r.data)); }, [day]);
  useEffect(() => { api.get("/reports/monthly", { params: { month } }).then((r) => setMonthly(r.data)); }, [month]);
  useEffect(() => { api.get("/shops").then((r) => setShops(r.data)); }, []);
  useEffect(() => {
    if (stShop) api.get(`/statement/${stShop}`, { params: { start: stStart, end: stEnd } }).then((r) => setStatement(r.data));
    else setStatement(null);
  }, [stShop, stStart, stEnd]);

  const Stat = ({ icon: Icon, label, value, accent }) => (
    <Card className="p-5"><div className="flex items-center justify-between"><div><p className="text-xs uppercase tracking-widest text-slate-500 font-mono">{label}</p><p className="mt-2 font-display text-2xl font-bold">{value}</p></div><div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}><Icon className="h-5 w-5" /></div></div></Card>
  );

  return (
    <div>
      <PageHeader title="Reports" subtitle="Daily & monthly summary of boxes, invoices and collections" icon={FileBarChart}>
        <div className="flex rounded-xl border border-white/10 bg-white/5 p-1">
          <button data-testid="tab-daily" onClick={() => setTab("daily")} className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === "daily" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Daily</button>
          <button data-testid="tab-monthly" onClick={() => setTab("monthly")} className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === "monthly" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Monthly</button>
          <button data-testid="tab-statement" onClick={() => setTab("statement")} className={`px-4 py-1.5 rounded-lg text-sm transition ${tab === "statement" ? "bg-cyan-500/20 text-cyan-300" : "text-slate-400"}`}>Statement</button>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 10 }} tickFormatter={(d) => d.slice(8)} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12, color: "#0f172a" }} />
                  <Bar dataKey="invoiced" fill="#06b6d4" radius={[6, 6, 0, 0]} name="Invoiced (₹)" />
                  <Bar dataKey="collected" fill="#10b981" radius={[6, 6, 0, 0]} name="Collected (₹)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      )}

      {tab === "statement" && (
        <div data-testid="statement-report">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <select data-testid="statement-shop-select" value={stShop} onChange={(e) => setStShop(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50 min-w-[220px]">
              <option value="">Select shop…</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.shop_no} · {s.name}</option>)}
            </select>
            <input data-testid="statement-start" type="date" value={stStart} onChange={(e) => setStStart(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
            <span className="text-slate-500 text-sm">to</span>
            <input data-testid="statement-end" type="date" value={stEnd} onChange={(e) => setStEnd(e.target.value)} className="rounded-xl bg-white/5 border border-white/10 py-2 px-3 text-sm outline-none focus:border-cyan-500/50" />
            {statement && <button data-testid="download-statement-pdf" onClick={() => downloadElementPdf("statement-sheet", `statement-${statement.shop.shop_no}-${stStart}_to_${stEnd}.pdf`, "#ffffff")} className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-4 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition"><Download className="h-4 w-4" /> Download PDF</button>}
          </div>

          {!statement && <Card className="p-10 text-center text-slate-500"><BookOpen className="h-6 w-6 mx-auto mb-2 text-slate-400" />Select a shop to generate its account statement.</Card>}

          {statement && (
            <Card className="p-0 overflow-hidden">
              <div id="statement-sheet" className="bg-white text-slate-900 p-8">
                <div className="flex items-start justify-between border-b border-slate-200 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <img src="/ri-logo.png" alt="logo" className="h-12 w-12 object-cover rounded-full" />
                    <div>
                      <h2 className="text-lg font-bold">{statement.seller.name}</h2>
                      <p className="text-[11px] text-slate-600">{statement.seller.address}</p>
                      <p className="text-[11px] text-slate-600">GSTIN: {statement.seller.gstin}</p>
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-sm font-semibold">ACCOUNT STATEMENT</p>
                    <p className="text-slate-600 mt-1">{statement.shop.shop_no} · {statement.shop.name}</p>
                    <p className="text-slate-600">{statement.shop.location}</p>
                    <p className="text-slate-600 mt-1">{fmtDate(statement.start)} — {fmtDate(statement.end)}</p>
                  </div>
                </div>
                <table className="w-full text-sm border border-slate-300" data-testid="statement-table">
                  <thead>
                    <tr className="bg-slate-100 text-left">
                      <th className="p-2 border border-slate-300">Date</th><th className="p-2 border border-slate-300">Particulars</th>
                      <th className="p-2 border border-slate-300 text-right">Debit</th><th className="p-2 border border-slate-300 text-right">Credit</th><th className="p-2 border border-slate-300 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td className="p-2 border border-slate-300 text-slate-500" colSpan={4}>Opening Balance (as of {fmtDate(statement.start)})</td><td className="p-2 border border-slate-300 text-right font-mono">{inr(statement.opening_balance)}</td></tr>
                    {statement.rows.map((r, i) => (
                      <tr key={i}>
                        <td className="p-2 border border-slate-300 font-mono">{fmtDate(r.date)}</td>
                        <td className="p-2 border border-slate-300">{r.particulars}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono">{r.debit ? Number(r.debit).toFixed(2) : "—"}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono">{r.credit ? Number(r.credit).toFixed(2) : "—"}</td>
                        <td className="p-2 border border-slate-300 text-right font-mono">{Number(r.balance).toFixed(2)}</td>
                      </tr>
                    ))}
                    {statement.rows.length === 0 && <tr><td className="p-3 border border-slate-300 text-center text-slate-500" colSpan={5}>No transactions in this period.</td></tr>}
                    <tr className="font-semibold bg-slate-50">
                      <td className="p-2 border border-slate-300 text-right" colSpan={2}>Totals</td>
                      <td className="p-2 border border-slate-300 text-right font-mono">{statement.total_debit.toFixed(2)}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono">{statement.total_credit.toFixed(2)}</td>
                      <td className="p-2 border border-slate-300 text-right font-mono" data-testid="statement-closing">{statement.closing_balance.toFixed(2)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-right text-sm font-bold mt-3">Closing Balance Due: ₹ {statement.closing_balance.toFixed(2)}</p>
                <p className="text-center text-[10px] text-slate-500 mt-4">Computer-generated statement · Built by R I Billing Pro</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
