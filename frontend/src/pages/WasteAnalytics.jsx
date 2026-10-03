import React, { useEffect, useState } from "react";
import api from "@/lib/apiClient";
import { PageHeader, Card } from "@/components/Shell";
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
    <div>
      <PageHeader title="Waste Analytics" subtitle="Cotton box waste generated across shops" icon={Scale} />
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-mono">TOTAL BOXES</p>
          <p className="text-2xl font-bold mt-1">{totalBoxes.toLocaleString("en-IN")}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-slate-500 font-mono">TOTAL WASTE</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{totalWaste.toFixed(2)} kg</p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-white/10 font-semibold text-sm">
          Waste Breakdown by Shop
        </div>
        <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
          {(!data?.by_shop || data.by_shop.length === 0) ? (
            <div className="p-4 text-center text-xs text-slate-500">No waste data recorded.</div>
          ) : (
            data.by_shop.map((shop) => (
              <div key={shop.shop_id} className="flex items-center justify-between p-4 hover:bg-white/5 text-xs">
                <div>
                  <p className="font-medium text-white">{shop.shop_no} · {shop.shop_name}</p>
                  <p className="text-slate-500">{shop.boxes} boxes collected</p>
                </div>
                <div className="text-right font-mono text-emerald-300 font-semibold">
                  {Number(shop.waste || 0).toFixed(2)} kg
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}