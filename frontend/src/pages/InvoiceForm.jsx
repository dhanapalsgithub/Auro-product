"use client";
import { useState } from "react";

export default function InvoiceForm({ shops, inventoryItems, onSubmit }) {
  const [selectedShop, setSelectedShop] = useState("");
  const [selectedItem, setSelectedItem] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [sellingPrice, setSellingPrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [gstRate, setGstRate] = useState(5);
  const [invoiceType, setInvoiceType] = useState("SALES");

  // ஐட்டம் மாறும்போது விலை மற்றும் அடக்க விலையை செட் செய்ய
  const handleItemChange = (e) => {
    const itemId = e.target.value;
    setSelectedItem(itemId);
    const item = inventoryItems.find((i) => i.id.toString() === itemId);
    if (item) {
      setSellingPrice(item.selling_price || item.unit_price || 0);
      setCostPrice(item.cost_price || 0);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const taxableValue = sellingPrice * quantity;
    const tax_amount = (taxableValue * gstRate) / 100;
    const grand_total = taxableValue + tax_amount;

    const invoiceData = {
      invoice_no: `INV-${Date.now().toString().slice(-8)}`,
      shop_id: selectedShop ? Number(selectedShop) : null,
      customer_name: shops.find(s => (s.shop_id || s.id).toString() === selectedShop)?.name || "Walk-in Customer",
      invoice_type: invoiceType,
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
      items: [{ item_id: selectedItem, quantity, sellingPrice, costPrice, gstRate }]
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

      {/* Item Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700">Select Product / Item</label>
        <select 
          value={selectedItem} 
          onChange={handleItemChange}
          className="w-full mt-1 p-2 border rounded-md"
          required
        >
          <option value="">-- Choose Item --</option>
          {inventoryItems.map((item) => (
            <option key={item.id} value={item.id}>{item.item_name}</option>
          ))}
        </select>
      </div>

      {/* Quantity & Prices */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Quantity</label>
          <input 
            type="number" 
            min="1" 
            value={quantity} 
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-full mt-1 p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {invoiceType === "SALES" ? "Selling Price (₹)" : "Purchase Price (₹)"}
          </label>
          <input 
            type="number" 
            value={sellingPrice} 
            onChange={(e) => setSellingPrice(Number(e.target.value))}
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

      <button type="submit" className="w-full bg-blue-600 text-white p-2 rounded-md font-semibold hover:bg-blue-700">
        Generate {invoiceType === "SALES" ? "Sales" : "Purchase"} Invoice & Update Ledger
      </button>
    </form>
  );
}