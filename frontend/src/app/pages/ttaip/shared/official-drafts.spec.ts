import { TestBed } from '@angular/core/testing';
import { OfficialDocsSectionComponent } from './official-docs-section.component';
import { OfficialPreviewComponent } from './official-preview.component';
import { buildCtx, buildDocWord, buildResolucionBlob, cedulaTexto, resultadoLabel, buildPdf, resolucionArticulos } from './official-docs.util';

function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('R2: borradores sin emisión acreditada', () => {
  it('no obtiene correlativos a partir del expediente ni completa fechas, folios o enlaces', () => {
    const ctx = buildCtx({ expediente: '00024-2026-JUS/TTAIP' }, 'primera');
    expect(ctx.resolucionNro).toBe('—');
    expect(ctx.cedulaNro).toBe('—');
    expect(ctx.fechaResolucion).toBe('No registrada');
    expect(ctx.fechaCedula).toBe('No registrada');
    expect(ctx.folios).toBeNull();
    expect(ctx.driveUrl).toBe('');
  });

  it('no inventa una decisión cuando falta', () => {
    expect(resultadoLabel('primera')).toBe('Decisión no registrada');
  });

  it('identifica como borrador el PDF descargable y conserva el expediente real', async () => {
    const { blob, filename } = buildResolucionBlob('primera', 'admisible', { expediente: '00088-2026-JUS/TTAIP', recurrente: 'Persona sintética' });
    expect(filename).toMatch(/^Borrador_/);
    const text = await readBlob(blob);
    expect(text).toContain('BORRADOR');
    expect(text).toContain('00088-2026-JUS/TTAIP');
    expect(text).not.toContain('VILLEGAS');
  });

  it('identifica Word y no afirma firma digital ni incluye un secretario inventado', async () => {
    const { blob, filename } = buildDocWord('cedula', 'primera', 'admisible', { expediente: '00088-2026-JUS/TTAIP' });
    expect(filename).toMatch(/^Borrador_/);
    const text = await readBlob(blob);
    expect(text).toContain('BORRADOR');
    expect(text).not.toMatch(/Firmado Digitalmente|MORALES DEL/i);
    expect(cedulaTexto('admision', 'recurrente', buildCtx()).map(l => l.text).join(' ')).not.toContain('12 (12) folios');
  });

  it('reservar o emitir sin backend no transforma un borrador en una actuación', () => {
    const fixture = TestBed.createComponent(OfficialDocsSectionComponent);
    fixture.componentRef.setInput('expediente', '00024-2026-JUS/TTAIP');
    fixture.componentRef.setInput('decision', 'admisible');
    fixture.detectChanges();
    const find = (label: string) => Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find(b => b.textContent?.includes(label));
    find('Reservar')?.click();
    fixture.detectChanges();
    find('Emitir')?.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.entries().every(e => !e.numeroCompleto)).toBe(true);
    expect(fixture.nativeElement.textContent).not.toMatch(/EMITIDO|ARCHIVADO|RESERVADO/);
    expect(find('Emitir')?.disabled).toBe(true);
  });

  it('la vista previa no afirma autenticidad ni muestra firmantes predeterminados', () => {
    const fixture = TestBed.createComponent(OfficialPreviewComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Borrador');
    expect(fixture.nativeElement.textContent).not.toMatch(/Firmado digitalmente|VILLEGAS/i);
    fixture.componentInstance.activeDoc.set('cedula-recurrente');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toMatch(/copia auténtica|Firmado digitalmente|MORALES DEL/i);
  });

  it('conserva una referencia registrada del servidor sin calcular otra ni certificar el borrador', async () => {
    const ctx = buildCtx({ expediente: '00088-2026-JUS/TTAIP', resolucionNro: '000199-2026-JUS/TTAIP-PRIMERA SALA', fechaResolucion: '2026-10-20T10:15:00', folios: 9 }, 'final');
    expect(ctx.resolucionNro).toBe('000199-2026-JUS/TTAIP-PRIMERA SALA');
    expect(ctx.fechaResolucion).toBe('2026-10-20T10:15:00');
    const text = await readBlob(buildResolucionBlob('final', 'infundado', ctx).blob);
    expect(text).toContain(ctx.resolucionNro);
    expect(text).toContain('BORRADOR');
    expect(text).not.toMatch(/Firmado Digitalmente|copia autentica/i);
  });

  it('marca cada página del PDF como borrador, también si es extenso', async () => {
    const text = await readBlob(buildPdf(Array.from({ length: 100 }, (_, i) => ({ text: `Línea ${i}` }))));
    expect(text.match(/\/Type\/Page\//g)).toHaveLength(3);
    expect(text.match(/BORRADOR/g)).toHaveLength(3);
  });

  it('no fija el plazo contradictorio del prototipo en una propuesta de cumplimiento', () => {
    const text = resolucionArticulos('final', 'fundado', buildCtx()).join(' ');
    expect(text).not.toContain('diez (10) días');
    expect(text).toContain('pendiente de contraste');
  });

  it.each(['resolucion', 'cedula', 'carta', 'oficio'] as const)('marca el Word %s como borrador sin una firma afirmativa', async tipo => {
    const { blob, filename } = buildDocWord(tipo, 'primera', 'admisible', { expediente: '00088-2026-JUS/TTAIP' });
    expect(filename).toMatch(/^Borrador_/);
    expect(await readBlob(blob)).toContain('BORRADOR');
    expect(await readBlob(blob)).not.toMatch(/Firmado Digitalmente|copia auténtica/i);
  });

  it('un fallo de descarga conserva el borrador y permite reintentar sin confirmar emisión', () => {
    const fixture = TestBed.createComponent(OfficialDocsSectionComponent);
    fixture.componentRef.setInput('expediente', '00024-2026-JUS/TTAIP');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const entry = c.entries()[0];
    const url = vi.spyOn(URL, 'createObjectURL').mockImplementationOnce(() => { throw new Error('Fallo de navegador'); });
    c.descargarPdf(entry);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('No se pudo descargar el borrador');
    expect(entry.estado).toBe('borrador');
    expect(entry.numeroCompleto).toBeUndefined();
    url.mockReturnValue('blob:borrador');
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    c.descargarPdf(entry);
    expect(c.draftError()).toBe('');
    expect(click).toHaveBeenCalledOnce();
    expect(entry.estado).toBe('borrador');
    url.mockRestore(); click.mockRestore();
  });

  it('cambiar de expediente elimina entradas y números previos; rechaza un contexto cruzado', () => {
    const fixture = TestBed.createComponent(OfficialDocsSectionComponent);
    fixture.componentRef.setInput('expediente', '00024-2026-JUS/TTAIP');
    fixture.detectChanges();
    const c = fixture.componentInstance;
    const oldEntry = c.entries()[0];
    c.addFormAsunto = 'Texto anterior';
    fixture.componentRef.setInput('expediente', '00088-2026-JUS/TTAIP');
    fixture.componentRef.setInput('ctx', { expediente: '00024-2026-JUS/TTAIP', recurrente: 'Persona anterior' });
    fixture.detectChanges();
    const url = vi.spyOn(URL, 'createObjectURL');
    c.descargarPdf(oldEntry);
    c.descargarPdf(c.entries()[0]);
    expect(url).not.toHaveBeenCalled();
    expect(c.draftError()).toContain('expediente seleccionado');
    expect(c.addFormAsunto).toBe('');
    url.mockRestore();
  });

  it('la previsualización cambia al nuevo contexto sin conservar otra cédula o numeración', () => {
    const fixture = TestBed.createComponent(OfficialPreviewComponent);
    fixture.componentRef.setInput('ctx', { expediente: '00024-2026-JUS/TTAIP', recurrente: 'Persona anterior', resolucionNro: 'REGISTRADA-24' });
    fixture.detectChanges();
    fixture.componentInstance.activeDoc.set('cedula-entidad');
    fixture.componentInstance.isZoomed.set(true);
    fixture.componentRef.setInput('ctx', { expediente: '00088-2026-JUS/TTAIP', recurrente: 'Persona actual' });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Persona actual');
    expect(fixture.nativeElement.textContent).not.toMatch(/Persona anterior|REGISTRADA-24/);
    expect(fixture.componentInstance.activeDoc()).toBe('resolucion');
    expect(fixture.componentInstance.isZoomed()).toBe(false);
  });
});
