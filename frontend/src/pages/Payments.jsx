import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, X, CreditCard, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/apiClient';

const PAGE_SIZE = 10;

// Safe formatting helper to prevent toLocaleString errors on undefined/null
const safeFormat = (val) => {
  const num = Number(val);
  return isNaN(num) ? '0' : num.toLocaleString();
};

const safeExtractArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
};

export default function PaymentManagement({
  purchaseInvoices: initialPurchase = [],
  salesInvoices: initialSales = [],
  openingBalance: initialOB = 0,
  onRefresh
}) {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('purchase');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(initialOB);
  const [loading, setLoading] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, invoicesRes, paymentsRes, obRes] = await Promise.allSettled([
        api.get('/entries'),
        api.get('/invoices'),
        api.get('/payments'),
        api.get('/settings/opening-balance')
      ]);

      if (entriesRes.status === 'fulfilled') setPurchaseData(safeExtractArray(entriesRes.value.data));
      if (invoicesRes.status === 'fulfilled') setSalesData(safeExtractArray(invoicesRes.value.data));
      if (paymentsRes.status === 'fulfilled') setPaymentsData(safeExtractArray(paymentsRes.value.data));
      if (obRes.status === 'fulfilled') setOpeningBalance(Number(obRes.value.data?.opening_balance || 0));
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    fetchData();
  };

  const paymentsByEntry = useMemo(() => {
    const map = {};
    safeExtractArray(paymentsData).forEach((p) => {
      if (p && p.entry_id) map[p.entry_id] = (map[p.entry_id] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [paymentsData]);

  // FIXED: paymentsByInvoice is now properly defined here
  const paymentsByInvoice = useMemo(() => {
    const map = {};
    safeExtractArray(paymentsData).forEach((p) => {
      if (p && p.invoice_id) map[p.invoice_id] = (map[p.invoice_id] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [paymentsData]);

  const purchaseMetrics = useMemo(() => {
    let totalPurchaseWithGst = 0;
    let runningOpeningBalance = Number(openingBalance || 0);

    const list = safeExtractArray(purchaseData).map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || (inv.id ? `#ENTRY-${inv.id}` : '—');
      const shopNo = inv.shop_no || '—';
      const shopName = inv.shop_name || inv.supplier || inv.name || '—';
      const rawDate = inv.entry_date || inv.date || inv.created_at || 'N/A';
      const wasteKg = Number(inv.waste_kg || 0);
      
      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      
      let openingDeductedValue = runningOpeningBalance;
      if (runningOpeningBalance > 0) {
        runningOpeningBalance = Math.max(0, runningOpeningBalance - totalAmount);
        openingDeductedValue = runningOpeningBalance;
      } else {
        openingDeductedValue = 0;
      }

      const netAfterDeduction = totalAmount;

      const paidFromPayments = paymentsByEntry[inv.id] || 0;
      const paidAmount = Number(inv.amount_paid || paidFromPayments);
      const pendingAmount = Math.max(0, netAfterDeduction - paidAmount);

      totalPurchaseWithGst += netAfterDeduction;

      return {
        ...inv,
        invoice_no: invoiceNo,
        shop_no: shopNo,
        shop_name: shopName,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        raw_date: rawDate,
        totalAmount: netAfterDeduction,
        openingDeducted: openingDeductedValue,
        wasteKg,
        paidAmount,
        pendingAmount,
        type: 'entry'
      };
    }).filter(Boolean);

    // Closing Balance = Opening Balance - Total Purchase Invoices with GST
    const closingBalance = Math.max(0, Number(openingBalance || 0) - totalPurchaseWithGst);
    return { list, totalPurchaseWithGst, closingBalance };
  }, [purchaseData, openingBalance, paymentsByEntry]);

  const salesMetrics = useMemo(() => {
    let totalSaleAmount = 0;
    let totalPaidAmount = 0;

    const list = safeExtractArray(salesData).map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || inv.invoice_id || (inv.id ? `#INV-${inv.id}` : '—');
      const shopNo = inv.shop_no || '—';
      const shopName = inv.shop_name || inv.party_name || inv.customer_name || '—';
      const rawDate = inv.invoice_date || inv.date || inv.created_at || 'N/A';

      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      const paidFromPayments = paymentsByInvoice[inv.id] || 0;
      const paidAmount = Math.max(Number(inv.amount_paid || 0), paidFromPayments);
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      totalSaleAmount += totalAmount;
      totalPaidAmount += paidAmount;

      return {
        ...inv,
        invoice_no: invoiceNo,
        shop_no: shopNo,
        shop_name: shopName,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        raw_date: rawDate,
        totalAmount,
        paidAmount,
        pendingAmount,
        type: 'invoice'
      };
    }).filter(Boolean);

    const totalOutstanding = Math.max(0, totalSaleAmount - totalPaidAmount);
    return { list, totalSaleAmount, totalPaidAmount, totalOutstanding };
  }, [salesData, paymentsByInvoice]);

  const uniqueShops = useMemo(() => {
    const shops = new Set();
    [...purchaseMetrics.list, ...salesMetrics.list].forEach((item) => {
      if (item.shop_name && item.shop_name !== '—') shops.add(item.shop_name);
    });
    return Array.from(shops);
  }, [purchaseMetrics.list, salesMetrics.list]);

  const filteredInvoices = useMemo(() => {
    const currentList = activeTab === 'purchase' ? purchaseMetrics.list : salesMetrics.list;

    return currentList.filter((inv) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        inv.invoice_no.toString().toLowerCase().includes(query) ||
        inv.shop_name.toString().toLowerCase().includes(query) ||
        inv.shop_no.toString().toLowerCase().includes(query);

      const matchesShop = selectedShop === 'All' || inv.shop_name === selectedShop;

      let matchesDate = true;
      if (startDate && inv.raw_date && inv.raw_date !== 'N/A') {
        const itemDate = new Date(inv.raw_date).setHours(0,0,0,0);
        const start = new Date(startDate).setHours(0,0,0,0);
        if (itemDate < start) matchesDate = false;
      }
      if (endDate && inv.raw_date && inv.raw_date !== 'N/A') {
        const itemDate = new Date(inv.raw_date).setHours(0,0,0,0);
        const end = new Date(endDate).setHours(23,59,59,999);
        if (itemDate > end) matchesDate = false;
      }

      return matchesSearch && matchesShop && matchesDate;
    });
  }, [activeTab, purchaseMetrics.list, salesMetrics.list, searchQuery, selectedShop, startDate, endDate]);

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, currentPage]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedInvoice || !paymentAmount || Number(paymentAmount) <= 0) return;

    setSubmittingPayment(true);
    try {
      const payload = {
        shop_id: selectedInvoice.shop_id || null,
        invoice_id: selectedInvoice.type === 'invoice' ? selectedInvoice.id : null,
        entry_id: selectedInvoice.type === 'entry' ? selectedInvoice.id : null,
        invoice_type: activeTab === 'purchase' ? 'PURCHASE_ENTRY' : 'SALE_INVOICE',
        amount: parseFloat(paymentAmount),
        mode: paymentMode,
        notes: paymentNotes || ''
      };

      await api.post('/payments', payload);
      setSelectedInvoice(null);
      setPaymentAmount('');
      setPaymentNotes('');
      fetchData();
    } catch (err) {
      console.error("Error submitting payment:", err);
      alert(err?.response?.data?.detail || "Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment Management</h1>
          <p className="text-sm text-slate-500">Track and settle outstanding balances for Cotton Box entries and Sales Invoices</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {activeTab === 'purchase' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Purchase Invoice (With GST)</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">₹{safeFormat(purchaseMetrics?.totalPurchaseWithGst)}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Opening Balance Amount</p>
            <h2 className="text-2xl font-bold text-amber-600 mt-1">₹{safeFormat(openingBalance)}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Closing Balance</p>
            <h2 className="text-2xl font-bold text-indigo-600 mt-1">₹{safeFormat(purchaseMetrics?.closingBalance)}</h2>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Sale Invoice Amount</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">₹{safeFormat(salesMetrics?.totalSaleAmount)}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Paid Amount</p>
            <h2 className="text-2xl font-bold text-emerald-600 mt-1">₹{safeFormat(salesMetrics?.totalPaidAmount)}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Outstanding Amount</p>
            <h2 className="text-2xl font-bold text-rose-600 mt-1">₹{safeFormat(salesMetrics?.totalOutstanding)}</h2>
          </div>
        </div>
      )}

      {/* FILTERS & TABS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice No, Shop Name, Shop No..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedShop}
            onChange={(e) => { setSelectedShop(e.target.value); setCurrentPage(1); }}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Shops</option>
            {uniqueShops.map((shop, i) => (
              <option key={i} value={shop}>{shop}</option>
            ))}
          </select>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-xs text-slate-500 font-medium">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex border-b border-slate-200 mt-4">
          <button
            onClick={() => { setActiveTab('purchase'); setCurrentPage(1); }}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
              activeTab === 'purchase' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Purchase Invoices / Cotton Box ({purchaseMetrics?.list?.length || 0})
          </button>
          <button
            onClick={() => { setActiveTab('sales'); setCurrentPage(1); }}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
              activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sales Invoices ({salesMetrics?.list?.length || 0})
          </button>
        </div>
      </div>

      {/* HORIZONTAL SCROLLABLE TABLE & PAGINATION */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Invoice No</th>
                <th className="py-3 px-4">Shop No & Name</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Waste (Kg)</th>
                <th className="py-3 px-4">Opening Deducted (Balance)</th>
                <th className="py-3 px-4">Total Amount</th>
                <th className="py-3 px-4">Paid Amount</th>
                <th className="py-3 px-4">Pending Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {paginatedInvoices.length > 0 ? (
                paginatedInvoices.map((inv, idx) => (
                  <tr key={inv.id || idx} className="hover:bg-slate-50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-800">{inv.invoice_no}</td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                      <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded text-indigo-600 font-bold mr-1.5">{inv.shop_no}</span>
                      {inv.shop_name}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{inv.display_date}</td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-medium">{inv.wasteKg} kg</td>
                    <td className="py-3 px-4 text-amber-600 font-medium whitespace-nowrap">₹{safeFormat(inv.openingDeducted)}</td>
                    <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">₹{safeFormat(inv.totalAmount)}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600 whitespace-nowrap">₹{safeFormat(inv.paidAmount)}</td>
                    <td className="py-3 px-4 font-semibold text-rose-600 whitespace-nowrap">₹{safeFormat(inv.pendingAmount)}</td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {inv.pendingAmount <= 0 ? (
                        <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-medium rounded-full text-xs">Paid</span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-medium rounded-full text-xs">Pending</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      {inv.pendingAmount > 0 && (
                        <button
                          onClick={() => { setSelectedInvoice(inv); setPaymentAmount(inv.pendingAmount.toString()); }}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                        >
                          Pay Now
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="10" className="py-8 text-center text-slate-400 font-medium">
                    {loading ? 'Loading invoices...' : 'No invoices found matching the current filter.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION FOOTER */}
        {filteredInvoices.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm">
            <div className="text-slate-500 text-xs">
              Showing <span className="font-semibold text-slate-700">{((currentPage - 1) * PAGE_SIZE) + 1}</span> to <span className="font-semibold text-slate-700">{Math.min(currentPage * PAGE_SIZE, filteredInvoices.length)}</span> of <span className="font-semibold text-slate-700">{filteredInvoices.length}</span> entries
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>
              <span className="text-xs font-semibold text-slate-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PAYMENT MODAL */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800">Record Payment</h3>
              </div>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Target Invoice / Entity</p>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedInvoice.invoice_no} — [{selectedInvoice.shop_no}] {selectedInvoice.shop_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500">Net Amount:</span>
                  <p className="font-bold text-slate-800">₹{safeFormat(selectedInvoice?.totalAmount)}</p>
                </div>
                <div>
                  <span className="text-slate-500">Pending Amount:</span>
                  <p className="font-bold text-rose-600">₹{safeFormat(selectedInvoice?.pendingAmount)}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  max={selectedInvoice.pendingAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Reference No</label>
                <input
                  type="text"
                  placeholder="Txn ID, reference notes..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedInvoice(null)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {submittingPayment ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}