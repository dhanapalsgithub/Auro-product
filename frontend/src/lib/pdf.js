import jsPDF from "jspdf";
import html2canvas from "html2canvas";

export async function downloadElementPdf(elementId, filename, bg = "#ffffff") {
  const el = document.getElementById(elementId);
  if (!el) return;
  const canvas = await html2canvas(el, { scale: 2, backgroundColor: bg, useCORS: true, logging: false });
  const img = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pw) / canvas.width;
  let heightLeft = imgH;
  let pos = 0;
  pdf.addImage(img, "PNG", 0, pos, pw, imgH);
  heightLeft -= ph;
  while (heightLeft > 0) {
    pos -= ph;
    pdf.addPage();
    pdf.addImage(img, "PNG", 0, pos, pw, imgH);
    heightLeft -= ph;
  }
  pdf.save(filename);
}
