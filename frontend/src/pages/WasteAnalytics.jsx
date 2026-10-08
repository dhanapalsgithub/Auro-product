import React, { useEffect, useState } from "react";
import api from "../lib/apiClient";
import { Scale } from "lucide-react";

export default function WasteAnalytics() {
  const [data, setData] = useState({ by_shop: [], by_month: [], by_type_month: [] });

  useEffect(() => { 
    api.get("/analytics/waste")
      .then((r) => setData(r.data))
      .catch(() => {}); 
  }, []);

  const totalWaste = (data?.by_shop || []).reduce((s, r) => s + (Number(r.waste) || 0), 0);
  const totalBoxes = (data?.by_shop || []).reduce((s, r) => s + (Number(r.boxes) || 0), 0);

  return (
    <div className="p-6 min-h-screen bg-slate-50 text-slate-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2.5 rounded-2xl bg-cyan-100 text-cyan-700">
          <Scale className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Waste Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Cotton box waste generated across shops
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Total Boxes
          </p>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {totalBoxes.toLocaleString("en-IN")}
          </p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Total Waste
          </p>
          <p className="text-2xl font-bold text-emerald-600 mt-2">
            {totalWaste.toFixed(2)} kg
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 font-semibold text-sm text-slate-800 bg-slate-50">
          Waste Breakdown by Shop
        </div>

        <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
          {(!data?.by_shop || data.by_shop.length === 0) ? (
            <div className="p-6 text-center text-xs text-slate-400">
              No waste data recorded.
            </div>
          ) : (
            data.by_shop.map((shop) => (
              <div
                key={shop.shop_id}
                className="flex items-center justify-between p-4 hover:bg-slate-50 text-sm transition"
              >
                <div>
                  <p className="font-semibold text-slate-800">
                    {shop.shop_no} · {shop.shop_name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {shop.boxes} boxes collected
                  </p>
                </div>
                <div className="text-right font-semibold text-emerald-600">
                  {Number(shop.waste || 0).toFixed(2)} kg
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}