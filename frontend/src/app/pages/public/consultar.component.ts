import { ChangeDetectionStrategy, Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  LucideAlertTriangle, LucideArchive, LucideArrowLeft, LucideArrowRight, LucideBuilding2,
  LucideCalendar, LucideCheckCircle2, LucideClock, LucideEye, LucideFileText,
  LucideSearch, LucideShield, LucideXCircle,
} from '@lucide/angular';
import { ConsultaPublicaSolicitud, SolicitudService } from '../../services/solicitud.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { TimelineComponent, TimelineEvent } from '../../shared/timeline.component';
import { CaptchaPoWComponent } from '../../shared/captcha-pow.component';
import { EstadoConsulta, falloConsulta } from '../../utils/consulta-remota.util';

type EstadoPublico = ConsultaPublicaSolicitud['estado'];
const NUMERO_SAIP = /^SAIP-\d{4}-\d{5,}$/;
const NUMERO_TTAIP = /^\d{5,}-\d{4}-JUS\/TTAIP$/;
const ESTADOS: Record<EstadoPublico, string> = {
  EN_PROCESO: 'En Proceso', RESPONDIDA: 'Respondida', APELADA: 'Apelada',
  DENEGADA: 'Denegada', VENCIDA: 'Vencida', ARCHIVADA: 'Archivada',
};
interface ConsultaResultado {
  expediente: string;
  expedienteSaip: string | null;
  codigoConsultado: string;
  consultaTtaip: boolean;
  estado: EstadoPublico;
  ciudadano: string | null;
  entidad: string | null;
  fechaPresentacion: string | null;
  diasTranscurridos: number | null;
  apelacionExpediente: string | null;
  apelacionEstado: string | null;
  apelacionFecha: string | null;
  resolucionResultado: string | null;
  timeline: TimelineEvent[];
  faltantes: string[];
}

@Component({
  selector: 'app-consultar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, LucideAlertTriangle, LucideArchive, LucideArrowLeft, LucideArrowRight,
    LucideBuilding2, LucideCalendar, LucideCheckCircle2, LucideClock, LucideEye,
    LucideFileText, LucideSearch, LucideShield, LucideXCircle, StatusBadgeComponent, TimelineComponent, CaptchaPoWComponent],
  templateUrl: './consultar.component.html',
  styleUrl: './consultar.component.css',
})
export class ConsultarComponent implements OnDestroy {
  private readonly solicitudService = inject(SolicitudService);
  readonly query = signal('');
  readonly estadoConsulta = signal<EstadoConsulta | 'inicial' | 'incompleta' | 'limite'>('inicial');
  readonly buscando = computed(() => this.estadoConsulta() === 'cargando');
  readonly resultado = signal<ConsultaResultado | null>(null);
  readonly noEncontrado = computed(() => this.estadoConsulta() === 'inexistente');
  readonly mensaje = signal('');
  readonly errorValidacion = signal('');
  readonly reintentable = signal(false);

  // Anti-abuso: PoW, honeypot, rate limiting
  readonly prueba = signal<string | null>(null);
  readonly reinicio = signal<number>(0);
  readonly trampa = signal<string>('');
  readonly aviso = signal<string | null>(null);
  tiempoMinimoMs = 1200;
  validarPoW = true;
  private readonly montado = Date.now();
  private recientes: number[] = [];
  private consulta = new Subscription();
  private generacion = 0;
  private destruido = false;
  private codigoConsultado = '';

  onQueryInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value.toUpperCase();
    if (value === this.query()) return;
    this.cancelarConsulta();
    this.query.set(value);
    this.aviso.set(null);
  }

  onSubmit(event: Event): void { event.preventDefault(); this.buscar(); }

  buscar(): void {
    if (this.destruido) return;
    const codigo = this.query().trim().toUpperCase();
    if (this.buscando() && codigo === this.codigoConsultado) return;
    this.cancelarConsulta();
    this.aviso.set(null);

    // 1. Honeypot y tiempo mínimo (1200ms)
    if (this.trampa() || (this.tiempoMinimoMs > 0 && Date.now() - this.montado < this.tiempoMinimoMs)) {
      this.aviso.set('Espere un momento e inténtelo nuevamente.');
      return;
    }

    // 2. Limitador local de ráfagas (máximo 8 consultas / 60 segundos)
    const ahora = Date.now();
    this.recientes = this.recientes.filter((t) => ahora - t < 60000);
    if (this.recientes.length >= 8) {
      this.estadoConsulta.set('limite');
      this.mensaje.set('Ha realizado muchas consultas seguidas. Espere un minuto antes de volver a buscar.');
      this.enfocar('consulta-feedback');
      return;
    }

    // 3. Verificación Proof-of-Work
    if (this.validarPoW && !this.prueba()) {
      this.aviso.set('Espere a que termine la verificación anti-bots.');
      return;
    }

    this.query.set(codigo);
    if (codigo.length > 50 || !(NUMERO_SAIP.test(codigo) || NUMERO_TTAIP.test(codigo))) {
      this.estadoConsulta.set('validacion');
      this.errorValidacion.set('Ingrese el número completo: SAIP-2026-00001 o 00001-2026-JUS/TTAIP.');
      this.enfocar('expediente');
      return;
    }
    this.recientes.push(ahora);
    const gen = this.generacion;
    this.codigoConsultado = codigo;
    this.estadoConsulta.set('cargando');
    this.consulta = this.solicitudService.consultarPublicamente(codigo).subscribe({
      next: data => {
        if (!this.actual(gen, codigo)) return;
        this.consumirPrueba();
        const resultado = this.convertir(data, codigo);
        if (!resultado) {
          this.estadoConsulta.set('incompleta');
          this.mensaje.set('No pudimos identificar el expediente en el resultado. Vuelva a intentarlo.');
          this.reintentable.set(true);
          this.enfocar('consulta-feedback');
          return;
        }
        this.resultado.set(resultado);
        this.estadoConsulta.set('disponible');
        this.enfocar('consulta-resultado');
      },
      error: error => {
        if (!this.actual(gen, codigo)) return;
        this.consumirPrueba();
        if (error?.status === 429) {
          this.estadoConsulta.set('limite');
          this.mensaje.set('Espere un momento antes de volver a buscar.');
          this.enfocar('consulta-feedback');
          return;
        }
        const fallo = falloConsulta(error, 'el resumen público');
        this.estadoConsulta.set(fallo.estado);
        this.mensaje.set(fallo.estado === 'inexistente'
          ? 'No se encontró un expediente con ese número. Revise el número completo e inténtelo de nuevo.'
          : fallo.mensaje);
        this.reintentable.set(fallo.reintentable);
        this.enfocar('consulta-feedback');
      },
    });
  }

  private consumirPrueba(): void {
    this.prueba.set(null);
    this.reinicio.update(n => n + 1);
  }

  limpiarBusqueda(): void {
    if (this.destruido) return;
    this.cancelarConsulta();
    this.aviso.set(null);
    this.query.set('');
    this.enfocar('expediente');
  }

  ngOnDestroy(): void { this.destruido = true; this.cancelarConsulta(); }

  private cancelarConsulta(): void {
    this.generacion++;
    this.consulta.unsubscribe();
    this.resultado.set(null);
    this.estadoConsulta.set('inicial');
    this.mensaje.set('');
    this.errorValidacion.set('');
    this.reintentable.set(false);
    this.codigoConsultado = '';
  }

  private actual(gen: number, codigo = this.codigoConsultado): boolean {
    return !this.destruido && gen === this.generacion && this.query().trim().toUpperCase() === codigo;
  }

  private enfocar(id: string): void {
    const gen = this.generacion;
    queueMicrotask(() => {
      if (!this.destruido && gen === this.generacion) document.getElementById(id)?.focus();
    });
  }

  estadoEtiqueta(estado: EstadoPublico): string { return ESTADOS[estado]; }
  statusIconColor(estado: EstadoPublico): string {
    if (estado === 'EN_PROCESO') return 'var(--info)';
    if (estado === 'RESPONDIDA') return 'var(--success)';
    if (estado === 'APELADA') return 'var(--gold)';
    if (estado === 'DENEGADA' || estado === 'VENCIDA') return 'var(--brand-700)';
    return 'var(--muted-foreground)';
  }

  private texto(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private fecha(value: unknown): string | null {
    // Display the date sent by the server, without timezone shifts or calendar calculations.
    const raw = this.texto(value);
    if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(raw)
      || Number.isNaN(Date.parse(raw))) return null;
    const civil = new Date(`${raw.slice(0, 10)}T00:00:00Z`);
    if (civil.toISOString().slice(0, 10) !== raw.slice(0, 10)) return null;
    return raw.slice(0, 10).split('-').reverse().join('/');
  }

  private convertir(data: unknown, codigo: string): ConsultaResultado | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    const raw = data as Record<string, unknown>;
    const consultaTtaip = NUMERO_TTAIP.test(codigo);
    const expedienteSaip = this.texto(raw['expediente']);
    if (consultaTtaip ? raw['apelacionExpediente'] !== codigo || raw['estado'] !== 'APELADA'
      || expedienteSaip !== null && !NUMERO_SAIP.test(expedienteSaip) : raw['expediente'] !== codigo) return null;
    if (typeof raw['estado'] !== 'string' || !Object.hasOwn(ESTADOS, raw['estado'])) return null;
    const estado = raw['estado'] as EstadoPublico;
    const ciudadano = this.texto(raw['ciudadano']), entidad = this.texto(raw['entidad']);
    const fechaPresentacion = this.fecha(raw['fechaPresentacion']);
    const dias = raw['diasTranscurridos'];
    const diasTranscurridos = fechaPresentacion && typeof dias === 'number' && Number.isSafeInteger(dias) && dias >= 0 ? dias : null;
    const apelacionExpediente = this.texto(raw['apelacionExpediente']);
    const apelacionEstado = apelacionExpediente ? this.texto(raw['apelacionEstado']) : null;
    const apelacionFecha = this.fecha(raw['apelacionFecha']);
    const respuestaFecha = this.fecha(raw['respuestaFecha']), respuestaTipo = this.texto(raw['respuestaTipo']);
    const resolucionFecha = this.fecha(raw['resolucionFecha']);
    const resolucionResultado = apelacionExpediente ? this.texto(raw['resolucionResultado']) : null;
    const faltantes: string[] = [];
    if (!ciudadano) faltantes.push('identificación enmascarada del solicitante');
    if (expedienteSaip && !entidad) faltantes.push('nombre de entidad');
    if (expedienteSaip && !fechaPresentacion) faltantes.push('fecha de presentación válida');
    if (expedienteSaip && diasTranscurridos === null) faltantes.push('días transcurridos verificables en el resumen');
    if ((raw['respuestaFecha'] != null || respuestaTipo) && (!respuestaFecha || !respuestaTipo)) faltantes.push('datos de respuesta completos');
    if ((estado === 'RESPONDIDA' || estado === 'DENEGADA') && !respuestaFecha) faltantes.push('fecha del registro de respuesta');
    if ((estado === 'APELADA' || raw['apelacionEstado'] != null || raw['apelacionFecha'] != null) && !apelacionExpediente) faltantes.push('referencia de la apelación vinculada');
    if (apelacionExpediente && (!apelacionEstado || !apelacionFecha)) faltantes.push('estado o fecha de la apelación vinculada');
    if ((raw['resolucionFecha'] != null || raw['resolucionResultado'] != null) && (!apelacionExpediente || !resolucionFecha || !resolucionResultado)) faltantes.push('datos de resolución completos y vinculados');
    const timeline: TimelineEvent[] = [];
    if (fechaPresentacion) timeline.push({ title: 'Registro de la solicitud', description: 'Fecha de presentación informada en la consulta pública.', date: fechaPresentacion, status: 'completed', icon: 'mail' });
    if (respuestaFecha) timeline.push({ title: 'Registro de respuesta', description: respuestaTipo
      ? `Tipo informado: ${respuestaTipo.replaceAll('_', ' ')}. No acredita entrega ni notificación eficaz.`
      : 'Tipo no informado. Esta fecha no acredita entrega ni notificación eficaz.', date: respuestaFecha, status: 'completed', icon: 'filecheck' });
    if (apelacionExpediente && apelacionFecha) timeline.push({ title: 'Registro de apelación vinculada',
      description: `Referencia: ${apelacionExpediente}. ${apelacionEstado ? 'Estado informado: ' + apelacionEstado.replaceAll('_', ' ') + '.' : 'Estado no informado.'}`,
      date: apelacionFecha, status: 'completed', icon: 'gavel' });
    if (apelacionExpediente && resolucionFecha) timeline.push({ title: 'Registro de resolución',
      description: resolucionResultado ? `Resultado informado: ${resolucionResultado.replaceAll('_', ' ')}. No acredita firma ni emisión documental verificadas.`
        : 'Resultado no informado. No acredita firma ni emisión documental verificadas.', date: resolucionFecha, status: 'completed', icon: 'scale' });
    // Deliberate allowlist: never retain private fields or document relations from an unexpected payload.
    return { expediente: expedienteSaip ?? codigo, expedienteSaip, codigoConsultado: codigo, consultaTtaip, estado, ciudadano, entidad, fechaPresentacion, diasTranscurridos,
      apelacionExpediente, apelacionEstado, apelacionFecha, resolucionResultado, timeline, faltantes };
  }
}
