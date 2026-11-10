import jsPDF from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { BorradorInstitucional, FilaReporte } from '../../services/reportes-institucionales.service';

/**
 * Guarda en el cliente un archivo binario o de texto mediante la creación temporal de un elemento ancla.
 */
export function guardarArchivo(blob: Blob, nombre: string): void {
  if (typeof document === 'undefined') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Serializa la página actual de registros del detalle a CSV delimitado por comas con BOM UTF-8.
 */
export function csvPagina(filas: FilaReporte[]): string {
  const headers = ['Expediente', 'Fecha', 'Entidad', 'Asunto', 'Estado', 'Resultado'];
  const rows = (filas || []).map((f) => [
    f.expediente ?? '',
    f.fecha ?? '',
    f.entidad ?? '',
    f.asunto ?? '',
    f.estado ?? '',
    f.resultado ?? '',
  ]);
  const allRows = [headers, ...rows];
  return '\uFEFF' + allRows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
}

/**
 * Genera y descarga un PDF del borrador guardado con diseño institucional y pie informativo legal.
 */
export async function descargarBorradorPdf(borrador: BorradorInstitucional, activo?: () => boolean): Promise<void> {
  if (activo && !activo()) return;
  const d = new jsPDF();
  const pageW = d.internal.pageSize.getWidth();
  const pageH = d.internal.pageSize.getHeight();

  // Cabecera institucional carmesí y dorado
  d.setFillColor(134, 24, 35);
  d.rect(0, 0, pageW, 26, 'F');
  d.setFillColor(176, 136, 66);
  d.rect(0, 26, pageW, 1.6, 'F');

  d.setTextColor(255, 255, 255);
  d.setFont('helvetica', 'bold');
  d.setFontSize(13);
  const titulo = borrador.modo === 'entidad' ? 'Informe SAIP de la Entidad (Borrador)' : 'Informe Estadístico TTAIP (Borrador)';
  d.text(titulo, 14, 12);

  d.setFont('helvetica', 'normal');
  d.setFontSize(8.5);
  d.text(`Periodo: ${borrador.desde} al ${borrador.hasta} · Versión ${borrador.version}`, 14, 20);
  d.text(`ID: ${borrador.id}`, pageW - 14, 12, { align: 'right' });
  d.text(`Guardado: ${borrador.actualizado ? new Date(borrador.actualizado).toLocaleString('es-PE') : 'No registrado'}`, pageW - 14, 20, { align: 'right' });

  // Tabla Resumen Cuantitativo
  const resumen = borrador.resumen;
  const isTtaip = borrador.modo === 'ttaip';
  const headResumen = [['Métrica', 'Valor']];
  const bodyResumen: (string | number)[][] = isTtaip
    ? [
        ['Total recursos de apelación ingresados', resumen?.total ?? 0],
        ['Recursos con resolución final / actuación', resumen?.conActuacion ?? 0],
        ['Tasa de atención recursal', (resumen?.total ? Math.round(((resumen.conActuacion ?? 0) / resumen.total) * 100) + '%' : '0%')],
        ['Ámbito', resumen?.ambito ?? 'Tribunal TTAIP'],
        ['Entidad / Sala', resumen?.entidad ?? 'Tribunal de Transparencia (Salas 1 y 2)'],
        ['Alcance', resumen?.alcance ?? 'Ámbito recursal nacional'],
      ]
    : [
        ['Total registros del periodo', resumen?.total ?? 0],
        ['Con actuación / respuesta registrada', resumen?.conActuacion ?? 0],
        ['Ámbito', resumen?.ambito ?? ''],
        ['Entidad', resumen?.entidad ?? 'No informada'],
        ['Alcance', resumen?.alcance ?? 'Ámbito institucional autorizado'],
      ];

  autoTable(d, {
    startY: 33,
    head: headResumen,
    body: bodyResumen,
    theme: 'grid',
    headStyles: { fillColor: [134, 24, 35], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 247, 248] },
    styles: { fontSize: 8, cellPadding: 2.2 },
    margin: { left: 14, right: 14 },
  });

  let nextY = (d as any).lastAutoTable?.finalY ? (d as any).lastAutoTable.finalY + 8 : 70;

  // Si es TTAIP y hay resultados o estados desglosados, incluir tabla de sentidos del fallo
  if (isTtaip && (resumen?.resultados?.length || resumen?.estados?.length)) {
    if (nextY > pageH - 45) {
      d.addPage();
      nextY = 20;
    }
    const sentBody: (string | number)[][] = [
      ...(resumen?.resultados || []).map(r => ['Sentido de fallo: ' + r.etiqueta.replaceAll('_', ' '), r.cantidad]),
      ...(resumen?.estados || []).map(e => ['Etapa / Estado: ' + e.etiqueta.replaceAll('_', ' '), e.cantidad]),
    ];
    if (sentBody.length > 0) {
      autoTable(d, {
        startY: nextY,
        head: [['Desglose de Resoluciones y Etapas TTAIP', 'Cantidad'] as any],
        body: sentBody,
        theme: 'grid',
        headStyles: { fillColor: [176, 136, 66], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14, right: 14 },
      });
      nextY = (d as any).lastAutoTable?.finalY ? (d as any).lastAutoTable.finalY + 8 : nextY + 30;
    }
  }

  // Tabla Contenido Cualitativo Declarado
  const cualitativoEntries = Object.entries(borrador.cualitativo || {}).filter(([_, v]) => Boolean(v));
  if (cualitativoEntries.length > 0) {
    if (nextY > pageH - 40) {
      d.addPage();
      nextY = 20;
    }
    autoTable(d, {
      startY: nextY,
      head: [['Campo Cualitativo Declarado', 'Contenido'] as any],
      body: cualitativoEntries.map(([k, v]) => [k, v]),
      theme: 'grid',
      headStyles: { fillColor: [176, 136, 66], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      styles: { fontSize: 7.5, cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 55 } },
      margin: { left: 14, right: 14 },
    });
  }

  // Pie de página legal informativo
  const totalPages = d.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    d.setPage(i);
    d.setDrawColor(228, 222, 224);
    d.line(14, pageH - 12, pageW - 14, pageH - 12);
    d.setFontSize(7);
    d.setTextColor(110, 110, 110);
    d.text('Copia de trabajo. Este borrador no acredita emisión formal ni remisión a la ANTAIP.', 14, pageH - 7);
    d.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 7, { align: 'right' });
  }

  if (activo && !activo()) return;
  d.save(`borrador-${borrador.modo}-${borrador.desde}-${borrador.hasta}.pdf`);
}

/**
 * Genera y descarga un libro Excel (.xlsx) con los datos del borrador institucional y contenido cualitativo.
 */
export async function descargarBorradorExcel(borrador: BorradorInstitucional, activo?: () => boolean): Promise<void> {
  if (activo && !activo()) return;
  const wb = XLSX.utils.book_new();

  // Hoja 1: Resumen y Metadatos
  const resumen = borrador.resumen;
  const isTtaip = borrador.modo === 'ttaip';
  const resumenData: (string | number)[][] = [
    [isTtaip ? 'INFORME ESTADÍSTICO TTAIP (BORRADOR DE TRABAJO)' : 'INFORME INSTITUCIONAL (BORRADOR DE TRABAJO)'],
    ['Ámbito', isTtaip ? 'Tribunal TTAIP (Ámbito Nacional)' : 'Entidad Pública'],
    ['Periodo', `${borrador.desde} al ${borrador.hasta}`],
    ['Versión', borrador.version],
    ['Identificador persistido', borrador.id],
    ['Estado', borrador.estado],
    ['Entidad / Sala', resumen?.entidad ?? (isTtaip ? 'Tribunal TTAIP' : 'No informada')],
    ['Total registros del periodo', resumen?.total ?? 0],
    ['Con actuación / resolución registrada', resumen?.conActuacion ?? 0],
    ['Tasa de atención', (resumen?.total ? Math.round(((resumen.conActuacion ?? 0) / resumen.total) * 100) + '%' : '0%')],
    [],
    [isTtaip ? 'ETAPAS Y ESTADOS DE APELACIONES' : 'ESTADOS REGISTRADOS'],
    ['Estado', 'Cantidad'],
    ...(resumen?.estados || []).map((e) => [e.etiqueta, e.cantidad]),
    [],
    [isTtaip ? 'SENTIDOS DEL FALLO Y PRONUNCIAMIENTOS TTAIP' : 'RESULTADOS / ACTUACIONES'],
    ['Resultado / Sentido', 'Cantidad'],
    ...(resumen?.resultados || []).map((r) => [r.etiqueta, r.cantidad]),
    [],
    ['EVOLUCIÓN MENSUAL'],
    ['Mes', 'Cantidad'],
    ...(resumen?.porMes || []).map((m) => [m.etiqueta, m.cantidad]),
  ];
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenData);
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

  // Hoja 2: Contenido Cualitativo
  const cualitativoData: (string | number)[][] = [
    ['CAMPO CUALITATIVO DECLARADO', 'CONTENIDO'],
    ...Object.entries(borrador.cualitativo || {}).map(([k, v]) => [k, v]),
  ];
  const wsCualitativo = XLSX.utils.aoa_to_sheet(cualitativoData);
  XLSX.utils.book_append_sheet(wb, wsCualitativo, 'Cualitativo');

  if (activo && !activo()) return;
  XLSX.writeFile(wb, `borrador-${borrador.modo}-${borrador.desde}-${borrador.hasta}.xlsx`);
}
