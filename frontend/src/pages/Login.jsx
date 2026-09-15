import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, Package, FileText, X, ShieldCheck } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("dhanapaul2020@gmail.com");
  const [password, setPassword] = useState("dhana@123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'gst' | 'privacy' | 'about' | null

  // ஏற்கனவே லாகின் செய்திருந்தால் நேரடியாக டாஷ்போர்டுக்குச் செல்லும்
  useEffect(() => {
    const isAuth = localStorage.getItem("auro_mock_auth");
    if (isAuth === "true") {
      navigate("/dashboard");
    }
  }, [navigate]);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const validUsers = [
        { email: "dhanapaul2020@gmail.com", password: "dhana@123", role: "admin" },
        { email: "userone@gmail.com", password: "one@123", role: "admin" },
        { email: "usertwo@gmail.com", password: "two@123", role: "user" },
        { email: "userthree@gmail.com", password: "three@123", role: "user" },
      ];

      const matchedUser = validUsers.find(
        (u) => u.email === email && u.password === password
      );

      if (matchedUser) {
        localStorage.setItem("auro_mock_auth", "true");
        localStorage.setItem("auro_current_user", email);
        localStorage.setItem("auro_user_role", matchedUser.role);
        
        // 🔒 Edit, Delete & Opening Balance: Restricted strictly to admin accounts only
        const isAdmin = matchedUser.role === "admin";
        localStorage.setItem("auro_can_edit", isAdmin ? "true" : "false");
        localStorage.setItem("auro_can_manage_balance", isAdmin ? "true" : "false");
        
        // 📄 Creation (Invoices, Box Entries, Payments): Allowed for ALL authenticated users
        localStorage.setItem("auro_can_create", "true");
        localStorage.setItem("auro_can_create_invoice", "true");
        
        // எந்தவித சர்வர் தொல்லையும் இல்லாமல் உடனே டாஷ்போர்டுக்கு மாறும்
        window.location.href = "/dashboard";
      } else {
        setError("Invalid email or password. Please check your credentials.");
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-between px-4 py-8 overflow-hidden bg-slate-100 text-slate-800">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-slate-100 to-emerald-50 pointer-events-none" />
      
      {/* Spacer to push card to center */}
      <div />

      <div className="relative z-10 w-full max-w-md my-auto">
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 sm:p-10 border border-slate-200 shadow-xl shadow-slate-200/50">
          <div className="flex flex-col items-center text-center mb-8">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-cyan-500 to-emerald-600 flex items-center justify-center mb-4 text-white shadow-lg shadow-cyan-500/20">
              <Package className="h-8 w-8" />
            </div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900">Auro Products</h1>
            <p className="text-sm text-slate-500 mt-1">GST Billing & Cotton Box Management</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-mono">Email</label>
              <div className="relative mt-1.5">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  data-testid="login-email-input"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-slate-900"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-slate-500 font-mono">Password</label>
              <div className="relative mt-1.5">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  data-testid="login-password-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl bg-slate-50 border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-slate-900"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p data-testid="login-error" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              data-testid="login-submit-button"
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-emerald-600 py-3 font-semibold text-white transition-transform active:scale-95 hover:opacity-95 disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
              Sign in
            </button>
          </form>
        </div>
      </div>

      {/* Professional Footer & Legal Navigation */}
      <footer className="relative z-10 w-full max-w-4xl mt-6 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 text-center">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <span>Tamil Nadu TASMAC Cotton Box Tender · 149 Shops</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="text-slate-600 font-medium">Built by <span className="text-cyan-600 font-mono">R I Billing Pro</span></span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
          <button onClick={() => setActiveModal('about')} className="hover:text-cyan-600 font-semibold transition">About Auro Products</button>
          <span>•</span>
          <button onClick={() => setActiveModal('terms')} className="hover:text-cyan-600 transition">Terms</button>
          <span>•</span>
          <button onClick={() => setActiveModal('gst')} className="hover:text-cyan-600 transition">GST Policy</button>
          <span>•</span>
          <button onClick={() => setActiveModal('privacy')} className="hover:text-cyan-600 transition">Privacy</button>
        </div>
      </footer>

      {/* Legal & About Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                {activeModal === 'about' ? <ShieldCheck className="h-5 w-5 text-cyan-600" /> : <FileText className="h-4 w-4 text-cyan-600" />}
                {activeModal === 'about' && 'About Auro Products'}
                {activeModal === 'terms' && 'Terms & Conditions'}
                {activeModal === 'gst' && 'GST Invoicing Compliance'}
                {activeModal === 'privacy' && 'Privacy Policy'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed text-left">
              {activeModal === 'about' && (
                <>
                  <p className="font-semibold text-slate-900 text-sm">Empowering Tamil Nadu TASMAC Cotton Box Logistics & Supply Chain</p>
                  <p><strong>Auro Products</strong> is a specialized enterprise solutions provider engineered to streamline manufacturing, wholesale distribution, and container tracking across 149 retail units.</p>
                  <p>Managed via <strong>R I Billing Pro</strong>, our integrated portal monitors real-time shop allocations, inventory ledgers, delivery challans, and GST-compliant invoicing with absolute accuracy.</p>
                  <p>Our mission is to replace traditional paperwork with lightning-fast digital workflows, ensuring seamless coordination between warehouse operators, business partners, and retail distribution networks.</p>
                </>
              )}
              {activeModal === 'terms' && (
                <>
                  <p>Welcome to Auro Products TASMAC Cotton Box Management system. By accessing or using this portal, you agree to comply with and be bound by the following terms.</p>
                  <p>1. <strong>Authorized Access:</strong> This application is restricted to authorized administrative personnel, suppliers, and registered operators managing the 149 TASMAC retail units.</p>
                  <p>2. <strong>Operational Integrity:</strong> All box entries, container deliveries, inventory updates, and credit balances must be logged accurately to maintain ledger synchronization.</p>
                  <p>3. <strong>System Security:</strong> Users are responsible for safeguarding their login credentials and restricting unauthorized access to terminal sessions.</p>
                </>
              )}
              {activeModal === 'gst' && (
                <>
                  <p>Our platform incorporates standardized Goods and Services Tax (GST) compliance modules designed for wholesale supply and distribution.</p>
                  <p>1. <strong>Tax Calculations:</strong> Automated computation of Central GST (CGST) and State GST (SGST) percentages on billable items and cotton box allocations.</p>
                  <p>2. <strong>Invoice Generation:</strong> Invoices generated through R I Billing Pro comply with statutory tax invoice requirements, displaying valid HSN/SAC codes, tax breakdowns, and business identifiers.</p>
                  <p>3. <strong>Audit Logs:</strong> All generated tax invoices and ledger entries are archived securely for retrospective accounting and tax filing audits.</p>
                </>
              )}
              {activeModal === 'privacy' && (
                <>
                  <p>At Auro Products, we prioritize the confidentiality and security of your business and operational data.</p>
                  <p>1. <strong>Data Collection:</strong> We collect shop transaction details, inventory metrics, user authentication logs, and distribution summaries solely to operate and improve supply management.</p>
                  <p>2. <strong>Information Security:</strong> Data transmission is secured using modern encryption protocols, and local caching mechanisms are deployed for high-speed offline reliability.</p>
                  <p>3. <strong>Third-Party Sharing:</strong> Operational records and shop ledgers are strictly internal and are never shared or commercialized with external entities.</p>
                </>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setActiveModal(null)}
                className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}