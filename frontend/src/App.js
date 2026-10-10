import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";

// Components
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";

// Pages
import LandingPage from "./pages/LandingPage";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Shops from "./pages/Shops";
import BoxEntry from "./pages/BoxEntry";
import Invoices from "./pages/Invoices";
import InvoiceView from "./pages/InvoiceView";
import InvoiceForm from "./pages/InvoiceForm";
import WasteAnalytics from "./pages/WasteAnalytics";
import CalendarPage from "./pages/CalendarPage";
import Settings from "./pages/Settings";
import Inventory from "./pages/Inventory";
import Payments from "./pages/Payments";
import Reports from "./pages/Reports";
import Collections from "./pages/Collections";
import Expenses from "./pages/Expenses";

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Toaster position="top-right" theme="dark" richColors />
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />

            {/* Protected Dashboard Layout Routes */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/shops" element={<Shops />} />
              <Route path="/box-entry" element={<BoxEntry />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceForm />} />
              <Route path="/invoices/:id" element={<InvoiceView />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/collections" element={<Collections />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/waste-analytics" element={<WasteAnalytics />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Catch-all Redirec */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;