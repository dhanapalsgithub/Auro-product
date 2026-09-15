import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, ArrowRight, ShieldCheck, FileText, CheckCircle2, Truck, BarChart3, Lock, X } from "lucide-react";

export default function LandingPage() {
  const navigate = useNavigate();
  const [activeModal, setActiveModal] = useState(null); // 'terms' | 'gst' | 'privacy' | null

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col justify-between selection:bg-cyan-500 selection:text-white">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50/60 via-slate-50 to-emerald-50/60 pointer-events-none -z-10" />

      {/* Header / Navbar */}
      <header className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-cyan-600 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-cyan-600/20">
            <Package className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold tracking-tight text-slate-900">Auro Products</span>
        </div>

        <button
          onClick={() => navigate("/login")}
          className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-md shadow-slate-900/10 flex items-center gap-2 active:scale-95"
        >
          <Lock className="h-4 w-4 text-cyan-400" />
          Sign In Portal
        </button>
      </header>

      {/* Hero Section */}
      <main className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 text-xs font-semibold mb-6 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
          Tamil Nadu TASMAC Cotton Box Tender · 149 Shops Logistics
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-900 max-w-3xl leading-[1.15]">
          Precision Supply Chain & <span className="bg-gradient-to-r from-cyan-600 to-emerald-600 bg-clip-text text-transparent">Cotton Box Management</span>
        </h1>

        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
          Welcome to Auro Products. Powered by <span className="font-semibold text-slate-900">R I Billing Pro</span>, our enterprise platform seamlessly controls wholesale distribution, automated GST billing, and real-time container tracking across retail units.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row items-center gap-4 w-full justify-center">
          <button
            onClick={() => navigate("/login")}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-600 to-emerald-600 text-white font-semibold text-sm transition-all shadow-xl shadow-cyan-600/20 hover:opacity-95 flex items-center justify-center gap-3 group"
          >
            Access Dashboard
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-20 w-full text-left">
          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-cyan-50 text-cyan-600 flex items-center justify-center mb-4">
              <Truck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">149 Shops Logistics</h3>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Targeted container allocations, secure delivery challans, and complete dispatch tracking for TASMAC unit tenders.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">GST Invoicing & Ledgers</h3>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Automated CGST/SGST breakdowns, instant HSN/SAC validation, and precise day-book credit ledger balances.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Role-Based Security</h3>
            <p className="text-slate-500 text-xs mt-1 leading-relaxed">
              Granular access control ensuring absolute transparency, secure authentication, and safeguarded audit logs.
            </p>
          </div>
        </div>
      </main>

      {/* Footer & Legal Links */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
          <span>© 2026 Auro Products. All rights reserved.</span>
          <span className="hidden sm:inline text-slate-300">|</span>
          <span className="text-slate-600 font-medium">Built via <span className="text-cyan-600 font-mono">R I Billing Pro</span></span>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 text-slate-600">
          <button onClick={() => setActiveModal('terms')} className="hover:text-cyan-600 transition">Terms & Conditions</button>
          <span>•</span>
          <button onClick={() => setActiveModal('gst')} className="hover:text-cyan-600 transition">GST Invoicing Policy</button>
          <span>•</span>
          <button onClick={() => setActiveModal('privacy')} className="hover:text-cyan-600 transition">Privacy Policy</button>
        </div>
      </footer>

      {/* Legal Modal */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setActiveModal(null)} />
          <div className="relative z-10 w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="h-4 w-4 text-cyan-600" />
                {activeModal === 'terms' && 'Terms & Conditions'}
                {activeModal === 'gst' && 'GST Invoicing Compliance'}
                {activeModal === 'privacy' && 'Privacy Policy'}
              </h3>
              <button onClick={() => setActiveModal(null)} className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 transition">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3 leading-relaxed text-left">
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