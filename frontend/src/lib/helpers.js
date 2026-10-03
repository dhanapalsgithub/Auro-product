/**
 * Exports tabular data to a CSV file and triggers a browser download.
 * Includes UTF-8 BOM (\uFEFF) for proper display in Microsoft Excel.
 */
export function exportToCsv(filename, rows, columns) {
  if (!rows || rows.length === 0) return;

  const header = columns.map((c) => `"${(c.label || "").replace(/"/g, '""')}"`).join(",");
  
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          const val = typeof c.accessor === "function" ? c.accessor(row) : row[c.accessor];
          const s = val == null ? "" : String(val).replace(/"/g, '""');
          return `"${s}"`;
        })
        .join(",")
    )
    .join("\r\n");

  const csvContent = "\uFEFF" + header + "\r\n" + body;
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup DOM and release memory
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Formats a number or numeric string as Indian Rupee currency (₹).
 */
export const inr = (n) => {
  const num = Number(n);
  const safeNum = isNaN(num) ? 0 : num;
  return "₹" + safeNum.toLocaleString("en-IN", { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
};

/**
 * Formats an ISO or standard date string into 'DD MMM YYYY' format (en-IN).
 */
export const fmtDate = (iso) => {
  if (!iso) return "—";

  // Prevent UTC offset issues when ISO dates are only YYYY-MM-DD
  const dateObj = typeof iso === "string" && iso.length === 10 ? new Date(`${iso}T00:00:00`) : new Date(iso);

  if (isNaN(dateObj.getTime())) return "—";

  return dateObj.toLocaleDateString("en-IN", { 
    day: "2-digit", 
    month: "short", 
    year: "numeric" 
  });
};