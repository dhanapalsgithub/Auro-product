import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pager({ page, pageCount, total, onPage, testid = "pager" }) {
  if (pageCount <= 1) {
    return (
      <div className="flex items-center justify-between px-1 py-3 text-xs text-slate-500">
        <span data-testid={`${testid}-info`}>{total} record{total === 1 ? "" : "s"}</span>
      </div>
    );
  }
  const nums = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(pageCount, start + 4);
  for (let i = start; i <= end; i++) nums.push(i);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
      <span className="text-xs text-slate-500" data-testid={`${testid}-info`}>
        Page {page} of {pageCount} · {total} records
      </span>
      <div className="flex items-center gap-1">
        <button
          data-testid={`${testid}-prev`}
          disabled={page === 1}
          onClick={() => onPage(page - 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 disabled:opacity-30 hover:bg-white/5 transition"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {nums.map((n) => (
          <button
            key={n}
            data-testid={`${testid}-page-${n}`}
            onClick={() => onPage(n)}
            className={`h-8 min-w-8 rounded-lg px-2 text-sm transition ${
              n === page
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                : "border border-white/10 text-slate-400 hover:bg-white/5"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          data-testid={`${testid}-next`}
          disabled={page === pageCount}
          onClick={() => onPage(page + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-slate-300 disabled:opacity-30 hover:bg-white/5 transition"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
