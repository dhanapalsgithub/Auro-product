import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
import { Calendar as CalIcon, ChevronLeft, ChevronRight } from "lucide-react";

const STATUS = {
  overdue: "bg-red-500/80 text-white",
  due_today: "bg-amber-500/80 text-slate-900",
  no_entry: "bg-slate-600/70 text-white",
  upcoming: "bg-emerald-500/70 text-slate-900",
};
const LABEL = { overdue: "Overdue", due_today: "Due Today", no_entry: "No Entry", upcoming: "Upcoming" };

export default function CalendarPage() {
  const [reminders, setReminders] = useState([]);
  const [cursor, setCursor] = useState(new Date());
  const navigate = useNavigate();

  useEffect(() => { api.get("/dashboard").then((r) => setReminders(r.data.reminders || [])); }, []);

  const byDate = useMemo(() => {
    const map = {};
    reminders.forEach((r) => {
      const key = r.next_pickup;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });
    return map;
  }, [reminders]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = new Date().toISOString().slice(0, 10);
  const monthName = cursor.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader title="Pickup Calendar" subtitle="Scheduled cotton box pickups by next-due date" icon={CalIcon}>
        <div className="flex items-center gap-2">
          <button data-testid="cal-prev" onClick={() => setCursor(new Date(year, month - 1, 1))} className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"><ChevronLeft className="h-4 w-4" /></button>
          <span className="font-medium min-w-[150px] text-center">{monthName}</span>
          <button data-testid="cal-next" onClick={() => setCursor(new Date(year, month + 1, 1))} className="rounded-lg border border-white/10 bg-white/5 p-2 hover:bg-white/10"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </PageHeader>

      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {Object.entries(LABEL).map(([k, v]) => (
          <span key={k} className="flex items-center gap-1.5"><span className={`h-3 w-3 rounded ${STATUS[k]}`} /> {v}</span>
        ))}
      </div>

      <Card className="p-4 md:p-6" data-testid="calendar-grid">
        <div className="grid grid-cols-7 gap-2 mb-2 text-center text-xs uppercase tracking-wider text-slate-500 font-mono">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (!d) return <div key={i} className="min-h-[92px]" />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const items = byDate[dateStr] || [];
            const isToday = dateStr === todayStr;
            return (
              <div key={i} className={`min-h-[92px] rounded-xl border p-2 ${isToday ? "border-cyan-500/50 bg-cyan-500/5" : "border-white/10 bg-white/[0.02]"}`}>
                <div className={`text-xs font-mono mb-1 ${isToday ? "text-cyan-300 font-bold" : "text-slate-500"}`}>{d}</div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((r) => (
                    <button key={r.shop_id} data-testid={`cal-item-${r.shop_no}`} onClick={() => navigate(`/box-entry?shop=${r.shop_id}`)}
                      className={`w-full truncate rounded px-1.5 py-0.5 text-[10px] font-medium ${STATUS[r.status]} hover:opacity-80 transition`}>
                      {r.shop_no}
                    </button>
                  ))}
                  {items.length > 3 && <div className="text-[10px] text-slate-500 px-1">+{items.length - 3} more</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
