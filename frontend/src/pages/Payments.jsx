import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { Search, RefreshCw, X, CreditCard, ChevronLeft, ChevronRight, Printer, Trash2, Edit3 } from 'lucide-react';
import api from '@/lib/apiClient';

const PAGE_SIZE = 10;

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

export default function PaymentManagement({ onRefresh }) {
  const location = useLocation();

  const [activeTab, setActiveTab] = useState('purchase'); // 'purchase', 'sales', 'penalty', 'history'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedShop, setSelectedShop] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const [purchaseData, setPurchaseData] = useState([]);
  const [salesData, setSalesData] = useState([]);
  const [paymentsData, setPaymentsData] = useState([]);
  const [openingBalance, setOpeningBalance] = useState(0);
  const [loading, setLoading] = useState(false);

  // Bulk Payment Modal State
  const [isBulkPaymentOpen, setIsBulkPaymentOpen] = useState(false);
  const [bulkAmount, setBulkAmount] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('UPI');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState({});

  // Edit Payment Modal State
  const [editingPayment, setEditingPayment] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editMode, setEditMode] = useState('UPI');
  const [editNotes, setEditNotes] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [entriesRes, invoicesRes, paymentsRes, obRes] = await Promise.allSettled([
        api.get('/entries'),
        api.get('/invoices'),
        api.get('/payments'),
        api.get('/settings/opening-balance-breakdown')
      ]);

      if (entriesRes.status === 'fulfilled') setPurchaseData(safeExtractArray(entriesRes.value.data));
      if (invoicesRes.status === 'fulfilled') setSalesData(safeExtractArray(invoicesRes.value.data));
      if (paymentsRes.status === 'fulfilled') setPaymentsData(safeExtractArray(paymentsRes.value.data));
      
      if (obRes.status === 'fulfilled' && obRes.value.data) {
        const initialOb = Number(obRes.value.data.initial_opening_balance ?? obRes.value.data.opening_balance ?? 0);
        setOpeningBalance(isNaN(initialOb) ? 0 : initialOb);
      }
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

  const paymentsByInvoice = useMemo(() => {
    const map = {};
    safeExtractArray(paymentsData).forEach((p) => {
      if (p && p.invoice_id) map[p.invoice_id] = (map[p.invoice_id] || 0) + Number(p.amount || 0);
    });
    return map;
  }, [paymentsData]);

  const paymentHistoryList = useMemo(() => {
    return safeExtractArray(paymentsData).map((p) => {
      const rawDate = p.payment_date || p.created_at || 'N/A';
      const invNo = p.invoice_no || (p.invoice_id ? `#INV-${p.invoice_id}` : (p.entry_id ? `#ENTRY-${p.entry_id}` : (p.invoice_type === 'PENALTY' ? '#PENALTY' : '—')));
      return {
        ...p,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        amount: Number(p.amount || 0),
        mode: p.mode || 'UPI',
        notes: p.notes || '—',
        invoice_no: invNo,
        raw_date: rawDate
      };
    });
  }, [paymentsData]);

  const penaltyList = useMemo(() => {
    return paymentHistoryList.filter(p => p.mode === 'Penalty' || p.invoice_type === 'PENALTY');
  }, [paymentHistoryList]);

  const totalPenaltyAmount = useMemo(() => {
    return penaltyList.reduce((sum, p) => sum + p.amount, 0);
  }, [penaltyList]);

  const purchaseMetrics = useMemo(() => {
    let totalPurchaseWithGst = 0;
    let runningOpeningBalance = Number(openingBalance || 0);

    const rawList = safeExtractArray(purchaseData).map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || (inv.id ? `#ENTRY-${inv.id}` : '—');
      const shopNo = inv.shop_no || '—';
      const shopName = inv.shop_name || inv.supplier || inv.name || '—';
      const rawDate = inv.entry_date || inv.date || inv.created_at || 'N/A';
      const wasteKg = Number(inv.waste_kg || 0);
      const brandyQty = Number(inv.brandy_qty || 0);
      const beerQty = Number(inv.beer_qty || 0);
      
      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      const paidFromPayments = paymentsByEntry[inv.id] || 0;
      const paidAmount = Number(inv.amount_paid || paidFromPayments);
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      return {
        ...inv,
        idNum: Number(inv.id || 0),
        uniqueKey: `entry-${inv.id}`,
        invoice_no: invoiceNo,
        shop_no: shopNo,
        shop_name: shopName,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        raw_date: rawDate,
        totalAmount,
        wasteKg,
        brandyQty,
        beerQty,
        paidAmount,
        pendingAmount,
        type: 'entry'
      };
    }).filter(Boolean);

    rawList.sort((a, b) => {
      const dateA = a.raw_date !== 'N/A' ? new Date(a.raw_date).getTime() : 0;
      const dateB = b.raw_date !== 'N/A' ? new Date(b.raw_date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.idNum - b.idNum;
    });

    const list = rawList.map((inv) => {
      let openingDeductedValue = runningOpeningBalance;
      if (runningOpeningBalance > 0) {
        runningOpeningBalance = Math.max(0, runningOpeningBalance - inv.totalAmount);
        openingDeductedValue = runningOpeningBalance;
      } else {
        openingDeductedValue = 0;
      }
      totalPurchaseWithGst += inv.totalAmount;
      return { ...inv, openingDeducted: openingDeductedValue };
    });

    return { list, totalPurchaseWithGst };
  }, [purchaseData, openingBalance, paymentsByEntry]);

  const remainingOpeningBalancePool = useMemo(() => {
    const totalPurchase = purchaseMetrics.totalPurchaseWithGst || 0;
    return Math.max(0, Number(openingBalance || 0) - totalPurchase - totalPenaltyAmount);
  }, [openingBalance, purchaseMetrics.totalPurchaseWithGst, totalPenaltyAmount]);

  const salesMetrics = useMemo(() => {
    let totalSaleAmount = 0;
    let totalPaidAmount = 0;
    let runningOpeningBalance = Number(openingBalance || 0);

    const rawList = safeExtractArray(salesData).map((inv) => {
      if (!inv) return null;
      const invoiceNo = inv.invoice_no || inv.invoice_id || (inv.id ? `#INV-${inv.id}` : '—');
      const shopNo = inv.shop_no || '—';
      const shopName = inv.shop_name || inv.party_name || inv.customer_name || '—';
      const rawDate = inv.invoice_date || inv.date || inv.created_at || 'N/A';
      const wasteKg = Number(inv.waste_kg || 0);

      const totalAmount = Number(inv.total_amount || inv.grand_total || inv.amount || 0);
      const paidFromPayments = paymentsByInvoice[inv.id] || 0;
      const paidAmount = Math.max(Number(inv.amount_paid || 0), paidFromPayments);
      const pendingAmount = Math.max(0, totalAmount - paidAmount);

      totalSaleAmount += totalAmount;
      totalPaidAmount += paidAmount;

      return {
        ...inv,
        idNum: Number(inv.id || 0),
        uniqueKey: `invoice-${inv.id}`,
        invoice_no: invoiceNo,
        shop_no: shopNo,
        shop_name: shopName,
        display_date: rawDate !== 'N/A' ? new Date(rawDate).toLocaleDateString() : 'N/A',
        raw_date: rawDate,
        totalAmount,
        wasteKg,
        paidAmount,
        pendingAmount,
        type: 'invoice'
      };
    }).filter(Boolean);

    rawList.sort((a, b) => {
      const dateA = a.raw_date !== 'N/A' ? new Date(a.raw_date).getTime() : 0;
      const dateB = b.raw_date !== 'N/A' ? new Date(b.raw_date).getTime() : 0;
      if (dateA !== dateB) return dateA - dateB;
      return a.idNum - b.idNum;
    });

    const list = rawList.map((inv) => {
      let openingDeductedValue = runningOpeningBalance;
      if (runningOpeningBalance > 0) {
        runningOpeningBalance = Math.max(0, runningOpeningBalance - inv.totalAmount);
        openingDeductedValue = runningOpeningBalance;
      } else {
        openingDeductedValue = 0;
      }
      return { ...inv, openingDeducted: openingDeductedValue };
    });

    const totalOutstanding = Math.max(0, totalSaleAmount - totalPaidAmount);
    return { list, totalSaleAmount, totalPaidAmount, totalOutstanding };
  }, [salesData, openingBalance, paymentsByInvoice]);

  const uniqueShops = useMemo(() => {
    const shops = new Set();
    [...purchaseMetrics.list, ...salesMetrics.list].forEach((item) => {
      if (item.shop_name && item.shop_name !== '—') shops.add(item.shop_name);
    });
    return Array.from(shops);
  }, [purchaseMetrics.list, salesMetrics.list]);

  const filteredInvoices = useMemo(() => {
    if (activeTab === 'history' || activeTab === 'penalty') {
      const targetList = activeTab === 'penalty' ? penaltyList : paymentHistoryList;
      return targetList.filter((p) => {
        const query = searchQuery.trim().toLowerCase();
        const matchesSearch =
          !query ||
          String(p.invoice_no || '').toLowerCase().includes(query) ||
          String(p.notes || '').toLowerCase().includes(query) ||
          String(p.mode || '').toLowerCase().includes(query);

        let matchesDate = true;
        if (startDate && p.raw_date && p.raw_date !== 'N/A') {
          const itemDate = new Date(p.raw_date).setHours(0,0,0,0);
          const start = new Date(startDate).setHours(0,0,0,0);
          if (itemDate < start) matchesDate = false;
        }
        if (endDate && p.raw_date && p.raw_date !== 'N/A') {
          const itemDate = new Date(p.raw_date).setHours(0,0,0,0);
          const end = new Date(endDate).setHours(23,59,59,999);
          if (itemDate > end) matchesDate = false;
        }

        return matchesSearch && matchesDate;
      });
    }

    const currentList = activeTab === 'purchase' ? purchaseMetrics.list : salesMetrics.list;

    return currentList.filter((inv) => {
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        String(inv.invoice_no || '').toLowerCase().includes(query) ||
        String(inv.shop_name || '').toLowerCase().includes(query) ||
        String(inv.shop_no || '').toLowerCase().includes(query);

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
  }, [activeTab, purchaseMetrics.list, salesMetrics.list, paymentHistoryList, penaltyList, searchQuery, selectedShop, startDate, endDate]);

  const totalPages = Math.ceil(filteredInvoices.length / PAGE_SIZE) || 1;
  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredInvoices.slice(start, start + PAGE_SIZE);
  }, [filteredInvoices, currentPage]);

  const bulkDistributionPreview = useMemo(() => {
    let remaining = parseFloat(bulkAmount) || 0;
    const currentList = activeTab === 'purchase' ? purchaseMetrics.list : salesMetrics.list;
    const hasAnySelected = Object.values(selectedBulkIds).some(Boolean);
    
    return currentList.map((inv) => {
      const pending = inv.pendingAmount;
      const isSelected = hasAnySelected ? !!selectedBulkIds[inv.uniqueKey] : true;

      if (!isSelected || remaining <= 0 || pending <= 0) {
        return { ...inv, appliedAmount: 0, newPending: pending, statusText: pending <= 0 ? 'Settled' : (!isSelected ? 'Unselected' : 'Unchanged') };
      }
      const toApply = Math.min(remaining, pending);
      remaining -= toApply;
      const newPending = Math.max(0, pending - toApply);
      return {
        ...inv,
        appliedAmount: toApply,
        newPending,
        statusText: newPending === 0 ? 'Settled' : `Remaining: ₹${newPending}`
      };
    });
  }, [bulkAmount, activeTab, purchaseMetrics.list, salesMetrics.list, selectedBulkIds]);

  const handleBulkPaymentSubmit = async (e) => {
    e.preventDefault();
    let remaining = parseFloat(bulkAmount) || 0;
    const penalty = parseFloat(penaltyAmount) || 0;
    if (remaining <= 0 && penalty <= 0) return;

    setSubmittingPayment(true);
    try {
      for (const item of bulkDistributionPreview) {
        if (item.appliedAmount > 0) {
          const payAmt = item.appliedAmount;
          const payload = {
            shop_id: item.shop_id || null,
            invoice_id: item.type === 'invoice' ? item.id : null,
            entry_id: item.type === 'entry' ? item.id : null,
            invoice_type: activeTab === 'purchase' ? 'PURCHASE_ENTRY' : 'SALE_INVOICE',
            amount: payAmt,
            mode: paymentMode,
            payment_date: paymentDate,
            notes: paymentNotes || 'Bulk payment added to opening balance'
          };

          await api.post('/payments', payload);
        }
      }

      if (penalty > 0) {
        const penaltyPayload = {
          shop_id: null,
          invoice_id: null,
          entry_id: null,
          invoice_type: 'PENALTY',
          amount: penalty,
          mode: 'Penalty',
          payment_date: paymentDate,
          notes: paymentNotes ? `Penalty: ${paymentNotes}` : 'Penalty Deducted'
        };
        await api.post('/payments', penaltyPayload);
      }

      setIsBulkPaymentOpen(false);
      setBulkAmount('');
      setPenaltyAmount('');
      setPaymentNotes('');
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setSelectedBulkIds({});
      fetchData();
    } catch (err) {
      console.error("Error submitting bulk payment:", err);
      alert(err?.response?.data?.detail || "Failed to record bulk payment.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  const handleDeletePayment = async (paymentId) => {
    if (!confirm("Are you sure you want to delete this payment record?")) return;
    try {
      await api.delete(`/payments/${paymentId}`);
      fetchData();
    } catch (err) {
      console.error("Failed to delete payment:", err);
      alert("Failed to delete payment.");
    }
  };

  const handleEditPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!editingPayment || !editAmount) return;

    try {
      await api.delete(`/payments/${editingPayment.id}`);
      const payload = {
        shop_id: editingPayment.shop_id || null,
        invoice_id: editingPayment.invoice_id || null,
        entry_id: editingPayment.entry_id || null,
        invoice_type: editingPayment.invoice_type || 'SALE_INVOICE',
        amount: parseFloat(editAmount),
        mode: editMode,
        notes: editNotes
      };
      await api.post('/payments', payload);

      setEditingPayment(null);
      fetchData();
    } catch (err) {
      console.error("Failed to update payment:", err);
      alert("Failed to update payment.");
    }
  };

  const handlePrintA4 = () => {
    const rowsList = filteredInvoices;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up blocked! Please allow pop-ups for printing.");
      return;
    }

    const rowsHtml = rowsList.map((inv, idx) => `
      <tr>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${idx + 1}</td>
        <td style="border: 1px solid black; padding: 6px; font-weight: bold;">${inv.invoice_no || `#${inv.id}`}</td>
        <td style="border: 1px solid black; padding: 6px;">${inv.shop_name || inv.notes || '—'}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${inv.display_date || inv.raw_date || '—'}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; font-weight: bold;">₹${safeFormat(inv.totalAmount || inv.amount)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; color: #047857; font-weight: bold;">₹${safeFormat(inv.paidAmount || 0)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: right; color: #b91c1c; font-weight: bold;">₹${safeFormat(inv.pendingAmount || 0)}</td>
        <td style="border: 1px solid black; padding: 6px; text-align: center;">${inv.invoice_type === 'PENALTY' || inv.mode === 'Penalty' ? 'Penalty Deduction' : (inv.pendingAmount <= 0 ? 'Paid' : 'Pending')}</td>
      </tr>
    `).join("");

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Auro Products - Payment & Penalty History Report</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #000; }
            h1 { text-align: center; font-size: 18px; text-transform: uppercase; margin-bottom: 4px; }
            p { text-align: center; font-size: 12px; color: #333; margin: 2px 0 15px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 11px; }
            th { background: #f3f4f6; border: 1px solid black; padding: 6px; text-align: left; text-transform: uppercase; font-size: 10px; }
            .summary { border: 2px solid black; padding: 12px; margin-top: 20px; background: #f9fafb; font-size: 12px; border-radius: 6px; }
            .summary-row { display: flex; justify-content: space-between; padding: 4px 0; }
          </style>
        </head>
        <body>
          <h1>Auro Products Billing Suite</h1>
          <p>Penalty & Opening Balance Deduction Report (${activeTab.toUpperCase()})</p>
          <p style="font-weight: bold; color: #1e40af;">Generated on: ${new Date().toLocaleString()}</p>
          
          <div class="summary" style="margin-bottom: 15px;">
            <div class="summary-row"><span>Initial Opening Balance:</span><strong>₹${safeFormat(openingBalance)}</strong></div>
            <div class="summary-row" style="color: #4b5563; border-top: 1px solid #e5e7eb;"><span>Total Purchase Deduction:</span><strong>₹${safeFormat(purchaseMetrics?.totalPurchaseWithGst)}</strong></div>
            <div class="summary-row" style="color: #b91c1c; border-top: 1px solid #e5e7eb;"><span>Total Penalty Deducted:</span><strong>₹${safeFormat(totalPenaltyAmount)}</strong></div>
            <div class="summary-row" style="color: #d97706; border-top: 2px solid #000; font-size: 13px; font-weight: bold; padding-top: 6px;"><span>Remaining Opening Balance Pool:</span><strong>₹${safeFormat(remainingOpeningBalancePool)}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="text-align: center;">#</th>
                <th>Invoice / ID</th>
                <th>Shop Name / Notes</th>
                <th style="text-align: center;">Date</th>
                <th style="text-align: right;">Amount</th>
                <th style="text-align: right;">Paid</th>
                <th style="text-align: right;">Pending</th>
                <th style="text-align: center;">Type / Status</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="8" style="text-align:center; padding: 10px;">No records found</td></tr>'}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(printContent);
    printWindow.document.close();

    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };

    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  return (
    <div className="p-3 sm:p-6 bg-slate-50 min-h-screen">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .printable-report, .printable-report * {
            visibility: visible;
          }
          .printable-report {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            background: white;
            padding: 20px;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      {/* HEADER & ACTION BUTTONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Payment Management</h1>
          <p className="text-xs sm:text-sm text-slate-500">Track, settle outstanding balances, edit & delete payments, and print A4 reports</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsBulkPaymentOpen(true)}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 bg-indigo-600 text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
          >
            <CreditCard className="w-4 h-4" /> Bulk Payment
          </button>
          <button
            onClick={handlePrintA4}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-700 hover:bg-slate-50 transition shadow-sm"
          >
            <Printer className="w-4 h-4" /> Print Summary
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs sm:text-sm font-medium text-slate-600 hover:bg-slate-50 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="no-print">
        {activeTab === 'purchase' ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Initial Opening Balance</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">₹{safeFormat(openingBalance)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Purchase Invoice (With GST)</p>
              <h2 className="text-xl sm:text-2xl font-bold text-indigo-600 mt-1">₹{safeFormat(purchaseMetrics?.totalPurchaseWithGst)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Penalty Deducted</p>
              <h2 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">₹{safeFormat(totalPenaltyAmount)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Remaining Opening Balance Pool</p>
              <h2 className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">₹{safeFormat(remainingOpeningBalancePool)}</h2>
            </div>
          </div>
        ) : activeTab === 'sales' ? (
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Sale Invoice Amount</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">₹{safeFormat(salesMetrics?.totalSaleAmount)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Initial Opening Balance</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-700 mt-1">₹{safeFormat(openingBalance)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Penalty Deducted</p>
              <h2 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">₹{safeFormat(totalPenaltyAmount)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Remaining Opening Balance Pool</p>
              <h2 className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">₹{safeFormat(remainingOpeningBalancePool)}</h2>
            </div>
          </div>
        ) : activeTab === 'penalty' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Penalty Records</p>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{penaltyList.length} Records</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Penalty Amount Deducted</p>
              <h2 className="text-xl sm:text-2xl font-bold text-rose-600 mt-1">₹{safeFormat(totalPenaltyAmount)}</h2>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Remaining Opening Balance Pool</p>
              <h2 className="text-xl sm:text-2xl font-bold text-amber-600 mt-1">₹{safeFormat(remainingOpeningBalancePool)}</h2>
            </div>
          </div>
        ) : null}

        {/* FILTERS & TABS */}
        <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-sm mb-6">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 mb-4">
            {/* <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Invoice No, Shop Name, Notes..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div> */}
{/* 
            {activeTab !== 'history' && activeTab !== 'penalty' && (
              <select
                value={selectedShop}
                onChange={(e) => { setSelectedShop(e.target.value); setCurrentPage(1); }}
                className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="All">All Shops</option>
                {uniqueShops.map((shop, i) => (
                  <option key={i} value={shop}>{shop}</option>
                ))}
              </select>
            )} */}

            <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="flex border-b border-slate-200 overflow-x-auto whitespace-nowrap">
            <button
              onClick={() => { setActiveTab('purchase'); setCurrentPage(1); }}
              className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
                activeTab === 'purchase' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Purchase Invoices / Cotton Box ({purchaseMetrics?.list?.length || 0})
            </button>
            <button
              onClick={() => { setActiveTab('sales'); setCurrentPage(1); }}
              className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
                activeTab === 'sales' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Sales Invoices ({salesMetrics?.list?.length || 0})
            </button>
            <button
              onClick={() => { setActiveTab('penalty'); setCurrentPage(1); }}
              className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
                activeTab === 'penalty' ? 'border-rose-600 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Penalty Records ({penaltyList.length})
            </button>
            <button
              onClick={() => { setActiveTab('history'); setCurrentPage(1); }}
              className={`pb-3 px-4 text-xs sm:text-sm font-semibold transition border-b-2 shrink-0 ${
                activeTab === 'history' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              Payment History & Bulk Records ({paymentHistoryList.length})
            </button>
          </div>
        </div>
      </div>

      {/* TABLE VIEW */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden no-print">
        <div className="overflow-x-auto">
          {activeTab === 'history' || activeTab === 'penalty' ? (
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Payment ID</th>
                  <th className="py-3 px-4">Invoice / Entry No</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Mode</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Notes / Remarks</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((p, idx) => (
                    <tr key={p.id || idx} className="hover:bg-slate-50 transition">
                      <td className="py-3 px-4 font-semibold text-slate-800">#{p.id}</td>
                      <td className="py-3 px-4 font-mono text-xs font-bold text-indigo-600">{p.invoice_no}</td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{p.display_date}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.mode === 'Penalty' || p.invoice_type === 'PENALTY' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>
                          {p.mode}
                        </span>
                      </td>
                      <td className={`py-3 px-4 font-bold whitespace-nowrap ${p.mode === 'Penalty' || p.invoice_type === 'PENALTY' ? 'text-rose-600' : 'text-emerald-600'}`}>
                        ₹{safeFormat(p.amount)}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{p.notes}</td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => {
                              setEditingPayment(p);
                              setEditAmount(p.amount.toString());
                              setEditMode(p.mode);
                              setEditNotes(p.notes);
                            }}
                            className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="py-8 text-center text-slate-400 font-medium">
                      {loading ? 'Loading records...' : (activeTab === 'penalty' ? 'No penalty records found.' : 'No payment history found.')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  <th className="py-3 px-4">Invoice No</th>
                  <th className="py-3 px-4">Shop No & Name</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">{activeTab === 'purchase' ? 'Brandy Qty' : 'Waste (Kg)'}</th>
                  <th className="py-3 px-4">{activeTab === 'purchase' ? 'Beer Qty' : 'Opening Deducted'}</th>
                  <th className="py-3 px-4">{activeTab === 'purchase' ? 'Waste (Kg)' : 'Total Amount'}</th>
                  {activeTab === 'purchase' && <th className="py-3 px-4">Opening Deducted</th>}
                  {activeTab === 'purchase' && <th className="py-3 px-4">Total Amount</th>}
                  <th className="py-3 px-4">Paid Amount</th>
                  <th className="py-3 px-4">Pending Amount</th>
                  <th className="py-3 px-4">Status</th>
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
                      {activeTab === 'purchase' ? (
                        <>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">{inv.brandyQty || 0}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">{inv.beerQty || 0}</td>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">{inv.wasteKg} kg</td>
                          <td className="py-3 px-4 text-amber-600 font-medium whitespace-nowrap">₹{safeFormat(inv.openingDeducted)}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">₹{safeFormat(inv.totalAmount)}</td>
                        </>
                      ) : (
                        <>
                          <td className="py-3 px-4 text-slate-600 font-medium whitespace-nowrap">{inv.wasteKg} kg</td>
                          <td className="py-3 px-4 text-amber-600 font-medium whitespace-nowrap">₹{safeFormat(inv.openingDeducted)}</td>
                          <td className="py-3 px-4 font-bold text-slate-800 whitespace-nowrap">₹{safeFormat(inv.totalAmount)}</td>
                        </>
                      )}
                      <td className="py-3 px-4 font-semibold text-emerald-600 whitespace-nowrap">₹{safeFormat(inv.paidAmount)}</td>
                      <td className="py-3 px-4 font-semibold text-rose-600 whitespace-nowrap">₹{safeFormat(inv.pendingAmount)}</td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {inv.pendingAmount <= 0 ? (
                          <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 font-medium rounded-full text-xs">Paid</span>
                        ) : (
                          <span className="px-2.5 py-1 bg-amber-100 text-amber-700 font-medium rounded-full text-xs">Pending</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="11" className="py-8 text-center text-slate-400 font-medium">
                      {loading ? 'Loading invoices...' : 'No invoices found matching the current filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* PAGINATION FOOTER */}
        {filteredInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50 text-sm no-print">
            <div className="text-slate-500 text-xs text-center sm:text-left">
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

      {/* BULK PAYMENT MODAL */}
      {isBulkPaymentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Record Bulk Payment ({activeTab.toUpperCase()})</h3>
              <button onClick={() => setIsBulkPaymentOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkPaymentSubmit} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Bulk Payment Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount to distribute"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Penalty Deduction Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="Deduct from opening balance"
                    value={penaltyAmount}
                    onChange={(e) => setPenaltyAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-rose-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="UPI">UPI</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g., Monthly clearing settlement"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Automatic Distribution Preview (FIFO)</p>
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <th className="p-2.5">Invoice / Entry</th>
                        <th className="p-2.5">Shop Name</th>
                        <th className="p-2.5 text-right">Pending</th>
                        <th className="p-2.5 text-right">Applying</th>
                        <th className="p-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bulkDistributionPreview.map((item, idx) => (
                        <tr key={idx} className={item.appliedAmount > 0 ? 'bg-indigo-50/50 font-medium' : ''}>
                          <td className="p-2.5 font-mono">{item.invoice_no}</td>
                          <td className="p-2.5">{item.shop_name}</td>
                          <td className="p-2.5 text-right font-bold text-rose-600">₹{safeFormat(item.pendingAmount)}</td>
                          <td className="p-2.5 text-right font-bold text-emerald-600">₹{safeFormat(item.appliedAmount)}</td>
                          <td className="p-2.5 text-slate-500">{item.statusText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsBulkPaymentOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingPayment}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
                >
                  {submittingPayment ? 'Processing...' : 'Confirm Bulk Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT PAYMENT MODAL */}
      {editingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-200 bg-slate-50">
              <h3 className="font-bold text-slate-800 text-lg">Edit Payment #{editingPayment.id}</h3>
              <button onClick={() => setEditingPayment(null)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditPaymentSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode</label>
                <select
                  value={editMode}
                  onChange={(e) => setEditMode(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="UPI">UPI</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Penalty">Penalty</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Notes / Remarks</label>
                <input
                  type="text"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setEditingPayment(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition shadow-sm"
                >
                  Update Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE REPORT VIEW */}
      <div className="hidden print:block printable-report bg-white p-6">
        <div className="mb-4 pb-4 border-b border-slate-300">
          <h2 className="text-2xl font-bold text-slate-900">Auro Products - Payment & Penalty History Report</h2>
          <p className="text-xs text-slate-600 mt-1">
            Generated on: {new Date().toLocaleString()} | Active Tab: {activeTab.toUpperCase()}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs">
          <div>
            <span className="font-semibold text-slate-500 uppercase">Initial Opening Balance:</span>
            <div className="text-sm font-bold text-slate-900">₹{safeFormat(openingBalance)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Total Purchase Deduction:</span>
            <div className="text-sm font-bold text-indigo-700">₹{safeFormat(purchaseMetrics?.totalPurchaseWithGst)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Total Penalty Deducted:</span>
            <div className="text-sm font-bold text-rose-600">₹{safeFormat(totalPenaltyAmount)}</div>
          </div>
          <div>
            <span className="font-semibold text-slate-500 uppercase">Remaining Opening Balance Pool:</span>
            <div className="text-sm font-bold text-amber-600">₹{safeFormat(remainingOpeningBalancePool)}</div>
          </div>
        </div>

        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 font-bold text-slate-800">
              <th className="p-2">Invoice / ID</th>
              <th className="p-2">Shop Name / Notes</th>
              <th className="p-2">Date</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Paid</th>
              <th className="p-2 text-right">Pending</th>
              <th className="p-2">Type / Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-4 text-center text-slate-400">
                  No records found.
                </td>
              </tr>
            ) : (
              filteredInvoices.map((inv, idx) => (
                <tr key={idx}>
                  <td className="p-2 font-bold">{inv.invoice_no || `#${inv.id}`}</td>
                  <td className="p-2">{inv.shop_name || inv.notes || '—'}</td>
                  <td className="p-2">{inv.display_date || inv.raw_date || '—'}</td>
                  <td className="p-2 text-right font-bold">₹{safeFormat(inv.totalAmount || inv.amount)}</td>
                  <td className="p-2 text-right text-emerald-700">₹{safeFormat(inv.paidAmount || 0)}</td>
                  <td className="p-2 text-right text-rose-700 font-bold">₹{safeFormat(inv.pendingAmount || 0)}</td>
                  <td className="p-2">{inv.invoice_type === 'PENALTY' || inv.mode === 'Penalty' ? 'Penalty Deduction' : (inv.pendingStatus <= 0 ? 'Paid' : 'Pending')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}