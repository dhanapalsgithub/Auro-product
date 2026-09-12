import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr, fmtDate } from "@/lib/helpers";
import {
  LayoutDashboard, Store, Package, Scale, IndianRupee, Receipt,
  AlertTriangle, Clock, CheckCircle2, ArrowUpRight,
} from "lucide-react";

const STATUS = {
  overdue: { label: "Overdue", cls: "bg-red-500/15 text-red-300 border-red-500/30", dot: "bg-red-400" },
  due_today: { label: "Due Today", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  no_entry: { label: "No Entry Yet", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", dot: "bg-slate-400" },
  upcoming: { label: "Upcoming", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
};

function Stat({ icon: Icon, label, value, accent }) {
  return (
    <Card className="p-5 transition-all duration-300 hover:-translate-y-1" data-testid={`stat-${label.toLowerCase().replace(/\s/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500 font-mono">{label}</p>
          <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const [data, setData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).catch(() => {});
  }, []);

  const stats = data?.stats;
  const reminders = data?.reminders || [];
  const dueList = reminders.filter((r) => ["overdue", "due_today", "no_entry"].includes(r.status));

  return (
    <div>
      <PageHeader
        title="Dashboard & Reminders"
        subtitle="Cotton box pickup schedule across 149 TASMAC wine shops"
        icon={LayoutDashboard}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={Store} label="Total Shops" value={stats?.total_shops ?? "—"} accent="bg-cyan-500/15 text-cyan-300" />
        <Stat icon={Package} label="Total Boxes" value={stats ? stats.total_boxes.toLocaleString("en-IN") : "—"} accent="bg-blue-500/15 text-blue-300" />
        <Stat icon={Scale} label="Total Waste (kg)" value={stats ? stats.total_waste_kg.toLocaleString("en-IN") : "—"} accent="bg-emerald-500/15 text-emerald-300" />
        <Stat icon={IndianRupee} label="Revenue" value={stats ? inr(stats.total_revenue) : "—"} accent="bg-amber-500/15 text-amber-300" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="p-5 border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-300"><AlertTriangle className="h-5 w-5" /></div>
            <div><p className="text-3xl font-display font-bold text-red-300">{stats?.overdue ?? 0}</p><p className="text-xs text-slate-400">Overdue pickups</p></div>
          </div>
        </Card>
        <Card className="p-5 border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-300"><Clock className="h-5 w-5" /></div>
            <div><p className="text-3xl font-display font-bold text-amber-300">{stats?.due_today ?? 0}</p><p className="text-xs text-slate-400">Due today</p></div>
          </div>
        </Card>
        <Card className="p-5 border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300"><CheckCircle2 className="h-5 w-5" /></div>
            <div><p className="text-3xl font-display font-bold text-emerald-300">{stats?.upcoming ?? 0}</p><p className="text-xs text-slate-400">Upcoming</p></div>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h2 className="font-display text-lg font-semibold">Pickup Reminders</h2>
            <p className="text-xs text-slate-500 mt-0.5">Shops needing a cotton box pickup — sorted by urgency</p>
          </div>
          <button data-testid="view-all-shops" onClick={() => navigate("/shops")} className="text-xs text-cyan-300 flex items-center gap-1 hover:underline">
            All shops <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
        <div className="divide-y divide-white/5">
          {dueList.length === 0 && (
            <p className="p-6 text-center text-sm text-slate-500" data-testid="no-reminders">No pickups due right now. Add box entries to start tracking.</p>
          )}
          {dueList.slice(0, 12).map((r) => {
            const st = STATUS[r.status] || STATUS.upcoming;
            return (
              <div key={r.shop_id} data-testid={`reminder-row-${r.shop_no}`} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                <span className={`h-2.5 w-2.5 rounded-full ${st.dot} ${r.status === "overdue" ? "pulse-alert" : ""}`} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.shop_no} · {r.shop_name}</p>
                  <p className="text-xs text-slate-500 truncate">{r.location} · Cycle {r.cycle_days}d · Last: {fmtDate(r.last_entry)}</p>
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-400">Next pickup</p>
                  <p className="text-sm font-mono">{fmtDate(r.next_pickup)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${st.cls}`}>{st.label}</span>
                <button
                  data-testid={`reminder-entry-${r.shop_no}`}
                  onClick={() => navigate(`/box-entry?shop=${r.shop_id}`)}
                  className="shrink-0 rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-3 py-1.5 text-xs text-cyan-300 hover:bg-cyan-500/25 transition"
                >
                  Add Entry
                </button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
