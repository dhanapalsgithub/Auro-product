import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { inr, fmtDate } from "@/lib/helpers";
import {
  LayoutDashboard, Store, Package, Scale, IndianRupee,
  AlertTriangle, Clock, CheckCircle2, ArrowUpRight, Calendar, X, MessageSquare,
  ChevronLeft, ChevronRight
} from "lucide-react";

const STATUS = {
  overdue: { label: "Overdue", cls: "bg-red-500/15 text-red-300 border-red-500/30", dot: "bg-red-400" },
  due_today: { label: "Due Today", cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", dot: "bg-amber-400" },
  no_entry: { label: "No Entry Yet", cls: "bg-slate-500/15 text-slate-300 border-slate-500/30", dot: "bg-slate-400" },
  upcoming: { label: "Upcoming", cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", dot: "bg-emerald-400" },
};

const REMINDER_PAGE_SIZE = 5;

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [reminderPage, setReminderPage] = useState(1);
  const [dateFilter, setDateFilter] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/dashboard").then((res) => setData(res.data)).catch(() => {});
  }, []);

  const reminders = data?.reminders || [];
  const dueList = reminders.filter((r) => ["overdue", "due_today", "no_entry"].includes(r.status));

  const filteredReminders = useMemo(() => {
    return dueList.filter((r) => {
      if (!dateFilter) return true;
      const nextPickupDate = r.next_pickup ? r.next_pickup.slice(0, 10) : "";
      return nextPickupDate === dateFilter;
    });
  }, [dueList, dateFilter]);

  const reminderPageCount = Math.max(1, Math.ceil(filteredReminders.length / REMINDER_PAGE_SIZE));
  const paginatedReminders = filteredReminders.slice((reminderPage - 1) * REMINDER_PAGE_SIZE, reminderPage * REMINDER_PAGE_SIZE);

  return (
    <div>
      <PageHeader title="Dashboard & Reminders" subtitle="Cotton box pickup schedule across 149 TASMAC wine shops" icon={LayoutDashboard} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-5"><p className="text-xs text-slate-500 font-mono">SHOPS</p><p className="text-2xl font-bold">{data?.shops_count ?? "—"}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500 font-mono">BOXES</p><p className="text-2xl font-bold">{(data?.total_boxes || 0).toLocaleString("en-IN")}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500 font-mono">WASTE (KG)</p><p className="text-2xl font-bold">{(data?.total_waste_kg || 0).toLocaleString("en-IN")}</p></Card>
        <Card className="p-5"><p className="text-xs text-slate-500 font-mono">REVENUE</p><p className="text-2xl font-bold">{inr(data?.total_invoiced || 0)}</p></Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="font-semibold">Pickup Reminders</h2>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFilter} onChange={(e) => { setDateFilter(e.target.value); setReminderPage(1); }} className="bg-white/5 border border-white/10 text-xs px-2 py-1 rounded outline-none" />
            {dateFilter && <button onClick={() => { setDateFilter(""); setReminderPage(1); }} className="p-1 hover:bg-white/10 rounded"><X className="h-3.5 w-3.5" /></button>}
          </div>
        </div>

        <div className="divide-y divide-white/5">
          {paginatedReminders.length === 0 ? (
            <div className="p-5 text-center text-xs text-slate-500">No scheduled reminders found.</div>
          ) : (
            paginatedReminders.map((r) => {
              const st = STATUS[r.status] || STATUS.upcoming;
              return (
                <div key={r.shop_id} className="flex items-center gap-4 p-4 hover:bg-white/5">
                  <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{r.shop_no} · {r.shop_name}</p>
                    <p className="text-xs text-slate-500 truncate">Cycle {r.cycle_days}d · Next: {fmtDate(r.next_pickup)}</p>
                  </div>
                  <a href={r.whatsapp_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs border border-emerald-500/30 hover:bg-emerald-500/30 transition">
                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Reminder
                  </a>
                </div>
              );
            })
          )}
        </div>

        {reminderPageCount > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-white/10 bg-white/[0.01] text-xs">
            <span className="text-slate-400">Page {reminderPage} of {reminderPageCount}</span>
            <div className="flex items-center gap-2">
              <button disabled={reminderPage === 1} onClick={() => setReminderPage((p) => Math.max(1, p - 1))} className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button disabled={reminderPage === reminderPageCount} onClick={() => setReminderPage((p) => Math.min(reminderPageCount, p + 1))} className="p-1.5 rounded-lg border border-white/10 bg-white/5 disabled:opacity-40 hover:bg-white/10">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}