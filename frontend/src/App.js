import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute"; 
import LandingPage from "@/pages/LandingPage"; // Public product overview landing page (First view)
import Login from "@/pages/Login"; // Separate Sign-in portal
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Shops from "@/pages/Shops";
import BoxEntry from "@/pages/BoxEntry";
import Invoices from "@/pages/Invoices";
import InvoiceView from "@/pages/InvoiceView";
import InvoiceForm from "@/pages/InvoiceForm"; 
import WasteAnalytics from "@/pages/WasteAnalytics";
import CalendarPage from "@/pages/CalendarPage";
import Settings from "@/pages/Settings";
import Inventory from "@/pages/Inventory";
import Payments from "@/pages/Payments";
import Reports from "@/pages/Reports";
import Collections from "@/pages/Collections";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster position="top-right" theme="dark" richColors />
          <Routes>
            {/* Root route ALWAYS shows the Landing Page first */}
            <Route path="/" element={<LandingPage />} />
            
            {/* Dedicated Login / Sign-in Portal route */}
            <Route path="/login" element={<Login />} />

            {/* Protected Routes wrapped inside Layout and ProtectedRoute check */}
            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/shops" element={<Shops />} />
              <Route path="/box-entry" element={<BoxEntry />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/waste-analytics" element={<WasteAnalytics />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Catch-all fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;