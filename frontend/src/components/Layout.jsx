import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/apiClient";
import {
  LayoutDashboard, Store, PackagePlus, Receipt, Scale, Boxes,
  Calendar, Settings as SettingsIcon, LogOut, Bell, Search, Menu, X, Wallet, FileBarChart, Coins,
} from "lucide-react";

const NAV = [
  { name: "Dashboard", icon: LayoutDashboard, path: "/dashboard", tid: "nav-dashboard" },
  { name: "149 Wine Shops", icon: Store, path: "/shops", tid: "nav-shops" },
  { name: "Cotton Box Entry", icon: PackagePlus, path: "/box-entry", tid: "nav-box-entry" },
  { name: "Inventory", icon: Boxes, path: "/inventory", tid: "nav-inventory" },
  { name: "GST Invoices", icon: Receipt, path: "/invoices", tid: "nav-invoices" },
  { name: "Payments & Ledger", icon: Wallet, path: "/payments", tid: "nav-payments" },
  { name: "Collections", icon: Coins, path: "/collections", tid: "nav-collections" },
  { name: "Reports", icon: FileBarChart, path: "/reports", tid: "nav-reports" },
  { name: "Waste Analytics", icon: Scale, path: "/waste-analytics", tid: "nav-waste" },
  { name: "Calendar", icon: Calendar, path: "/calendar", tid: "nav-calendar" },
  { name: "Settings", icon: SettingsIcon, path: "/settings", tid: "nav-settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [alertCount, setAlertCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/dashboard").then((res) => {
      const s = res.data.stats;
      setAlertCount((s.overdue || 0) + (s.due_today || 0));
    }).catch(() => {});
  }, []);

  const submitSearch = (e) => {
    e.preventDefault();
    if (q.trim()) navigate(`/shops?q=${encodeURIComponent(q.trim())}`);
  };

  const NavList = () => (
    <nav className="flex flex-col gap-1 px-3">
      {NAV.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          data-testid={item.tid}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `group flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              isActive
                ? "bg-cyan-500/15 text-cyan-300 glow-cyan border border-cyan-500/30"
                : "text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent"
            }`
          }
        >
          <item.icon className="h-[18px] w-[18px] shrink-0" />
          <span>{item.name}</span>
        </NavLink>
      ))}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-3 px-5 h-16 border-b border-white/10">
  <img 
    src="/ri-logo2.png" 
    alt="Auro" 
    className="h-16  w-15 rounded-lg object-contain  p-1" 
  />
  <div>
    <p className="font-display text-base font-bold leading-none tracking-tight">Auro Products</p>
    <p className="text-[10px] uppercase tracking-widest text-slate-500 font-mono mt-1">Billing Suite</p>
  </div>
</div>
  );

  return (
    <div className="relative min-h-screen">
      <div className="aurora" />
      <div className="relative z-10 flex min-h-screen">
        <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-white/10 bg-[rgba(255,255,255,0.7)] backdrop-blur-xl">
          <Brand />
          <div className="py-4 flex-1 overflow-y-auto"><NavList /></div>
          <div className="p-4 border-t border-white/10 space-y-3">
            <button data-testid="logout-button" onClick={logout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:text-red-300 hover:bg-red-500/10 transition-colors">
              <LogOut className="h-[18px] w-[18px]" /> Sign out
            </button>
            <p className="text-center text-[10px] text-slate-600 font-mono">Built by R I Billing Pro</p>
          </div>
        </aside>

        {open && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div className="absolute inset-0 bg-black/70" onClick={() => setOpen(false)} />
            <aside className="absolute left-0 top-0 h-full w-64 bg-[rgba(255,255,255,0.92)] backdrop-blur-xl border-r border-white/10 flex flex-col">
              <div className="flex items-center justify-between px-5 h-16 border-b border-white/10">
                <span className="font-display font-bold">Auro Products</span>
                <button onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
              </div>
              <div className="py-4 flex-1 overflow-y-auto"><NavList /></div>
              <p className="text-center text-[10px] text-slate-600 font-mono py-3">Built by R I Billing Pro</p>
            </aside>
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0">
          <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b border-white/10 bg-[rgba(255,255,255,0.72)] backdrop-blur-xl px-4 md:px-6">
            <button className="lg:hidden" onClick={() => setOpen(true)} data-testid="menu-toggle">
              <Menu className="h-6 w-6" />
            </button>
            <form onSubmit={submitSearch} className="relative hidden sm:block w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
              <input data-testid="global-search-input" value={q} onChange={(e) => setQ(e.target.value)}
                placeholder="Search shops by no / location…"
                className="w-full rounded-full bg-white/5 border border-white/10 py-2 pl-9 pr-4 text-sm outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/40" />
            </form>
            <div className="ml-auto flex items-center gap-3">
              <button data-testid="reminder-alert-button" onClick={() => navigate("/dashboard")}
                className="relative rounded-full p-2 hover:bg-white/5 transition-colors">
                <Bell className="h-5 w-5 text-slate-300" />
                {alertCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white pulse-alert">
                    {alertCount}
                  </span>
                )}
              </button>
              <div className="hidden md:flex items-center gap-2 rounded-full bg-white/5 border border-white/10 py-1.5 pl-3 pr-1.5">
                <span className="text-sm text-slate-300">{user?.name || user?.email}</span>
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-cyan-400 to-emerald-500 flex items-center justify-center text-xs font-bold text-slate-900">
                  {(user?.name || "A").charAt(0)}
                </div>
              </div>
            </div>
          </header>
          
          <main className="flex-1 p-4 md:p-6 lg:p-8 space-y-6">
            {/* Ledger Summary Cards Component Integration */}
            <LedgerSummarySection />

            {/* Main Content Area */}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

// Ledger Summary Cards Section Component
function LedgerSummarySection() {
  const [summary, setSummary] = useState({
    openingBalance: 0,
    totalRevenue: 0,
    netProfit: 0,
    closingBalance: 0,
  });

  useEffect(() => {
    api.get("/collections").then((res) => {
      // Backend /api/collections தரவுகளைப் பயன்படுத்தி சம்மரி கணக்கிடுதல்
      const data = res.data;
      const totalRev = data.total_revenue || 0;
      const totalOut = data.total_outstanding || 0;
      setSummary({
        openingBalance: 36000.0, // உதாரண தொடக்க இருப்பு
        totalRevenue: totalRev,
        netProfit: totalRev * 0.25, // தோராயமான லாப சதவீதம் அல்லது Backend தரவு
        closingBalance: totalOut,
      });
    }).catch(() => {});
  }, []);

  
}