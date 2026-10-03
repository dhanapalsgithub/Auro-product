import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, X, CreditCard } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const safeExtractArray = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  return [];
};

const PaymentManagement = ({
  purchaseInvoices: initialPurchase = [],
  salesInvoices: initialSales = [],
  openingBalance: initialOB = 0,
  onRefresh
}) => {
  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase' | 'sales'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Internal state
  const [purchaseData, setPurchaseData] = useState(safeExtractArray(initialPurchase));
  const [salesData, setSalesData] = useState(safeExtractArray(initialSales));
  const [paymentsData, setPaymentsData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(initialOB);
  const [loading, setLoading] = useState(false);

  // Modal State for Payment
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Sync internal state with props if provided
  useEffect(() => {
    setPurchaseData(safeExtractArray(initialPurchase));
  }, [initialPurchase]);

  useEffect(() => {
    setSalesData(safeExtractArray(initialSales));
  }, [initialSales]);

  useEffect(() => {
    setOpeningBalance(initialOB);
  }, [initialOB]);

  // Comprehensive Auto-Fetch
  const fetchData = async () => {
    setLoading(true);
    try {
      const [entriesRes, invoicesRes, paymentsRes, obRes] = await Promise.all([
        fetch(`${API_BASE}/api/entries`),
        fetch(`${API_BASE}/api/invoices`),
        fetch(`${API_BASE}/api/payments`),
        fetch(`${API_BASE}/api/settings/opening-balance`)
      ]);

      if (entriesRes.ok) {
        const entries = await entriesRes.json();
        setPurchaseData(safeExtractArray(entries));
      }

      if (invoicesRes.ok) {
        const invoices = await invoicesRes.json();
        setSalesData(safeExtractArray(invoices));
      }

      if (paymentsRes.ok) {
        const payments = await paymentsRes.json();
        setPaymentsData(safeExtractArray(payments));
      }

      if (obRes.ok) {
        const obData = await obRes.json();
        setOpeningBalance(Number(obData.opening_balance || 0));
      }
    } catch (err) {
      console.error("Failed to load invoice/payment data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    fetchData();
  };

  // Map payments by invoice_id and entry_id
  const paymentsByEntry = useMemo(() => {
    const map = {};
    const safePayments = safeExtractArray(paymentsData);
    safePayments.forEach((p) => {
      if (p && p.entry_id) {
        map[p.entry_id] = (map[p.entry_id] || 0) + Number(p.amount || 0);
      }
    });
    return map;
  }, [paymentsData]);

  const paymentsByInvoice = useMemo(() => {
    const map = {};
    const safePayments = safeExtractArray(paymentsData);
    safePayments.forEach((p) => {
      if (p && p.invoice_id) {
        map[p.invoice_id] = (map[p.invoice_id] || 0) + Number(p.amount || 0);
      }
    });
    return map;
  }, [paymentsData]);

  // --- Purchase Metrics ---
  const purchaseMetrics = useMemo(() => {
    let totalPurchaseWithGst = 0;
    const safePurchases = safeExtractArray(purchaseData);

    const list = safePurchases.map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || (inv.id ? `#ENTRY-${inv.id}` : '—');
      const shopName = inv.shop_name || inv.supplier || inv.name || inv.customer_name || '—';
      const rawDate = inv.entry_date || inv.date || inv.created_at || 'N/A';
      
      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      
      const paidFromPayments = paymentsByEntry[inv.id] || 0;
      const paidAmount = Number(inv.amount_paid || inv.paid_amount || paidFromPayments);
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      totalPurchaseWithGst += totalAmount;

      return {
        ...inv,
        invoice_no: invoiceNo,
        shop_name: shopName,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        raw_date: rawDate,
        totalAmount,
        paidAmount,
        pendingAmount,
        type: 'entry'
      };
    }).filter(Boolean);

    const closingBalance = openingBalance + totalPurchaseWithGst;

    return { list, totalPurchaseWithGst, closingBalance };
  }, [purchaseData, openingBalance, paymentsByEntry]);

  // --- Sales Metrics ---
  const salesMetrics = useMemo(() => {
    let totalSaleAmount = 0;
    let totalPaidAmount = 0;
    const safeSales = safeExtractArray(salesData);

    const list = safeSales.map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || inv.invoice_id || (inv.id ? `#INV-${inv.id}` : '—');
      const shopName = inv.shop_name || inv.party_name || inv.customer_name || inv.customer || '—';
      const rawDate = inv.invoice_date || inv.date || inv.created_at || 'N/A';

      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      
      const paidFromPayments = paymentsByInvoice[inv.id] || 0;
      const paidAmount = Math.max(
        Number(inv.amount_paid || inv.received_amount || inv.paid_amount || 0),
        paidFromPayments
      );
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      totalSaleAmount += totalAmount;
      totalPaidAmount += paidAmount;

      return {
        ...inv,
        invoice_no: invoiceNo,
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

  // Extract distinct shop names
  const uniqueShops = useMemo(() => {
    const shops = new Set();
    [...purchaseMetrics.list, ...salesMetrics.list].forEach((item) => {
      if (item.shop_name && item.shop_name !== '—') shops.add(item.shop_name);
    });
    return Array.from(shops);
  }, [purchaseMetrics.list, salesMetrics.list]);

  // Filtered List based on Search & Select Inputs
  const filteredInvoices = useMemo(() => {
    const currentList = activeTab === 'purchase' ? purchaseMetrics.list : salesMetrics.list;

    return currentList.filter((inv) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        inv.invoice_no.toString().toLowerCase().includes(query) ||
        inv.shop_name.toString().toLowerCase().includes(query);

      const matchesShop = selectedShop === 'All' || inv.shop_name === selectedShop;

      let matchesDate = true;
      if (startDate && inv.raw_date !== 'N/A') {
        matchesDate = matchesDate && new Date(inv.raw_date) >= new Date(startDate);
      }
      if (endDate && inv.raw_date !== 'N/A') {
        matchesDate = matchesDate && new Date(inv.raw_date) <= new Date(endDate);
      }

      return matchesSearch && matchesShop && matchesDate;
    });
  }, [activeTab, purchaseMetrics.list, salesMetrics.list, searchQuery, selectedShop, startDate, endDate]);

  // Submit Payment Action
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
        payment_date: new Date().toISOString(),
        notes: paymentNotes
      };

      const res = await fetch(`${API_BASE}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSelectedInvoice(null);
        setPaymentAmount('');
        setPaymentNotes('');
        fetchData();
      } else {
        const errorData = await res.json();
        alert(`Payment error: ${errorData.detail || 'Failed to submit payment'}`);
      }
    } catch (err) {
      console.error("Error submitting payment:", err);
      alert("Failed to record payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Payment Management</h1>
          <p className="text-sm text-slate-500">
            Track and settle outstanding balances for Cotton Box entries and Sales Invoices
          </p>
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

      {/* Summary Cards */}
      {activeTab === 'purchase' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Purchase Invoice (With GST)</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">₹{purchaseMetrics.totalPurchaseWithGst.toLocaleString()}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Opening Balance Amount</p>
            <h2 className="text-2xl font-bold text-amber-600 mt-1">₹{openingBalance.toLocaleString()}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Closing Balance</p>
            <h2 className="text-2xl font-bold text-indigo-600 mt-1">₹{purchaseMetrics.closingBalance.toLocaleString()}</h2>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Sale Invoice Amount</p>
            <h2 className="text-2xl font-bold text-slate-800 mt-1">₹{salesMetrics.totalSaleAmount.toLocaleString()}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Total Paid Amount</p>
            <h2 className="text-2xl font-bold text-emerald-600 mt-1">₹{salesMetrics.totalPaidAmount.toLocaleString()}</h2>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase">Outstanding Amount</p>
            <h2 className="text-2xl font-bold text-rose-600 mt-1">₹{salesMetrics.totalOutstanding.toLocaleString()}</h2>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Invoice No, Shop Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <select
            value={selectedShop}
            onChange={(e) => setSelectedShop(e.target.value)}
            className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="All">All Shops</option>
            {uniqueShops.map((shop, i) => (
              <option key={i} value={shop}>{shop}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 mt-4">
          <button
            onClick={() => setActiveTab('purchase')}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
              activeTab === 'purchase'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Purchase Invoices / Cotton Box ({purchaseMetrics.list.length})
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`pb-3 px-4 text-sm font-semibold transition border-b-2 ${
              activeTab === 'sales'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            Sales Invoices ({salesMetrics.list.length})
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-4">Invoice No</th>
              <th className="py-3 px-4">Shop Name</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Opening Amount</th>
              <th className="py-3 px-4">Total Amount</th>
              <th className="py-3 px-4">
                {activeTab === 'purchase' ? 'Paid Amount' : 'Received Amount'}
              </th>
              <th className="py-3 px-4">Pending Amount</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {filteredInvoices.length > 0 ? (
              filteredInvoices.map((inv, idx) => (
                <tr key={inv.id || idx} className="hover:bg-slate-50 transition">
                  <td className="py-3 px-4 font-semibold text-slate-800">{inv.invoice_no}</td>
                  <td className="py-3 px-4 text-slate-700">{inv.shop_name}</td>
                  <td className="py-3 px-4 text-slate-500">{inv.display_date}</td>
                  <td className="py-3 px-4 text-slate-600 font-medium">
                    ₹{(inv.opening_balance_deducted || inv.opening_balance || openingBalance || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">
                    ₹{inv.totalAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-emerald-600">
                    ₹{inv.paidAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-rose-600">
                    ₹{inv.pendingAmount.toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    {inv.pendingAmount <= 0 ? (
                      <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-medium rounded-full text-xs">
                        Paid
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-medium rounded-full text-xs">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {inv.pendingAmount > 0 && (
                      <button
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setPaymentAmount(inv.pendingAmount.toString());
                        }}
                        className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition ${
                          activeTab === 'purchase'
                            ? 'bg-indigo-600 hover:bg-indigo-700'
                            : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {activeTab === 'purchase' ? 'Pay Now' : 'Receive Payment'}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" className="py-6 text-center text-slate-400 font-medium">
                  {loading ? 'Loading invoices...' : 'No invoices found matching the current filter.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Payment Processing Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800">
                  {activeTab === 'purchase' ? 'Record Payment' : 'Receive Payment'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="p-4 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase font-semibold">Target Invoice / Entity</p>
                <p className="text-sm font-semibold text-slate-800">
                  {selectedInvoice.invoice_no} — {selectedInvoice.shop_name}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg text-xs">
                <div>
                  <span className="text-slate-500">Total Amount:</span>
                  <p className="font-bold text-slate-800">₹{selectedInvoice.totalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-slate-500">Pending Amount:</span>
                  <p className="font-bold text-rose-600">₹{selectedInvoice.pendingAmount.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Payment Amount (₹)
                </label>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Payment Mode
                </label>
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
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Notes / Reference No
                </label>
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
};

export default PaymentManagement;