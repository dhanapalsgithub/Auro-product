import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { inr, fmtDate } from "@/lib/helpers";
import { ArrowLeft, Printer, Loader2 } from "lucide-react";

// Number to Indian words
function numToWords(num) {
  const a = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  const inWords = (n) => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? " " + a[n % 10] : "");
    if (n < 1000) return a[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " + inWords(n % 100) : "");
    if (n < 100000) return inWords(Math.floor(n / 1000)) + " Thousand" + (n % 1000 ? " " + inWords(n % 1000) : "");
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + " Lakh" + (n % 100000 ? " " + inWords(n % 100000) : "");
    return inWords(Math.floor(n / 10000000)) + " Crore" + (n % 10000000 ? " " + inWords(n % 10000000) : "");
  };
  const rupees = Math.floor(num);
  const paise = Math.round((num - rupees) * 100);
  let words = rupees ? inWords(rupees) + " Rupees" : "Zero Rupees";
  if (paise) words += " and " + inWords(paise) + " Paise";
  return words + " Only";
}

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [inv, setInv] = useState(null);

  useEffect(() => {
    api.get(`/invoices/${id}`).then((r) => setInv(r.data)).catch(() => navigate("/invoices"));
  }, [id, navigate]);

  if (!inv) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>;

  const s = inv.seller || {};

  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between">
        <button data-testid="back-to-invoices" onClick={() => navigate("/invoices")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button data-testid="print-invoice-button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Printer className="h-4 w-4" /> Print / Save PDF
        </button>
      </div>

      <div className="mx-auto max-w-[820px]">
        <div id="invoice-print" className="invoice-sheet rounded-lg p-8 shadow-2xl">
          {/* Header */}
          <div className="text-center border border-black">
            <div className="border-b border-black py-1 text-[11px] font-semibold">TAX INVOICE</div>
            <div className="flex items-center gap-4 p-3">
              <img src="/auro-logo.png" alt="logo" className="h-16 w-16 object-contain" />
              <div className="text-left flex-1">
                <h1 className="text-xl font-bold">{s.name}</h1>
                <p className="text-[11px] leading-snug">{s.address}</p>
                <p className="text-[11px]"><b>GSTIN:</b> {s.gstin} &nbsp; <b>State:</b> {s.state} ({s.state_code})</p>
                {(s.phone || s.email) && <p className="text-[11px]">{s.phone && `Ph: ${s.phone}`} {s.email && ` · ${s.email}`}</p>}
              </div>
            </div>
          </div>

          {/* Invoice meta + buyer */}
          <table className="mt-0">
            <tbody>
              <tr>
                <td className="w-1/2 align-top">
                  <b>Invoice No:</b> {inv.invoice_no}<br />
                  <b>Invoice Date:</b> {fmtDate(inv.invoice_date)}<br />
                  <b>Place of Supply:</b> {inv.shop_district || s.state} ({s.state_code})
                </td>
                <td className="w-1/2 align-top">
                  <b>Bill To:</b><br />
                  {inv.shop_no} · {inv.shop_name}<br />
                  {inv.shop_location}<br />
                  TASMAC Wine Shop
                </td>
              </tr>
            </tbody>
          </table>

          {/* Items */}
          <table>
            <thead>
              <tr className="font-semibold text-center">
                <td>#</td><td className="text-left">Description of Goods</td><td>HSN</td><td>Qty</td><td>Unit</td><td>Rate</td><td>Amount (₹)</td>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((it, idx) => (
                <tr key={idx} className="text-center">
                  <td>{idx + 1}</td>
                  <td className="text-left">{it.description}</td>
                  <td>{it.hsn}</td>
                  <td>{it.quantity}</td>
                  <td>{it.unit}</td>
                  <td className="text-right">{Number(it.rate).toFixed(2)}</td>
                  <td className="text-right">{Number(it.amount).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td colSpan={6} className="text-right">Taxable Value</td>
                <td className="text-right">{inv.taxable.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="text-right">CGST @ {inv.cgst_percent}%</td>
                <td className="text-right">{inv.cgst.toFixed(2)}</td>
              </tr>
              <tr>
                <td colSpan={6} className="text-right">SGST @ {inv.sgst_percent}%</td>
                <td className="text-right">{inv.sgst.toFixed(2)}</td>
              </tr>
              {inv.round_off !== 0 && (
                <tr>
                  <td colSpan={6} className="text-right">Round Off</td>
                  <td className="text-right">{inv.round_off.toFixed(2)}</td>
                </tr>
              )}
              <tr className="font-bold">
                <td colSpan={6} className="text-right">Total</td>
                <td className="text-right">₹ {inv.grand_total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Amount in words */}
          <table>
            <tbody>
              <tr><td><b>Amount in Words:</b> {numToWords(inv.grand_total)}</td></tr>
            </tbody>
          </table>

          {/* Footer */}
          <table>
            <tbody>
              <tr>
                <td className="w-1/2 align-top text-[11px]">
                  <b>Bank Details:</b><br />
                  {s.bank_name ? <>Bank: {s.bank_name}<br />A/C: {s.account_no}<br />IFSC: {s.ifsc}</> : "—"}
                  <div className="mt-2"><b>Terms:</b> {s.terms}</div>
                </td>
                <td className="w-1/2 align-bottom text-center">
                  <div className="h-14" />
                  <b>For {s.name}</b><br /><br />
                  Authorised Signatory
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-center text-[10px] mt-2">This is a computer-generated invoice.</p>
        </div>
      </div>
    </div>
  );
}
