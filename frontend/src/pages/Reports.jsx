import React, { useEffect, useState, useMemo } from "react";
import api from "../lib/apiClient";
import { FileBarChart, ChevronLeft, ChevronRight, Package, CheckCircle2, AlertCircle, Receipt, DollarSign, FileText, Printer, X, Eye } from "lucide-react";

const inr = (val) =>
  `₹${Number(val || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const isBeer = (val) => {
  if (!val) return false;
  return String(val).toLowerCase().includes("beer");
};

const isBrandy = (val) => {
  if (!val) return false;
  return String(val).toLowerCase().includes("brandy");
};

const isBeerOrBrandy = (val) => {
  if (!val) return false;
  const str = String(val).toLowerCase();
  return str.includes("beer") || str.includes("brandy");
};

// Helper to breakdown quantities for Purchase / Entries
const getEntryQty = (item) => {
  const beer = Number(item.beer_qty || 0);
  const brandy = Number(item.brandy_qty || 0);
  const total = Number(item.quantity || item.boxes || (beer + brandy) || 0);
  const boxType = String(item.box_type || item.item_name || item.description || "").toLowerCase();
  
  let b = beer;
  let br = brandy;
  if (b === 0 && br === 0) {
    if (isBeer(boxType)) {
      b = total;
      br = 0;
    } else if (isBrandy(boxType)) {
      b = 0;
      br = total;
    } else {
      b = total / 2;
      br = total / 2;
    }
  }
  return { beer: b, brandy: br, total: b + br };
};

// Helper to breakdown quantities for Invoices / Sales
const getInvoiceQty = (inv) => {
  let beer = 0;
  let brandy = 0;

  if (inv.items && Array.isArray(inv.items)) {
    inv.items.forEach((it) => {
      const label = it.description || it.box_type || it.name || it.item_name || "";
      const qty = Number(it.quantity || 0);
      if (isBeer(label)) beer += qty;
      else if (isBrandy(label)) brandy += qty;
      else {
        beer += qty / 2;
        brandy += qty / 2;
      }
    });
  } else {
    const label = inv.box_type || inv.item_name || inv.description || "";
    const qty = Number(inv.quantity || inv.boxes || 0);
    if (isBeer(label)) beer += qty;
    else if (isBrandy(label)) brandy += qty;
    else {
      beer += qty / 2;
      brandy += qty / 2;
    }
  }

  return { beer, brandy, total: beer + brandy };
};

export default function Reports() {
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // Default to start of current month
    return date.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(() => new Date().toISOString().slice(0, 10));
  
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
    api
      .get("/reports/range", { params: { fromDate, toDate } })
      .then((r) => setReportData(r.data))
      .catch(() => {
        api
          .get("/reports/daily", { params: { day: toDate } })
          .then((r) => setReportData(r.data))
          .catch(() => setReportData(null));
      });

    api
      .get("/invoices")
      .then((r) => setAllInvoices(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllInvoices([]));

    api
      .get("/entries")
      .then((r) => setAllEntries(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAllEntries([]));
  }, [fromDate, toDate]);

  // Filtered Entries based on From Date and To Date
  const filteredEntries = useMemo(() => {
    return allEntries.filter((item) => {
      const itemDate = item.entry_date || item.date || item.created_at;
      if (!itemDate) return true;
      const dateStr = String(itemDate).slice(0, 10);
      return dateStr >= fromDate && dateStr <= toDate;
    });
  }, [allEntries, fromDate, toDate]);

  // Filtered Invoices based on From Date and To Date
  const filteredInvoices = useMemo(() => {
    return allInvoices.filter((inv) => {
      const invDate = inv.invoice_date || inv.date || inv.created_at;
      if (!invDate) return true;
      const dateStr = String(invDate).slice(0, 10);
      return dateStr >= fromDate && dateStr <= toDate;
    });
  }, [allInvoices, fromDate, toDate]);

  // Computed Totals for Purchase Boxes (Beer & Brandy Breakdown)
  const purchaseStats = useMemo(() => {
    return filteredEntries.reduce(
      (acc, item) => {
        const q = getEntryQty(item);
        acc.beer += q.beer;
        acc.brandy += q.brandy;
        acc.total += q.total;
        return acc;
      },
      { beer: 0, brandy: 0, total: 0 }
    );
  }, [filteredEntries]);

  // Computed Totals for Beer & Brandy Sales Invoices (Breakdown)
 const soldStats = useMemo(() => {
    const calculatedSold = filteredInvoices.reduce(
      (acc, inv) => {
        const invType = (inv.invoice_type || "").toUpperCase();
        if (invType !== "PURCHASE" && invType !== "PURCHASE_ENTRY" && invType !== "ENTRY") {
          const q = getInvoiceQty(inv);
          acc.beer += q.beer;
          acc.brandy += q.brandy;
          acc.total += q.total;
        }
        return acc;
      },
      { beer: 0, brandy: 0, total: 0 }
    );

    // Force sold boxes to match purchase boxes if they are tied to the same stock pool
    return {
      beer: Math.min(calculatedSold.beer, purchaseStats.beer),
      brandy: Math.min(calculatedSold.brandy, purchaseStats.brandy),
      total: Math.min(calculatedSold.total, purchaseStats.total),
    };
  }, [filteredInvoices, purchaseStats]);

  const balanceStats = useMemo(() => {
    return {
      beer: purchaseStats.beer - soldStats.beer,
      brandy: purchaseStats.brandy - soldStats.brandy,
      total: purchaseStats.total - soldStats.total,
    };
  }, [purchaseStats, soldStats]);

  // Frontend calculated Purchase GST to sync card with statement
  const calculatedPurchaseGst = useMemo(() => {
    return filteredEntries.reduce((sum, item) => {
      const total = Number(item.total_amount || 0);
      const taxable = Number(item.taxable_amount || total * 0.9);
      return sum + Math.max(0, total - taxable);
    }, 0);
  }, [filteredEntries]);

  const calculatedPurchaseTotal = useMemo(() => {
    return filteredEntries.reduce((sum, item) => sum + Number(item.total_amount || 0), 0);
  }, [filteredEntries]);

  const calculatedSaleTotal = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
  }, [filteredInvoices]);

  const calculatedSalesGst = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => {
      const total = Number(inv.total_amount || 0);
      const taxable = Number(inv.taxable_amount || total * 0.9);
      return sum + Math.max(0, total - taxable);
    }, 0);
  }, [filteredInvoices]);

  const records = filteredEntries.filter((item) => {
    return isBeerOrBrandy(item.box_type || item.item_name || item.description);
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

  const handlePrintModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const printableContent = document.getElementById("printable-statement-area");
    if (!printableContent) return;

    const printWindow = window.open("", "_blank", "width=1000,height=800");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>${modalTitle}</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #1e293b; }
              table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
              th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
              th { background-color: #f1f5f9; font-weight: bold; }
              .text-right { text-align: right; }
              .font-bold { font-weight: bold; }
              .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; }
              @page { size: A4 landscape; margin: 10mm; }
            </style>
          </head>
          <body>
            ${printableContent.innerHTML}
            <script>
              window.onload = function() {
                window.print();
                window.close();
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
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

        {/* Date Range Picker (From Date -> To Date) */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-xs text-slate-400 font-medium">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="text-xs outline-none text-slate-700 font-medium bg-transparent"
            />
          </div>

          <div className="flex items-center gap-2 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-xs text-slate-400 font-medium">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
              className="text-xs outline-none text-slate-700 font-medium bg-transparent"
            />
          </div>
        </div>
      </div>

      {/* Interactive Stock Cards Section with Beer & Brandy Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div 
          onClick={() => openCardModal("total_purchase", "Total Purchased Beer & Brandy Boxes Statement")}
          className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-indigo-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-indigo-500 font-semibold uppercase tracking-wider flex items-center gap-1">
              Total Purchase Beer & Brandy Box <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-2xl font-bold text-indigo-900 mt-2">
              {Math.round(purchaseStats.total).toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-indigo-700">
              <span>Beer: {Math.round(purchaseStats.beer).toLocaleString("en-IN")}</span>
              <span>•</span>
              <span>Brandy: {Math.round(purchaseStats.brandy).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl group-hover:scale-105 transition">
            <Package className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => openCardModal("sold_box", "Sold Beer & Brandy Box Statement (Sale Invoices)")}
          className="p-5 rounded-2xl bg-amber-50 border border-amber-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-amber-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-amber-600 font-semibold uppercase tracking-wider flex items-center gap-1">
              Sold Beer & Brandy Box (Invoices) <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-2xl font-bold text-amber-900 mt-2">
              {Math.round(soldStats.total).toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-amber-800">
              <span>Beer: {Math.round(soldStats.beer).toLocaleString("en-IN")}</span>
              <span>•</span>
              <span>Brandy: {Math.round(soldStats.brandy).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="p-3 bg-amber-100 text-amber-600 rounded-xl group-hover:scale-105 transition">
            <AlertCircle className="h-6 w-6" />
          </div>
        </div>

        <div 
          onClick={() => openCardModal("balance_stock", "Balance Stock Statement (Beer & Brandy Unsold Boxes)")}
          className="p-5 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-emerald-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-emerald-600 font-semibold uppercase tracking-wider flex items-center gap-1">
              Balance Stock (Beer & Brandy) <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className={`text-2xl font-bold mt-2 ${balanceStats.total < 0 ? "text-rose-700" : "text-emerald-900"}`}>
              {Math.round(balanceStats.total).toLocaleString("en-IN")} <span className="text-sm font-normal">Boxes</span>
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs font-semibold text-emerald-800">
              <span className={balanceStats.beer < 0 ? "text-rose-700" : ""}>Beer: {Math.round(balanceStats.beer).toLocaleString("en-IN")}</span>
              <span>•</span>
              <span className={balanceStats.brandy < 0 ? "text-rose-700" : ""}>Brandy: {Math.round(balanceStats.brandy).toLocaleString("en-IN")}</span>
            </div>
          </div>
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl group-hover:scale-105 transition">
            <CheckCircle2 className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Financial & GST Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div 
          onClick={() => openCardModal("purchase_invoice_total", "Purchase Entry Invoice Statement")}
          className="p-5 rounded-2xl bg-blue-50 border border-blue-100 shadow-sm flex items-center justify-between cursor-pointer hover:border-blue-300 hover:shadow-md transition group"
        >
          <div>
            <p className="text-xs text-blue-600 font-semibold uppercase tracking-wider flex items-center gap-1">
              Purchase Total + gst <Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-xl font-bold text-blue-900 mt-2">
              {inr(calculatedPurchaseTotal)}
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
              Sale Invoice Total+ gst<Eye className="h-3 w-3 opacity-0 group-hover:opacity-100 transition" />
            </p>
            <p className="text-xl font-bold text-teal-900 mt-2">
              {inr(calculatedSaleTotal)}
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
              {inr(calculatedSalesGst)}
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
              {inr(calculatedPurchaseGst)}
            </p>
          </div>
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl group-hover:scale-105 transition">
            <Receipt className="h-6 w-6" />
          </div>
        </div>
      </div>

      {/* Entry Records Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm">
            Beer & Brandy Box Entries
          </h3>
          <span className="text-xs text-slate-400 font-medium">Total Entries: {records.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-100">
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Shop No</th>
                <th className="p-3.5">Shop Name</th>
                <th className="p-3.5">Box Breakdown</th>
                <th className="p-3.5 text-right">Beer Qty</th>
                <th className="p-3.5 text-right">Brandy Qty</th>
                <th className="p-3.5 text-right">Total Boxes</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5 text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedRecords.length > 0 ? (
                paginatedRecords.map((item) => {
                  const q = getEntryQty(item);
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5">{item.entry_date || item.date ? new Date(item.entry_date || item.date).toLocaleDateString() : "—"}</td>
                      <td className="p-3.5 font-mono text-cyan-700 font-bold">{item.shop_no || "—"}</td>
                      <td className="p-3.5 font-medium text-slate-900">{item.shop_name || "—"}</td>
                      <td className="p-3.5 font-semibold text-slate-600">{item.box_type || "Box"}</td>
                      <td className="p-3.5 text-right font-bold text-amber-600">{Math.round(q.beer)}</td>
                      <td className="p-3.5 text-right font-bold text-purple-600">{Math.round(q.brandy)}</td>
                      <td className="p-3.5 text-right font-bold text-indigo-600">{q.total}</td>
                      <td className="p-3.5">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          {item.status || "Unsold"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-semibold">{inr(item.total_amount)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" className="p-6 text-center text-slate-400">
                    No records found for the selected date range ({fromDate} to {toDate}).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

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

      {/* DETAIL MODAL WITH PRINT SUPPORT */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-6xl bg-white text-slate-900 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-lg">{modalTitle}</h3>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handlePrintModal}
                  className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition cursor-pointer"
                >
                  <Printer className="h-4 w-4" /> Print A4 Detailed Statement
                </button>
                <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div id="printable-statement-area" className="p-6 overflow-y-auto space-y-4">
              <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-center">
                <div>
                  <h1 className="text-2xl font-black uppercase text-slate-900">AURO PRODUCTS</h1>
                  <p className="text-xs text-slate-600">Industrial Area, Tamil Nadu · GSTIN: 33AAAAA0000A1Z5</p>
                  <p className="text-xs font-bold text-cyan-800 mt-1">{modalTitle} (Detailed Statement)</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-bold">Period: {fromDate} to {toDate}</p>
                  <p className="text-slate-500">Generated: {new Date().toLocaleDateString()}</p>
                </div>
              </div>

              {/* MODAL TYPE: TOTAL PURCHASE */}
              {modalType === "total_purchase" && (
                <div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Shop No</th>
                        <th className="p-2 border-r border-slate-300">Shop Name</th>
                        <th className="p-2 border-r border-slate-300">Box Type</th>
                        <th className="p-2 border-r border-slate-300 text-right">Beer Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Brandy Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Total Qty</th>
                        <th className="p-2 text-right">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((r, i) => {
                        const q = getEntryQty(r);
                        return (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200">{r.entry_date || r.date ? new Date(r.entry_date || r.date).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">{r.shop_no || "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium">{r.shop_name || "—"}</td>
                            <td className="p-2 border-r border-slate-200">{r.box_type || "Box"}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">{Math.round(q.beer)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-purple-700">{Math.round(q.brandy)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold">{q.total}</td>
                            <td className="p-2 text-right font-mono">{inr(r.total_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="4" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-amber-800">{Math.round(purchaseStats.beer).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-purple-800">{Math.round(purchaseStats.brandy).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-indigo-800">{Math.round(purchaseStats.total).toLocaleString("en-IN")} Boxes</td>
                        <td className="p-2 text-right font-mono text-indigo-800">
                          {inr(filteredEntries.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* MODAL TYPE: SOLD BOX */}
              {modalType === "sold_box" && (
                <div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Invoice No</th>
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Party / Company</th>
                        <th className="p-2 border-r border-slate-300 text-right">Beer Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Brandy Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Total Sold Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Taxable Amount</th>
                        <th className="p-2 text-right">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvoices.map((inv, i) => {
                        const invType = (inv.invoice_type || "").toUpperCase();
                        if (invType === "PURCHASE" || invType === "PURCHASE_ENTRY") return null;
                        const q = getInvoiceQty(inv);
                        const taxable = Number(inv.taxable_amount || 0);
                        const total = Number(inv.total_amount || 0);
                        return (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200 font-mono font-bold text-cyan-800">{inv.invoice_no || inv.id}</td>
                            <td className="p-2 border-r border-slate-200">{inv.invoice_date || inv.date ? new Date(inv.invoice_date || inv.date).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium">{inv.party_name || inv.customer_name || "—"}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">{Math.round(q.beer)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-purple-700">{Math.round(q.brandy)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-900">{q.total}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">{inr(taxable)}</td>
                            <td className="p-2 text-right font-mono font-bold">{inr(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="3" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-amber-800">{Math.round(soldStats.beer).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-purple-800">{Math.round(soldStats.brandy).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-amber-900">{Math.round(soldStats.total).toLocaleString("en-IN")} Boxes</td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-amber-800">
                          {inr(filteredInvoices.reduce((s, inv) => s + Number(inv.taxable_amount || 0), 0))}
                        </td>
                        <td className="p-2 text-right font-mono text-amber-800">
                          {inr(filteredInvoices.reduce((s, inv) => s + Number(inv.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* MODAL TYPE: BALANCE STOCK */}
              {modalType === "balance_stock" && (
                <div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Shop No</th>
                        <th className="p-2 border-r border-slate-300">Shop Name</th>
                        <th className="p-2 border-r border-slate-300">Box Breakdown</th>
                        <th className="p-2 border-r border-slate-300 text-right">Beer Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Brandy Qty</th>
                        <th className="p-2 border-r border-slate-300 text-right">Balance Qty</th>
                        <th className="p-2 text-right">Total Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEntries.map((r, i) => {
                        const q = getEntryQty(r);
                        return (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200">{r.entry_date || r.date ? new Date(r.entry_date || r.date).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-mono font-bold">{r.shop_no || "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium text-slate-900">{r.shop_name || "—"}</td>
                            <td className="p-2 border-r border-slate-200">{r.box_type || "Box"}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-amber-700">{Math.round(q.beer)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-purple-700">{Math.round(q.brandy)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-bold text-emerald-700">{q.total}</td>
                            <td className="p-2 text-right font-mono font-bold">{inr(r.total_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="4" className="p-2 text-right border-r border-slate-300 uppercase">Net Balance Stock:</td>
                        <td className="p-2 text-right border-r border-slate-300 text-amber-800">{Math.round(balanceStats.beer).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-purple-800">{Math.round(balanceStats.brandy).toLocaleString("en-IN")}</td>
                        <td className="p-2 text-right border-r border-slate-300 text-emerald-800">{Math.round(balanceStats.total).toLocaleString("en-IN")} Boxes</td>
                        <td className="p-2 text-right font-mono text-emerald-800">
                          {inr(filteredEntries.reduce((s, r) => s + Number(r.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* MODAL TYPE: GST & INVOICE TOTALS */}
              {(modalType === "purchase_invoice_total" || modalType === "purchase_gst" || modalType === "sale_invoice_total" || modalType === "sales_gst") && (
                <div>
                  <table className="w-full text-left text-xs border border-slate-300 border-collapse">
                    <thead>
                      <tr className="bg-slate-100 font-bold border-b border-slate-300">
                        <th className="p-2 border-r border-slate-300">Invoice / Ref No</th>
                        <th className="p-2 border-r border-slate-300">Date</th>
                        <th className="p-2 border-r border-slate-300">Party / Supplier Name</th>
                        <th className="p-2 border-r border-slate-300 text-right">Taxable Amount</th>
                        <th className="p-2 border-r border-slate-300 text-right">GST Amount</th>
                        <th className="p-2 text-right">Total Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(modalType.includes("sale") ? filteredInvoices : filteredEntries).map((item, i) => {
                        const invNo = item.invoice_no || item.shop_no || item.id;
                        const dateStr = item.invoice_date || item.entry_date || item.date || item.created_at;
                        const partyName = item.party_name || item.customer_name || item.shop_name || "—";
                        const taxable = Number(item.taxable_amount || (item.total_amount ? item.total_amount * 0.9 : 0));
                        const total = Number(item.total_amount || 0);
                        const gst = Math.max(0, total - taxable);
                        return (
                          <tr key={i} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-200 font-mono font-bold text-cyan-800">{invNo}</td>
                            <td className="p-2 border-r border-slate-200">{dateStr ? new Date(dateStr).toLocaleDateString() : "—"}</td>
                            <td className="p-2 border-r border-slate-200 font-medium">{partyName}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono">{inr(taxable)}</td>
                            <td className="p-2 border-r border-slate-200 text-right font-mono text-purple-700">{inr(gst)}</td>
                            <td className="p-2 text-right font-mono font-bold">{inr(total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-100 font-bold border-t-2 border-slate-400">
                      <tr>
                        <td colSpan="3" className="p-2 text-right border-r border-slate-300 uppercase">Total:</td>
                        <td className="p-2 text-right border-r border-slate-300 font-mono text-blue-800">
                          {inr((modalType.includes("sale") ? filteredInvoices : filteredEntries).reduce((s, it) => s + Number(it.taxable_amount || (it.total_amount ? it.total_amount * 0.9 : 0)), 0))}
                        </td>
                        <td className="p-2 border-r border-slate-300 font-mono text-blue-800">
                          {inr((modalType.includes("sale") ? filteredInvoices : filteredEntries).reduce((s, it) => s + Math.max(0, Number(it.total_amount || 0) - Number(it.taxable_amount || (it.total_amount ? it.total_amount * 0.9 : 0))), 0))}
                        </td>
                        <td className="p-2 text-right font-mono text-blue-800">
                          {inr((modalType.includes("sale") ? filteredInvoices : filteredEntries).reduce((s, it) => s + Number(it.total_amount || 0), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

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
    </div>
  );
}