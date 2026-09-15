import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "@/lib/apiClient";
import { fmtDate } from "@/lib/helpers";
import { downloadElementPdf } from "@/lib/pdf";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Printer, Loader2, Download } from "lucide-react";

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
    if (!id) {
      navigate("/invoices");
      return;
    }
    api.get(`/invoices/${id}`).then((r) => setInv(r.data)).catch(() => navigate("/invoices"));
  }, [id, navigate]);

  if (!inv) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-cyan-400" /></div>;

  const s = inv.seller || {};
  const upiStr = s.upi_id
    ? `upi://pay?pa=${encodeURIComponent(s.upi_id)}&pn=${encodeURIComponent(s.name || "Auro Products")}&am=${inv.grand_total || inv.total_amount}&cu=INR&tn=${encodeURIComponent(inv.invoice_no)}`
    : "";

  const itemsList = Array.isArray(inv.items) ? inv.items : (inv.line_items || []);

  // Copies required for standard GST billing
  const copies = [
    { title: "ORIGINAL FOR RECIPIENT", label: "Original" },
    { title: "DUPLICATE FOR TRANSPORTER", label: "Duplicate" },
    { title: "TRIPLICATE FOR SUPPLIER", label: "Triplicate" }
  ];

  return (
    <div>
      <div className="no-print mb-5 flex items-center justify-between">
        <button data-testid="back-to-invoices" onClick={() => navigate("/invoices")} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm hover:bg-white/10 transition">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <button data-testid="print-invoice-button" onClick={() => window.print()} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm hover:bg-white/10 transition">
          <Printer className="h-4 w-4" /> Print
        </button>
        <button data-testid="download-invoice-pdf" onClick={() => downloadElementPdf("invoice-print", `${inv.invoice_no}-triplicate.pdf`, "#ffffff")} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 px-5 py-2 text-sm font-semibold text-slate-900 active:scale-95 transition">
          <Download className="h-4 w-4" /> Download PDF
        </button>
      </div>

      <div className="mx-auto max-w-[820px] space-y-8" id="invoice-print">
        {copies.map((copy, copyIdx) => (
          <div 
            key={copyIdx} 
            className="invoice-sheet rounded-lg p-8 shadow-2xl bg-white text-slate-900 relative overflow-hidden page-break"
            style={{ pageBreakAfter: copyIdx < copies.length - 1 ? "always" : "auto" }}
          >
            {/* Watermark Logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] z-0">
              <img src="/ri-logo2.png" alt="watermark" className="w-[460px] h-[470px] object-contain" />
            </div>

            <div className="relative z-10">
              <div className="text-center border border-black">
                <div className="border-b border-black py-1 text-[11px] font-bold tracking-wider flex justify-between px-3">
                  <span>TAX INVOICE</span>
                  <span className="text-cyan-800 font-mono">{copy.title}</span>
                </div>
                <div className="flex items-center gap-4 p-3">
                  <img src="/ri-logo2.png" alt="logo" className="h-14 w-15 object-cover rounded-full" />
                  <div className="text-left flex-1">
                    <h1 className="text-xl font-bold">{s.name}</h1>
                    <p className="text-[11px] leading-snug">{s.address}</p>
                    <p className="text-[11px]"><b>GSTIN:</b> {s.gstin} &nbsp; <b>State:</b> {s.state} ({s.state_code})</p>
                    {(s.phone || s.email) && <p className="text-[11px]">{s.phone && `Ph: ${s.phone}`} {s.email && ` · ${s.email}`}</p>}
                  </div>
                </div>
              </div>

              <table className="w-full my-2 text-xs border-collapse">
                <tbody>
                  <tr>
                    <td className="w-1/2 align-top border border-black p-2">
                      <b>Invoice No:</b> {inv.invoice_no}<br />
                      <b>Invoice Date:</b> {fmtDate(inv.invoice_date)}<br />
                      <b>Place of Supply:</b> {inv.shop_district || s.state} ({s.state_code})
                    </td>
                    <td className="w-1/2 align-top border border-black p-2">
                      <b>Bill To:</b><br />
                      {inv.shop_no} · {inv.shop_name}<br />
                      {inv.shop_location}<br />
                      TASMAC Wine Shop
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse border border-black">
                <thead>
                  <tr className="font-semibold text-center border-b border-black bg-slate-100">
                    <td className="border-r border-black p-1">#</td>
                    <td className="text-left border-r border-black p-1">Description of Goods</td>
                    <td className="border-r border-black p-1">HSN</td>
                    <td className="border-r border-black p-1">Qty</td>
                    <td className="border-r border-black p-1">Unit</td>
                    <td className="border-r border-black p-1">Rate</td>
                    <td className="p-1">Amount (₹)</td>
                  </tr>
                </thead>
                <tbody>
                  {itemsList.map((it, idx) => (
                    <tr key={idx} className="text-center border-b border-black">
                      <td className="border-r border-black p-1">{idx + 1}</td>
                      <td className="text-left border-r border-black p-1">{it.description || it.item_name}</td>
                      <td className="border-r border-black p-1">{it.hsn || "4819"}</td>
                      <td className="border-r border-black p-1">{it.quantity}</td>
                      <td className="border-r border-black p-1">{it.unit || "PCS"}</td>
                      <td className="border-r border-black p-1 text-right">{Number(it.rate).toFixed(2)}</td>
                      <td className="p-1 text-right">{Number(it.amount || (it.quantity * it.rate)).toFixed(2)}</td>
                    </tr>
                  ))}
                  {itemsList.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center p-4 text-gray-500">No items found in this invoice</td>
                    </tr>
                  )}
                  <tr className="font-semibold border-t border-black"><td colSpan={6} className="text-right border-r border-black p-1">Taxable Value</td><td className="text-right p-1">{Number(inv.taxable || inv.total_amount * 0.95 || 0).toFixed(2)}</td></tr>
                  <tr><td colSpan={6} className="text-right border-r border-black p-1">CGST @ {inv.cgst_percent || 2.5}%</td><td className="text-right p-1">{Number(inv.cgst || 0).toFixed(2)}</td></tr>
                  <tr><td colSpan={6} className="text-right border-r border-black p-1">SGST @ {inv.sgst_percent || 2.5}%</td><td className="text-right p-1">{Number(inv.sgst || 0).toFixed(2)}</td></tr>
                  {inv.round_off !== undefined && inv.round_off !== 0 && <tr><td colSpan={6} className="text-right border-r border-black p-1">Round Off</td><td className="text-right p-1">{Number(inv.round_off).toFixed(2)}</td></tr>}
                  <tr className="font-bold border-t border-black"><td colSpan={6} className="text-right border-r border-black p-1">Total</td><td className="text-right p-1">₹ {Number(inv.grand_total || inv.total_amount || 0).toFixed(2)}</td></tr>
                  {inv.amount_paid > 0 && <>
                    <tr><td colSpan={6} className="text-right border-r border-black p-1">Paid</td><td className="text-right p-1">{Number(inv.amount_paid).toFixed(2)}</td></tr>
                    <tr className="font-semibold"><td colSpan={6} className="text-right border-r border-black p-1">Balance Due</td><td className="text-right p-1">₹ {Number(inv.balance || 0).toFixed(2)}</td></tr>
                  </>}
                </tbody>
              </table>

              <table className="w-full text-xs border-collapse border-x border-b border-black"><tbody><tr><td className="p-2"><b>Amount in Words:</b> {numToWords(inv.grand_total || inv.total_amount || 0)}</td></tr></tbody></table>

              <table className="w-full text-xs border-collapse border-x border-b border-black">
                <tbody>
                  <tr>
                    <td className="w-3/5 align-top border-r border-black p-2">
                      <b>Bank Details:</b><br />
                      {s.bank_name ? <>Bank: {s.bank_name}<br />A/C: {s.account_no}<br />IFSC: {s.ifsc}<br /></> : null}
                      {s.upi_id ? <>UPI: {s.upi_id}</> : (!s.bank_name ? "—" : null)}
                      <div className="mt-2"><b>Terms:</b> {s.terms}</div>
                    </td>
                    <td className="w-2/5 align-top text-center p-2">
                      {upiStr ? (
                        <div className="flex flex-col items-center">
                          <QRCodeCanvas value={upiStr} size={96} includeMargin data-testid={`upi-qr-${copy.label}`} />
                          <span className="text-[10px] mt-1">Scan to pay ₹{Number(inv.grand_total || inv.total_amount || 0).toFixed(2)}</span>
                        </div>
                      ) : <div className="text-[10px] text-gray-500">Set UPI ID in Settings for a payment QR</div>}
                    </td>
                  </tr>
                  <tr>
                    <td className="text-[11px] border-t border-black p-2">&nbsp;</td>
                    <td className="align-bottom text-center text-[11px] border-t border-black p-2"><div className="h-10" /><b>For {s.name}</b><br /><br />Authorised Signatory</td>
                  </tr>
                </tbody>
              </table>
              <p className="text-center text-[10px] mt-2">This is a computer-generated invoice ({copy.label}) &nbsp;|&nbsp; Built by R I Billing Pro</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}