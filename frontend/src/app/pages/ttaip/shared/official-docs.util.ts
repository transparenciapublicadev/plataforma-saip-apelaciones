export type OfficialStage = 'primera' | 'segunda' | 'final';
export type CedulaVariant = 'admision' | 'fundado' | 'otro';
export type CedulaRecipient = 'recurrente' | 'entidad';

export interface DocContext {
  expediente: string;
  recurrente: string;
  recurrenteTipo?: 'natural' | 'juridica';
  entidad: string;
  correo: string;
  direccionEntidad: string;
  sumilla: string;
  fechaResolucion: string;
  fechaCedula: string;
  resolucionNro: string;
  cedulaNro: string;
  folios: number | null;
  driveUrl: string;
  destinatarioDocumento?: string;
  numeroDocumento?: string;
  considerando?: string;
  destinoNotificacion?: string;
  medioNotificacion?: string;
  sala?: 'primera_sala' | 'segunda_sala';
}

export const STAGE_LABEL: Record<OfficialStage, string> = {
  primera: 'Primera calificación',
  segunda: 'Segunda calificación',
  final: 'Resolución final',
};

export const DRAFT_NOTICE = 'BORRADOR — SIN EMISIÓN NI FIRMA VERIFICADA';
export const DRAFT_DETAILS = 'Texto de plantilla para revisión. No acredita notificación, firma digital ni autenticidad. Los datos ausentes deben contrastarse con el expediente.';

export const DEFAULT_CTX: DocContext = {
  expediente: '—',
  recurrente: '—',
  entidad: '—',
  correo: '—',
  direccionEntidad: '—',
  sumilla: 'No registrada',
  fechaResolucion: 'No registrada',
  fechaCedula: 'No registrada',
  resolucionNro: '—',
  cedulaNro: '—',
  folios: null,
  driveUrl: '',
};

/** Contexto del borrador: nunca asigna correlativos ni completa evidencia ausente. */
export function buildCtx(overrides?: Partial<DocContext>, _stage?: OfficialStage): DocContext {
  const supplied = Object.fromEntries(Object.entries(overrides ?? {}).filter(([, v]) => v !== undefined && v !== ''));
  return { ...DEFAULT_CTX, ...supplied };
}

export function resultadoLabel(stage: OfficialStage, decision?: string): string {
  const d = (decision || '').toLowerCase();
  if (stage === 'primera') {
    if (d.startsWith('admi')) return 'ADMITIDO A TRÁMITE';
    if (d.startsWith('inadm')) return 'INADMISIBLE';
    return d.startsWith('improce') ? 'IMPROCEDENTE' : 'Decisión no registrada';
  }
  if (stage === 'segunda') {
    if (d.startsWith('admi')) return 'ADMITIDO A TRÁMITE';
    if (d.startsWith('no_pres') || d.includes('no_presentado')) return 'TENER POR NO PRESENTADO';
    return d.startsWith('improce') ? 'IMPROCEDENTE' : 'Decisión no registrada';
  }
  // final
  if (d === 'fundado' || d === 'fundado_total') return 'FUNDADO';
  if (d.startsWith('fundado')) return 'FUNDADO EN PARTE';
  if (d === 'infundado') return 'INFUNDADO';
  if (d.startsWith('infundado')) return 'INFUNDADO EN PARTE';
  if (d.startsWith('sustrac')) return 'SUSTRACCIÓN DE LA MATERIA';
  if (d.startsWith('desist')) return 'DESISTIMIENTO';
  if (d.startsWith('estese')) return 'ESTÉSE A LO RESUELTO';
  if (d.startsWith('nulidad')) return 'NULIDAD DEL ACTO';
  if (d.startsWith('no_pres') || d.includes('no_presentado')) return 'TENER POR NO PRESENTADO';
  return d.startsWith('improce') ? 'IMPROCEDENTE' : 'Decisión no registrada';
}

export function cedulaVariantForStage(stage: OfficialStage, resultado?: string): CedulaVariant {
  const r = (resultado || '').toLowerCase();
  if (stage === 'final') {
    return r.startsWith('fundado') ? 'fundado' : 'otro';
  }
  return r.startsWith('admi') ? 'admision' : 'otro';
}

export function recipientsForResolution(stage: OfficialStage, decision?: string): CedulaRecipient[] {
  const d = (decision || '').toLowerCase();
  const esInadmisible = (stage === 'primera' || stage === 'segunda') && d.startsWith('inadm');
  return esInadmisible ? ['recurrente'] : ['recurrente', 'entidad'];
}

export function numeroEnLetras(n: number | null): string {
  if (n === null) return 'No registrados';
  const m: Record<number, string> = {
    1: 'un', 2: 'dos', 3: 'tres', 4: 'cuatro', 5: 'cinco', 6: 'seis', 7: 'siete', 8: 'ocho', 9: 'nueve', 10: 'diez',
    11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho',
    19: 'diecinueve', 20: 'veinte', 21: 'veintiuno', 22: 'veintidós', 25: 'veinticinco', 30: 'treinta',
  };
  return m[n] || String(n);
}

export function resolucionArticulos(stage: OfficialStage, decision: string | undefined, ctx: DocContext): string[] {
  const label = resultadoLabel(stage, decision);
  if (label === 'Decisión no registrada') return ['Decisión pendiente de registro; no se propone un resultado por defecto.'];
  const arts: string[] = [];
  if (stage === 'primera') {
    if (label.startsWith('ADMITIDO')) {
      arts.push(`DECLARAR ADMITIDO A TRÁMITE el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}, en el marco del Texto Único Ordenado de la Ley N.° 27806.`);
      arts.push(`REQUERIR a ${ctx.entidad} que, en el plazo de siete (7) días hábiles, remita los descargos e informe documentado sobre lo solicitado por el recurrente.`);
    } else if (label === 'INADMISIBLE') {
      arts.push(`DECLARAR INADMISIBLE el recurso de apelación interpuesto por ${ctx.recurrente}, concediéndole el plazo de dos (2) días hábiles para subsanar las omisiones advertidas, bajo apercibimiento de tenerlo por no presentado.`);
    } else {
      arts.push(`DECLARAR IMPROCEDENTE el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}, por no cumplir los presupuestos previstos en el Texto Único Ordenado de la Ley N.° 27806.`);
    }
  } else if (stage === 'segunda') {
    if (label.startsWith('ADMITIDO')) {
      arts.push(`TENER POR SUBSANADAS las omisiones advertidas y DECLARAR ADMITIDO A TRÁMITE el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}.`);
      arts.push(`REQUERIR a ${ctx.entidad} que, en el plazo de siete (7) días hábiles, remita los descargos correspondientes.`);
    } else if (label.includes('NO PRESENTADO')) {
      arts.push(`HACER EFECTIVO EL APERCIBIMIENTO decretado y TENER POR NO PRESENTADO el recurso de apelación interpuesto por ${ctx.recurrente}, al no haberse subsanado las observaciones formuladas dentro del plazo perentorio.`);
    } else {
      arts.push(`DECLARAR IMPROCEDENTE el recurso de apelación interpuesto por ${ctx.recurrente}, al no haberse subsanado las omisiones advertidas dentro del plazo concedido.`);
    }
  } else {
    // final
    if (label.startsWith('FUNDADO')) {
      const parcial = label.includes('PARTE');
      arts.push(`DECLARAR ${label} el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}, en materia de acceso a la información pública.`);
      arts.push(`ORDENAR a ${ctx.entidad} que entregue al recurrente la información solicitada${parcial ? ' respecto de los extremos declarados fundados' : ''}. Plazo de cumplimiento: pendiente de contraste con el acto registrado; esta plantilla no fija su duración.`);
      arts.push(`DECLARAR agotada la vía administrativa, conforme al Texto Único Ordenado de la Ley N.° 27806.`);
    } else if (label.startsWith('INFUNDADO')) {
      arts.push(`DECLARAR ${label} el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}.`);
      arts.push(`DECLARAR agotada la vía administrativa, conforme al Texto Único Ordenado de la Ley N.° 27806.`);
    } else if (label.includes('SUSTRACCIÓN')) {
      arts.push(`DECLARAR la SUSTRACCIÓN DE LA MATERIA en el recurso de apelación interpuesto por ${ctx.recurrente}, al haberse entregado la información durante el trámite del procedimiento.`);
    } else if (label.includes('DESISTIMIENTO')) {
      arts.push(`ACEPTAR EL DESISTIMIENTO formulado por ${ctx.recurrente} y DAR POR CONCLUIDO el procedimiento.`);
    } else if (label.includes('ESTÉSE')) {
      arts.push(`DECLARAR ESTÉSE A LO RESUELTO previamente por este Tribunal respecto de la controversia planteada.`);
    } else if (label.includes('NULIDAD')) {
      arts.push(`DECLARAR LA NULIDAD DE LO ACTUADO en el procedimiento y RETROTRAER el trámite a la etapa en que se originó el vicio procesal.`);
    } else if (label.includes('NO PRESENTADO')) {
      arts.push(`TENER POR NO PRESENTADO el recurso de apelación formulado por ${ctx.recurrente}.`);
    } else {
      arts.push(`DECLARAR IMPROCEDENTE el recurso de apelación interpuesto por ${ctx.recurrente} contra ${ctx.entidad}.`);
    }
  }
  arts.push(`ENCARGAR a la Secretaría Técnica del Tribunal la notificación de la presente resolución a las partes.`);
  arts.push(`DISPONER la publicación de la presente resolución en el portal institucional del Tribunal de Transparencia y Acceso a la Información Pública.`);
  return arts;
}

export function toAscii(s: string): string {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[“”]/g, '"').replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-').replace(/°/g, 'o').replace(/[^\x20-\x7E]/g, '');
}

export function wrapText(text: string, max = 95): string[] {
  const words = (text || '').split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + ' ' + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

export function buildPdf(lines: { text: string; bold?: boolean; size?: number }[]): Blob {
  const esc = (s: string) => toAscii(s).replace(/([\\()])/g, '\\$1');
  const pageLines: typeof lines[] = [];
  let page: typeof lines = [];
  let y = 0;
  const maxY = 46;
  for (const ln of lines) {
    if (y >= maxY) { pageLines.push(page); page = []; y = 0; }
    page.push(ln); y += 1;
  }
  if (page.length) pageLines.push(page);

  const contentStreams = pageLines.map((pg) => {
    const parts = ['BT', '54 760 Td', '14 TL', '/F2 10 Tf', `(${esc(DRAFT_NOTICE)}) Tj`, 'T*', 'T*'];
    let first = true;
    for (const ln of pg) {
      const size = ln.size ?? (ln.bold ? 12 : 11);
      const font = ln.bold ? '/F2' : '/F1';
      parts.push(`${font} ${size} Tf`);
      if (first) { parts.push(`(${esc(ln.text)}) Tj`); first = false; }
      else { parts.push('T*', `(${esc(ln.text)}) Tj`); }
    }
    parts.push('ET');
    return parts.join('\n');
  });

  const objs: string[] = [];
  const nPages = contentStreams.length;
  const pageObjNums: number[] = [];
  const contentObjNums: number[] = [];
  const objCounter = 2 + nPages * 2;
  const fontRegular = objCounter + 1;
  const fontBold = objCounter + 2;

  objs.push('<</Type/Catalog/Pages 2 0 R>>');
  const kids = pageLines.map((_, i) => `${3 + i * 2} 0 R`).join(' ');
  objs.push(`<</Type/Pages/Kids[${kids}]/Count ${nPages}>>`);
  contentStreams.forEach((cs, i) => {
    const pageNum = 3 + i * 2;
    const contentNum = pageNum + 1;
    pageObjNums.push(pageNum);
    contentObjNums.push(contentNum);
    objs.push(`<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 ${fontRegular} 0 R/F2 ${fontBold} 0 R>>>>/Contents ${contentNum} 0 R>>`);
    objs.push(`<</Length ${cs.length}>>\nstream\n${cs}\nendstream`);
  });
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>');
  objs.push('<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold>>');

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xrefPos = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += String(off).padStart(10, '0') + ' 00000 n \n'; });
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefPos}\n%%EOF`;
  return new Blob([pdf], { type: 'application/pdf' });
}

export function openBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function resolucionTexto(stage: OfficialStage, decision: string | undefined, ctx: DocContext): { text: string; bold?: boolean; size?: number }[] {
  const label = resultadoLabel(stage, decision);
  const L: { text: string; bold?: boolean; size?: number }[] = [];
  const push = (text: string, bold?: boolean, size?: number) => L.push({ text, bold, size });
  const para = (t: string) => wrapText(t).forEach((l) => push(l));
  push('REPUBLICA DEL PERU', false, 10);
  push('Tribunal de Transparencia y Acceso a la Informacion Publica', false, 10);
  push('', false);
  push(`RESOLUCION N.o ${ctx.resolucionNro}`, true, 12);
  push(STAGE_LABEL[stage], false, 10);
  push('', false);
  push(`Expediente N.o : ${ctx.expediente}`);
  push(`Recurrente     : ${ctx.recurrente}`);
  push(`Entidad        : ${ctx.entidad}`);
  push(`Sumilla        : ${ctx.sumilla}`);
  push(`Miraflores, ${ctx.fechaResolucion}`);
  push('', false);
  para(`VISTO: El recurso de apelacion interpuesto por ${ctx.recurrente} contra ${ctx.entidad}; y,`);
  push('', false);
  push('CONSIDERANDO:', true);
  para(`Que, el derecho de acceso a la informacion publica esta reconocido en el numeral 5 del articulo 2 de la Constitucion Politica del Peru y en el Texto Unico Ordenado de la Ley N.o 27806.`);
  if (ctx.considerando) para(ctx.considerando);
  para(`Que, evaluados los actuados, corresponde declarar ${label} el recurso de apelacion.`);
  push('', false);
  push('SE RESUELVE:', true);
  resolucionArticulos(stage, decision, ctx).forEach((a, i) => para(`Articulo ${i + 1}.- ${a}`));
  push('', false);
  push('Registrese, comuniquese y publiquese.');
  push('', false);
  push('Firmantes no disponibles. Sin verificacion de firma digital.');
  return L;
}

export function cedulaTexto(variant: CedulaVariant, recipient: CedulaRecipient, ctx: DocContext): { text: string; bold?: boolean; size?: number }[] {
  const L: { text: string; bold?: boolean; size?: number }[] = [];
  const push = (text: string, bold?: boolean, size?: number) => L.push({ text, bold, size });
  const para = (t: string) => wrapText(t).forEach((l) => push(l));
  const decl = variant === 'admision' ? 'ADMITIDO A TRAMITE' : variant === 'fundado' ? 'FUNDADO' : 'OTRO TIPO DE RESOLUCION';
  push('Ministerio de Justicia y Derechos Humanos', false, 10);
  push('Tribunal de Transparencia y Acceso a la Informacion Publica', false, 10);
  push('', false);
  push(`CEDULA DE NOTIFICACION N.o ${ctx.cedulaNro}`, true, 12);
  push('', false);
  push(`Expediente N.o : ${ctx.expediente}`);
  const trato = recipient === 'recurrente'
    ? (ctx.recurrenteTipo === 'juridica' ? 'Razon social' : 'Senor(a)')
    : 'Entidad';
  push(`${trato.padEnd(14, ' ')}: ${recipient === 'recurrente' ? ctx.recurrente : ctx.entidad}`);
  push(`Domicilio      : ${ctx.destinoNotificacion || (recipient === 'recurrente' ? ctx.correo : ctx.direccionEntidad)}`);
  push('', false);
  para(`Por disposicion del Tribunal de Transparencia y Acceso a la Informacion Publica se propone la notificacion de la RESOLUCION N.o ${ctx.resolucionNro} de fecha ${ctx.fechaResolucion}, la cual declara ${decl} el recurso. Folios: ${ctx.folios === null ? 'No registrados' : `${numeroEnLetras(ctx.folios)} (${ctx.folios})`}.`);
  para(ctx.driveUrl ? `Enlace registrado de los actuados: ${ctx.driveUrl}` : 'Enlace de actuados no disponible.');
  if (variant === 'fundado') para('Finalmente, ponemos en su conocimiento la nota informativa a tener en cuenta en caso de incumplimiento de la entidad respecto de lo ordenado.');
  if (ctx.medioNotificacion) para('Medio registrado: ' + ctx.medioNotificacion + '.');
  push('', false);
  push(`Miraflores, ${ctx.fechaCedula}`);
  push('Secretario tecnico: no disponible. Sin verificacion de firma digital.');
  return L;
}

export function resolucionPdf(action: 'view' | 'download', stage: OfficialStage, decision: string | undefined, ctxIn?: Partial<DocContext>) {
  const ctx = buildCtx(ctxIn, stage);
  const blob = buildPdf(resolucionTexto(stage, decision, ctx));
  if (action === 'view') openBlob(blob);
  else downloadBlob(blob, `Borrador_Resolucion_${ctx.expediente.replace(/[^\w]+/g, '-')}.pdf`);
}

export function buildResolucionBlob(
  stage: OfficialStage,
  decision: string | undefined,
  ctxIn?: Partial<DocContext>
): { blob: Blob; filename: string } {
  const ctx = buildCtx(ctxIn, stage);
  const blob = buildPdf(resolucionTexto(stage, decision, ctx));
  const filename = `Borrador_Resolucion_${ctx.expediente.replace(/[^\w]+/g, '-')}.pdf`;
  return { blob, filename };
}

export function cartaOficioPdf(
  action: 'view' | 'download',
  tipo: 'carta' | 'oficio',
  ctxIn?: Partial<DocContext>
): void {
  const ctx = buildCtx(ctxIn);
  const title = tipo === 'carta' ? 'CARTA OFICIAL TTAIP' : 'OFICIO TTAIP';
  const lines: { text: string; bold?: boolean; size?: number }[] = [
    { text: 'REPUBLICA DEL PERU', bold: false, size: 10 },
    { text: 'Tribunal de Transparencia y Acceso a la Informacion Publica', bold: false, size: 10 },
    { text: '', bold: false },
    { text: `${title} — ${ctx.numeroDocumento || "SIN NUMERACION ASIGNADA"}`, bold: true, size: 12 },
    { text: '', bold: false },
    { text: `Expediente N.o : ${ctx.expediente}` },
    { text: `Destinatario   : ${ctx.destinatarioDocumento || 'No registrado'}` },
    { text: `Fecha          : ${ctx.fechaResolucion}` },
    { text: `Asunto         : ${ctx.sumilla}` },
    { text: '', bold: false },
    { text: 'De nuestra consideracion:', bold: false, size: 11 },
    { text: '', bold: false },
    { text: ctx.sumilla, bold: false, size: 11 },
    { text: '', bold: false },
    { text: 'Atentamente,', bold: false, size: 11 },
    { text: '', bold: false },
    { text: 'Firmante no disponible. Sin verificacion de firma digital.', size: 10 },
  ];
  const blob = buildPdf(lines);
  if (action === 'view') {
    openBlob(blob);
  } else {
    downloadBlob(blob, `Borrador_${tipo === 'carta' ? 'Carta' : 'Oficio'}_${ctx.expediente.replace(/[^\w]+/g, '-')}.pdf`);
  }
}

export function cedulaPdf(action: 'view' | 'download', variant: CedulaVariant, recipient: CedulaRecipient, stage: OfficialStage, ctxIn?: Partial<DocContext>) {
  const ctx = buildCtx(ctxIn, stage);
  const blob = buildPdf(cedulaTexto(variant, recipient, ctx));
  if (action === 'view') openBlob(blob);
  else downloadBlob(blob, `Borrador_Cedula_${ctx.expediente.replace(/[^\w]+/g, '-')}_${recipient === 'recurrente' ? 'Recurrente' : 'Entidad'}.pdf`);
}

export function buildDocWord(
  tipo: 'resolucion' | 'cedula' | 'carta' | 'oficio' | 'oficio-cumplimiento',
  stage: OfficialStage,
  decision: string | undefined,
  ctxIn: Partial<DocContext>,
  recipient: CedulaRecipient = 'recurrente',
): { blob: Blob; filename: string } {
  const ctx = buildCtx(ctxIn, stage);
  let lines: { text: string; bold?: boolean; size?: number }[];
  if (tipo === 'resolucion') {
    lines = resolucionTexto(stage, decision, ctx);
  } else if (tipo === 'cedula') {
    const variant = cedulaVariantForStage(stage, decision);
    lines = cedulaTexto(variant, recipient, ctx);
  } else if (tipo === 'oficio-cumplimiento') {
    lines = [
      { text: 'OFICIO DE CUMPLIMIENTO', bold: true, size: 14 },
      { text: 'Número: ' + (ctx.numeroDocumento || 'Sin numeración asignada') },
      { text: `Entidad: ${ctx.entidad}` },
      { text: 'Destinatario: Tribunal de Transparencia y Acceso a la Información Pública' },
      { text: `Expediente: ${ctx.expediente}` },
      { text: `Resolución: ${ctx.resolucionNro}` },
      { text: `Fecha acreditada de notificación al administrado: ${ctx.fechaCedula}` },
      { text: ctx.sumilla }
    ];
  } else {
    lines = [
      { text: tipo === 'carta' ? 'CARTA OFICIAL TTAIP' : 'OFICIO TTAIP', bold: true, size: 14 },
      { text: 'Número: ' + (ctx.numeroDocumento || 'Sin numeración asignada') },
      { text: `Expediente: ${ctx.expediente}` },
      { text: `Destinatario: ${ctx.destinatarioDocumento || 'No registrado'}` },
      { text: `Fecha: ${ctx.fechaResolucion}` },
      { text: ctx.sumilla }
    ];
  }
  const body = [{ text: DRAFT_NOTICE, bold: true }, { text: DRAFT_DETAILS }, ...lines]
    .map((l) => {
      const style = [
        l.bold ? 'font-weight:bold' : '',
        l.size ? `font-size:${l.size}pt` : 'font-size:11pt',
        'margin:3pt 0',
        'line-height:1.5',
        'text-align:justify',
      ].filter(Boolean).join(';');
      const safe = (l.text || '&nbsp;')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<p style="${style}">${safe}</p>`;
    })
    .join('\n');
  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>
  @page WordSection1 { margin:2.54cm; }
  div.WordSection1 { page:WordSection1; }
  body { font-family:"Times New Roman",Georgia,serif; font-size:11pt; color:#1a1a1a; }
</style>
</head>
<body><div class="WordSection1">${body}</div></body>
</html>`;
  const slug = ctx.expediente.replace(/[^\w]/g, '-');
  const dest = recipient === 'recurrente' ? 'Recurrente' : 'Entidad';
  const filename =
    tipo === 'resolucion' ? `Borrador_Resolucion_${slug}.doc`
    : tipo === 'cedula'   ? `Borrador_Cedula_${slug}_${dest}.doc`
    : tipo === 'carta'    ? `Borrador_Carta_${slug}.doc`
    :                       `Borrador_Oficio_${slug}.doc`;
  return { blob: new Blob([html], { type: 'application/msword' }), filename };
}
