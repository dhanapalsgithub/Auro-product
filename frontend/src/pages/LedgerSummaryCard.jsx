export default function LedgerSummaryCard({ data }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
      {/* Opening Balance */}
      <div className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg">
        <p className="text-sm font-medium text-gray-500">Opening Balance</p>
        <h3 className="text-2xl font-bold text-gray-800 mt-1">₹{data.openingBalance?.toFixed(2) || "0.00"}</h3>
      </div>

      {/* Revenue */}
      <div className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg">
        <p className="text-sm font-medium text-gray-500">Total Revenue</p>
        <h3 className="text-2xl font-bold text-blue-600 mt-1">₹{data.totalRevenue?.toFixed(2) || "0.00"}</h3>
      </div>

      {/* Net Profit */}
      <div className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg">
        <p className="text-sm font-medium text-gray-500">Net Profit</p>
        <h3 className="text-2xl font-bold text-green-600 mt-1">₹{data.netProfit?.toFixed(2) || "0.00"}</h3>
      </div>

      {/* Outstanding (Closing Balance) */}
      <div className="p-4 bg-white border border-gray-200 shadow-sm rounded-lg">
        <p className="text-sm font-medium text-gray-500">Outstanding Balance</p>
        <h3 className="text-2xl font-bold text-red-600 mt-1">₹{data.closingBalance?.toFixed(2) || "0.00"}</h3>
      </div>
    </div>
  );
}