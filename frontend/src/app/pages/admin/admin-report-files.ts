import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as XLSX from 'xlsx';

export function downloadFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function csvOf(rows: any[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
}

export function xlsxOf(data: any[], sheet: string, file: string): void {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheet);
  XLSX.writeFile(wb, file);
}

type ReportPdfOptions = { title: string; subtitle?: string; head: string[][]; body: any[][]; foot?: any[][]; file: string };

export function createReportPdf(opts: ReportPdfOptions): jsPDF {
  const d = new jsPDF();
  const pageW = d.internal.pageSize.getWidth();
  const pageH = d.internal.pageSize.getHeight();

  d.setFillColor(200, 16, 46);
  d.rect(0, 0, pageW, 26, 'F');
  d.setTextColor(255, 255, 255);
  d.setFont('helvetica', 'bold');
  d.setFontSize(14);
  d.text('Plataforma SAIP · TTAIP', 14, 12);
  d.setFont('helvetica', 'normal');
  d.setFontSize(10);
  d.text(opts.title, 14, 20);
  d.setFontSize(8);
  d.text(`Generado: ${new Date().toLocaleString('es-PE')}`, pageW - 14, 12, { align: 'right' });
  if (opts.subtitle) d.text(opts.subtitle, pageW - 14, 19, { align: 'right' });

  autoTable(d, {
    startY: 32,
    head: opts.head,
    body: opts.body,
    foot: opts.foot,
    theme: 'striped',
    headStyles: { fillColor: [200, 16, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    footStyles: { fillColor: [244, 232, 235], textColor: [20, 20, 20], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [250, 247, 248] },
    styles: { fontSize: 9, cellPadding: 3 },
    margin: { left: 14, right: 14 },
    didDrawPage: (data: any) => {
      d.setFontSize(8);
      d.setTextColor(130, 130, 130);
      d.text('Exportación de consulta. Sin emisión ni firma oficial.', 14, pageH - 8);
      d.text(`Página ${data.pageNumber}`, pageW - 14, pageH - 8, { align: 'right' });
    },
  });

  return d;
}

export function pdfPro(opts: ReportPdfOptions): void {
  createReportPdf(opts).save(opts.file);
}
