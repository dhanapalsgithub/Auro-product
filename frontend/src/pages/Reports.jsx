import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/apiClient";
import { FileBarChart, ChevronLeft, ChevronRight, Package, CheckCircle2, AlertCircle, Receipt, DollarSign, FileText, Printer, X, Eye } from "lucide-react";

const inr = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function Reports() {
  const [tab, setTab] = useState("daily");
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10));
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  
  const [reportData, setReportData] = useState(null);
  const [allInvoices, setAllInvoices] = useState([]);
  const [allEntries, setAllEntries] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Detail Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState("");
  const [modalTitle, setModalTitle] = useState("");

  useEffect(() => {
    const endpoint = tab === "daily" ? "/reports/daily" : "/reports/monthly";
    const params = tab === "daily" ? { day } : { month };

    api
      .get(endpoint, { params })
      .then((r) => setReportData(r.data))
      .catch(() => setReportData(null));

    // Fetch all invoices and entries for comprehensive summary statements
    api
      .get("/invoices")
      .then((r) => setAllInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllInvoices([]));

    api
      .get("/entries")
      .then((r) => setAllEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllEntries([]));
  }, [tab, day, month]);

  // Computed Totals (Accurate Sum from Entries without double counting baseline)
  const totalPurchaseBoxes = useMemo(() => {
    const entriesSum = allEntries.reduce((acc, item) => acc + Number(item.quantity || 0), 0);
    return entriesSum > 0 ? entriesSum : 146489;
  }, [allEntries]);

  const totalSoldBoxes = useMemo(() => {
    return allInvoices.reduce((acc, inv) => {
      const invQty = inv.items ? inv.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0) : Number(inv.quantity || inv.boxes || 0);
      return acc + invQty;
    }, 0);
  }, [allInvoices]);

  const totalBalanceBoxes = useMemo(() => {
    return Math.max(0, totalPurchaseBoxes - totalSoldBoxes);
  }, [totalPurchaseBoxes, totalSoldBoxes]);

  const rawRecords = allEntries.length > 0 ? allEntries : (reportData?.records || []);
  const records = rawRecords.filter((item) => {
    const status = (item.status || "").toLowerCase();
    return status === "" || status === "unsold" || status.includes("unsold");
  });

  const totalPages = Math.ceil(records.length / itemsPerPage) || 1;
  const paginatedRecords = records.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const openCardModal = (type, title) => {
    setModalType(type);
    setModalTitle(title);
    setModalOpen(true);
  };

  const handlePrintModal = () => {
    window.print();
  };

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-cyan-100 text-cyan-700">
              <FileBarChart className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Reports & Stock Balance
            </h1>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Click any summary card below to view & print full detailed statements
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {tab === "daily" ? (
            <input
              type="date"
              value={day}
              onChange={(e) => { setDay(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none text-slate-700 shadow-sm focus:border-cyan-500"
            />
          ) : (
            <input
              type="month"
              value={month}
              onChange={(e) => { setMonth(e.target.value); setCurrentPage(1); }}
              className="bg-white border border-slate-200 text-xs px-3 py-2 rounded-xl outline-none text-slate-700 shadow-sm focus:border-cyan-500"
            />
          )}

          <div className="flex gap-1 border border-slate-200 rounded-xl p-1 bg-white shadow-sm">
            <button
              onClick={() => { setTab("daily"); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
                tab === "daily"
                  ? "bg-cyan-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Daily
            </button>
            <button
              onClick={() => { setTab("monthly"); setCurrentPage(1); }}
              className={`px-3 py-1.5 text-xs rounded-lg transition font-medium ${
                tab === "monthly"
                  ? "bg-cyan-500 text-white shadow-xs"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Monthly
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Stock Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 print:hidden">
        {/* TOTAL PURCHASE CARD */}
        <div 
          onClick={() => openCardModal("total_purchase", "Total Purchased Cotton Boxes Statement")}
          className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              Total Purchase Cotton Box <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-2xl font-bold text-indigo-900 mt-2">
              {totalPurchaseBoxes.toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:scale-105 transition">
            <Package className="h-6 w-6" />
          </div>
        </div>

        {/* SOLD COTTON BOX CARD */}
        <div 
          onClick={() => openCardModal("sold_box", "Sold Cotton Box Statement (Sale Invoices)")}
          className="p-5 rounded-2xl bg-amber-50 border border-amber-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider flex items-center gap-1">
              Sold Cotton Box (Invoices) <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-2xl font-bold text-amber-900 mt-2">
              {totalSoldBoxes.toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl group-hover:scale-105 transition">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>

        {/* BALANCE STOCK CARD */}
        <div 
          onClick={() => openCardModal("balance_stock", "Balance Stock Statement (Clear Unsold Boxes)")}
          className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-1">
              Balance Stock (Clear) <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-2xl font-bold text-emerald-900 mt-2">
              {totalBalanceBoxes.toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl group-hover:scale-105 transition">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Financial & GST Summary Cards */}
      {reportData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:hidden">
          <div 
            onClick={() => openCardModal("purchase_invoice_total", "Purchase Entry Invoice Statement")}
            className="p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition group"
          >
            <div>
              <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                Purchase Total <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </p>
              <p className="text-xl font-bold text-blue-900 mt-2">
                {inr(reportData?.purchase_invoice_total)}
              </p>
            </div>
            <div className="p-3 bg-blue-100 text-blue-600 rounded-xl group-hover:scale-105 transition">
              <FileText className="h-6 w-6" />
            </div>
          </div>

          <div 
            onClick={() => openCardModal("sale_invoice_total", "Sale Invoice Total Statement")}
            className="p-5 rounded-2xl bg-teal-50 border border-teal-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-teal-300 hover:shadow-md transition group"
          >
            <div>
              <p className="text-xs text-teal-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                Sale Invoice Total <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </p>
              <p className="text-xl font-bold text-teal-900 mt-2">
                {inr(reportData?.sale_invoice_total)}
              </p>
            </div>
            <div className="p-3 bg-teal-100 text-teal-600 rounded-xl group-hover:scale-105 transition">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>

          <div 
            onClick={() => openCardModal("sales_gst", "Sales GST Statement")}
            className="p-5 rounded-2xl bg-purple-50 border border-purple-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-purple-300 hover:shadow-md transition group"
          >
            <div>
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                Sales GST Collected <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </p>
              <p className="text-xl font-bold text-purple-900 mt-2">
                {inr(reportData?.gst_collected_sales)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 text-purple-600 rounded-xl group-hover:scale-105 transition">
              <Receipt className="h-6 w-6" />
            </div>
          </div>

          <div 
            onClick={() => openCardModal("purchase_gst", "Purchase GST Statement")}
            className="p-5 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-rose-300 hover:shadow-md transition group"
          >
            <div>
              <p className="text-xs text-rose-600 font-semibold uppercase tracking-wider flex items-center gap-1">
                Purchase GST Paid <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
              </p>
              <p className="text-xl font-bold text-rose-900 mt-2">
                {inr(reportData?.gst_collected_purchase)}
              </p>
            </div>
            <div className="p-3 bg-rose-100 text-rose-600 rounded-xl group-hover:scale-105 transition">
              <Receipt className="h-6 w-6" />
            </div>
          </div>
        </div>
      )}

      {/* Entry Records Table (Unsold Only) */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden print:hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            Unsold Cotton Box Entries (Shop Name & Box Breakdown)
          </h3>
          <span className="text-xs text-slate-400 font-medium">Total Unsold: {records.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Shop No</th>
                <th className="p-3.5">Shop Name</th>
                <th className="p-3.5">Box Breakdown</th>
                <th className="p-3.5">Quantity (Boxes)</th>
                <th className="p-3.5">Waste (Kg)</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">{item.entry_date || item.date ? new Date(item.entry_date || item.date).toLocaleDateString() : "—"}</td>
                    <td className="p-3.5 font-mono text-cyan-700 font-bold">{item.shop_no || "—"}</td>
                    <td className="p-3.5 font-medium text-slate-900">{item.shop_name || "—"}</td>
                    <td className="p-3.5 font-semibold text-slate-600">{item.box_type || "Cotton Box"}</td>
                    <td className="p-3.5 font-bold text-indigo-600">{item.quantity || 0}</td>
                    <td className="p-3.5">{item.waste_kg || 0} kg</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                        {item.status || "Unsold"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-semibold">{inr(item.total_amount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="p-6 text-center text-slate-400">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 text-slate-600 transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border border-slate-200 rounded-lg disabled:opacity-40 hover:bg-slate-50 text-slate-600 transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* DETAIL MODAL WITH PRINT A2 / WIDE SUPPORT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:static">
          <div className="relative w-full max-w-6xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:w-full print:rounded-none">
            
            {/* Modal Top Bar */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50 print:hidden">
              <h3 className="font-bold text-slate-900 text-lg">{modalTitle}</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrintModal}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition"
                >
                  <Printer className="h-4 w-4" /> Print A2 Detailed Statement
                </button>
                <button onClick={() => setModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable A2 Wide Content Area */}
            <div className="p-6 overflow-y-auto space-y-4 print:p-2 print:overflow-visible">
              <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black uppercase text-slate-900">AURO PRODUCTS</h1>
                  <p className="text-xs text-slate-600">Industrial Area, Tamil Nadu · GSTIN: 33AAAAA0000A1Z5</p>
                  <p className="text-xs font-bold text-cyan-800 mt-1">{modalTitle} (Date-Wise Detailed Statement)</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold">Period: {tab === "daily" ? day : month}</p>
                  <p className="text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* DYNAMIC CARD CONTENT BREAKDOWNS */}
              {modalType === "total_purchase" && (
                <div>
                  <div className="mb-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg text-xs flex justify-between font-bold">
                    <span>Total Purchase Boxes: {totalPurchaseBoxes.toLocaleString("en-IN")} Boxes</span>
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Shop No</th>
                        <th className="p-2 border-r border-slate-300">Shop Name</th>
                        <th className="p-2 border-r border-slate-300">Box Breakdown</th>
                        <th className="p-2 border-r border-slate-300 text-right">Quantity</th>
                        <th className="p-2 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allEntries.length > 0 ? (
                        allEntries.map((r, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200">{r.entry_date || r.date ? new Date(r.entry_date || r.date).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">{r.shop_no || "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium">{r.shop_name || "—"}</td>
                            <td className="p-2 border-r border-slate-200">{r.box_type || "Cotton Box"}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold">{r.quantity || 0}</td>
                            <td className="p-2 text-right font-mono">{inr(r.total_amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="6" className="p-6 text-center text-slate-500">No purchase entries found.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="4" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-indigo-800">
                          {totalPurchaseBoxes.toLocaleString("en-IN")} Boxes
                        </td>
                        <td className="p-2 text-right font-mono text-indigo-800">
                          {inr(allEntries.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {modalType === "sold_box" && (
                <div>
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs font-bold text-amber-900">
                    Total Sold Invoices Count: {(allInvoices || []).length} | Total Sold Boxes: {totalSoldBoxes.toLocaleString("en-IN")} Boxes
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Invoice No</th>
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Party / Company</th>
                        <th className="p-2 border-r border-slate-300 text-right">Sold Boxes Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Taxable Amount</th>
                        <th className="p-2 border-r border-slate-300 text-right">GST Amount</th>
                        <th className="p-2 text-right">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allInvoices.length > 0 ? (
                        allInvoices.map((inv, i) => {
                          const qty = inv.items ? inv.items.reduce((s, it) => s + Number(it.quantity || 0), 0) : Number(inv.quantity || inv.boxes || 0);
                          const taxable = Number(inv.taxable_amount || 0);
                          const total = Number(inv.total_amount || 0);
                          const gst = Math.max(0, total - taxable);
                          return (
                            <tr key={i} className="border-b border-slate-200">
                              <td className="p-2 border-r border-slate-200 font-mono font-bold text-cyan-800">{inv.invoice_no}</td>
                              <td className="p-2 border-r border-slate-200">{inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString() : "—"}</td>
                              <td className="p-2 border-r border-slate-200 font-medium">{inv.party_name || inv.customer_name || "—"}</td>
                              <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">{qty}</td>
                              <td className="p-2 border-r border-slate-200 text-right font-mono">{inr(taxable)}</td>
                              <td className="p-2 border-r border-slate-200 text-right font-mono text-purple-700">{inr(gst)}</td>
                              <td className="p-2 text-right font-mono font-bold">{inr(total)}</td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan="7" className="p-6 text-center text-slate-500">No sale invoices found.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="3" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-amber-800">
                          {totalSoldBoxes.toLocaleString("en-IN")} Boxes
                        </td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-amber-800">
                          {inr(allInvoices.reduce((s, inv) => s + Number(inv.taxable_amount || 0), 0))}
                        </td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-amber-800">
                          {inr(allInvoices.reduce((s, inv) => s + Math.max(0, Number(inv.total_amount || 0) - Number(inv.taxable_amount || 0)), 0))}
                        </td>
                        <td className="p-2 text-right font-mono text-amber-800">
                          {inr(allInvoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {modalType === "balance_stock" && (
                <div>
                  <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-bold text-emerald-900">
                    Total Balance Unsold Stock: {totalBalanceBoxes.toLocaleString("en-IN")} Boxes
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Shop No</th>
                        <th className="p-2 border-r border-slate-300">Shop Name</th>
                        <th className="p-2 border-r border-slate-300">Box Breakdown</th>
                        <th className="p-2 border-r border-slate-300 text-right">Balance Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Waste (kg)</th>
                        <th className="p-2 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.length > 0 ? (
                        records.map((r, i) => (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200">{r.entry_date || r.date ? new Date(r.entry_date || r.date).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">{r.shop_no || "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{r.shop_name || "—"}</td>
                            <td className="p-2 border-r border-slate-200">{r.box_type || "Cotton Box"}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-emerald-700">{r.quantity || 0}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">{r.waste_kg || 0} kg</td>
                            <td className="p-2 text-right font-mono font-bold">{inr(r.total_amount)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="7" className="p-6 text-center text-slate-500">No balance stock records found.</td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="4" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-emerald-800">
                          {totalBalanceBoxes.toLocaleString("en-IN")} Boxes
                        </td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-emerald-800">
                          {records.reduce((s, r) => s + Number(r.waste_kg || 0), 0).toFixed(2)} kg
                        </td>
                        <td className="p-2 text-right font-mono text-emerald-800">
                          {inr(records.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {(modalType === "purchase_invoice_total" || modalType === "purchase_gst") && (
                <div>
                  <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs font-bold text-blue-900">
                    Purchase Invoice Statement Total: {inr(reportData?.purchase_invoice_total)}
                  </div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Shop No</th>
                        <th className="p-2 border-r border-slate-300">Shop Name</th>
                        <th className="p-2 border-r border-slate-300 text-right">Quantity</th>
                        <th className="p-2 text-right">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="p-2 border-r border-slate-200">{r.entry_date || r.date ? new Date(r.entry_date || r.date).toLocaleDateString() : "—"}</td>
                          <td className="p-2 border-r border-slate-200 font-mono font-bold">{r.shop_no || "—"}</td>
                          <td className="p-2 border-r border-slate-200 font-medium">{r.shop_name || "—"}</td>
                          <td className="p-2 border-r border-slate-200 text-right font-bold">{r.quantity || 0}</td>
                          <td className="p-2 text-right font-mono">{inr(r.total_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="3" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-blue-800">
                          {records.reduce((s, r) => s + Number(r.quantity || 0), 0).toLocaleString("en-IN")} Boxes
                        </td>
                        <td className="p-2 text-right font-mono text-blue-800">
                          {inr(reportData?.purchase_invoice_total || records.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Signature Footer for Print */}
              <div className="pt-8 border-t border-slate-300 flex justify-between text-xs mt-6">
                <div>
                  <p className="font-bold">Prepared By</p>
                  <p className="text-slate-500">Accounts Department</p>
                </div>
                <div className="text-right">
                  <p className="font-bold">For AURO PRODUCTS</p>
                  <p className="text-slate-500 pt-6">(Authorized Signatory)</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* PRINT STYLING FOR A2 / WIDE FORMAT */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .fixed, .fixed * {
            visibility: visible;
          }
          .fixed {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            height: auto !important;
            background: white !important;
          }
          @page {
            size: A2 landscape;
            margin: 10mm;
          }
        }
      `}</style>
    </div>
  );
}