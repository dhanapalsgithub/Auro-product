import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { formatApiErrorDetail } from "@/lib/apiClient";
import { Loader2, Lock, Mail, Package } from "lucide-react";

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("bmartbuild4@gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4 overflow-hidden">
      <div className="aurora" />
      <div className="relative z-10 w-full max-w-md">
        <div className="glass rounded-3xl p-8 sm:p-10 fade-up">
          <div className="flex flex-col items-center text-center mb-8">
            <img src="/auro-logo.png" alt="Auro Products" className="h-16 w-16 rounded-2xl object-contain mb-4" />
            <h1 className="font-display text-2xl font-bold tracking-tight">Auro Products</h1>
            <p className="text-sm text-slate-400 mt-1">GST Billing & Cotton Box Management</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-mono">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-white/5 border border-white/10 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-mono">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                <input
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl bg-white/5 border border-white/10 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/40"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p data-testid="login-error" className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 py-3 font-semibold text-slate-900 transition-transform active:scale-95 hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Sign in
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-slate-600 mt-6">Tamil Nadu TASMAC Cotton Box Tender · 149 Shops</p>
      </div>
    </div>
  );
}
