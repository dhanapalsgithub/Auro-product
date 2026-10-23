"use client";
import { useState, useEffect } from "react";

export default function InvoiceForm({ shops, inventoryItems, onSubmit }) {
  const BRANDY_BOX_WEIGHT = 0.420; // 420g
  const BEER_BOX_WEIGHT = 0.220;   // 220g

  const [selectedShop, setSelectedShop] = useState("");
  const [brandyQty, setBrandyQty] = useState(0);
  const [beerQty, setBeerQty] = useState(0);
  const [ratePerKg, setRatePerKg] = useState(16);
  const [gstRate, setGstRate] = useState(5);
  const [invoiceType, setInvoiceType] = useState("SALES");

  // Calculate weights based on default weights
  const grossWeightKg = (brandyQty * BRANDY_BOX_WEIGHT) + (beerQty * BEER_BOX_WEIGHT);
  const calculatedWasteKg = brandyQty * BRANDY_BOX_WEIGHT;
  const netWeightKg = Math.max(0, grossWeightKg - calculatedWasteKg);
  const totalBoxes = Number(brandyQty) + Number(beerQty);

  // Per box rate breakdown for user clarity
  const brandyBoxRate = (BRANDY_BOX_WEIGHT * ratePerKg).toFixed(2);
  const beerBoxRate = (BEER_BOX_WEIGHT * ratePerKg).toFixed(2);

  const handleSubmit = (e) => {
    e.preventDefault();
    const taxableValue = netWeightKg * ratePerKg;
    const tax_amount = (taxableValue * gstRate) / 100;
    const grand_total = taxableValue + tax_amount;

    const invoiceData = {
      invoice_no: `INV-${Date.now().toString().slice(-8)}`,
      shop_id: selectedShop ? Number(selectedShop) : null,
      customer_name: shops.find(s => (s.shop_id || s.id).toString() === selectedShop)?.name || "Walk-in Customer",
      invoice_type: invoiceType,
      total_weight: Number(grossWeightKg.toFixed(2)),
      waste_kg: Number(calculatedWasteKg.toFixed(2)),
      total_amount: taxableValue,
      tax_amount: tax_amount,
      taxable_value: taxableValue,
      cgst_percent: gstRate / 2,
      cgst_amount: tax_amount / 2,
      sgst_percent: gstRate / 2,
      sgst_amount: tax_amount / 2,
      grand_total: grand_total,
      amount_paid: grand_total,
      balance: 0.0,
      status: "Paid",
      items: [
        ...(brandyQty > 0 ? [{ description: "Brandy Cotton Box (420g)", quantity: brandyQty, rate: brandyBoxRate, amount: brandyQty * brandyBoxRate }] : []),
        ...(beerQty > 0 ? [{ description: "Beer Bottle Cotton Box (220g)", quantity: beerQty, rate: beerBoxRate, amount: beerQty * beerBoxRate }] : [])
      ]
    };

    onSubmit(invoiceData);
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 bg-white shadow rounded-lg max-w-xl mx-auto space-y-4">
      <h2 className="text-xl font-bold text-gray-800">
        {invoiceType === "SALES" ? "New Sales Invoice" : "New Purchase Invoice"}
      </h2>
      
      {/* Invoice Type Selection */}
      <div className="flex space-x-6 p-3 bg-gray-50 rounded-md border">
        <label className="flex items-center space-x-2 cursor-pointer">
          <input 
            type="radio" 
            name="invoiceType" 
            value="SALES" 
            checked={invoiceType === "SALES"} 
            onChange={() => setInvoiceType("SALES")} 
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-gray-700">Sales Invoice</span>
        </label>
        <label className="flex items-center space-x-2 cursor-pointer">
          <input 
            type="radio" 
            name="invoiceType" 
            value="PURCHASE" 
            checked={invoiceType === "PURCHASE"} 
            onChange={() => setInvoiceType("PURCHASE")} 
            className="text-blue-600 focus:ring-blue-500"
          />
          <span className="font-medium text-gray-700">Purchase Invoice</span>
        </label>
      </div>

      {/* Shop Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Select Shop / Customer</label>
        <select 
          value={selectedShop} 
          onChange={(e) => setSelectedShop(e.target.value)}
          className="w-full mt-1 p-2 border rounded-md"
          required
        >
          <option value="">-- Choose Shop --</option>
          {shops.map((shop) => (
            <option key={shop.shop_id || shop.id} value={shop.shop_id || shop.id}>
              {shop.shop_name || shop.name}
            </option>
          ))}
        </select>
      </div>

      {/* Quantity & Weight Input */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Brandy Box Qty (420g / box)</label>
          <input 
            type="number" 
            min="0" 
            value={brandyQty} 
            onChange={(e) => setBrandyQty(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Beer Box Qty (220g / box)</label>
          <input 
            type="number" 
            min="0" 
            value={beerQty} 
            onChange={(e) => setBeerQty(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded-md"
          />
        </div>
      </div>

      {/* Rate & GST */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Rate per KG (₹)</label>
          <input 
            type="number" 
            value={ratePerKg} 
            onChange={(e) => setRatePerKg(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">GST %</label>
          <select 
            value={gstRate} 
            onChange={(e) => setGstRate(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded-md"
          >
            <option value={5}>5%</option>
            <option value={12}>12%</option>
            <option value={18}>18%</option>
            <option value={28}>28%</option>
          </select>
        </div>
      </div>

      {/* Calculated Breakdown Display with Waste Deduction */}
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md text-xs space-y-1 text-blue-900">
        <p className="font-semibold">Weight & Waste Deduction Breakdown:</p>
        <p>• Gross Weight: <strong>{grossWeightKg.toFixed(2)} kg</strong> ({totalBoxes} Total Boxes)</p>
        <p className="text-amber-700">• Less Brandy Waste Deduction: <strong>-{calculatedWasteKg.toFixed(2)} kg</strong> ({brandyQty} Brandy boxes @ 420g)</p>
        <p className="font-bold text-blue-950">• Net Billable Weight: <strong>{netWeightKg.toFixed(2)} kg</strong></p>
        <p>• Brandy Box Rate: <strong>₹{brandyBoxRate}</strong> / box (0.42 kg × ₹{ratePerKg})</p>
        <p>• Beer Box Rate: <strong>₹{beerBoxRate}</strong> / box (0.22 kg × ₹{ratePerKg})</p>
      </div>

      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-semibold hover:bg-blue-700">
        Generate {invoiceType === "SALES" ? "Sales" : "Purchase"} Invoice & Update Ledger
      </button>
    </form>
  );
}