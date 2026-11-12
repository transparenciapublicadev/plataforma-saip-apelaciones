import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, effect, inject, signal, untracked } from '@angular/core';
import { Subscription } from 'rxjs';
import { LucideUserRound, LucideX } from '@lucide/angular';
import { AuthService } from '../services/auth.service';
import { CiudadanoService } from '../services/ciudadano.service';
import { ProfileDialogService } from '../services/profile-dialog.service';
import { ModalFocusDirective } from './modal-focus.directive';
import { falloConsulta } from '../utils/consulta-remota.util';

interface OwnProfile {
  nombre: string | null;
  email: string;
  telefono: string | null;
  direccion: string | null;
  departamento: string | null;
  provincia: string | null;
  distrito: string | null;
  dni: string | null;
}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

/** Own citizen profile. Document and password stay out of this form. */
@Component({
  selector: 'app-profile-dialog',
  imports: [ModalFocusDirective, LucideUserRound, LucideX],
  templateUrl: './profile-dialog.component.html',
  styleUrl: './profile-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileDialogComponent implements OnInit, OnDestroy {
  readonly dialog = inject(ProfileDialogService);
  private readonly auth = inject(AuthService);
  private readonly ciudadanos = inject(CiudadanoService);
  private readonly context = this.session();
  private queries = new Subscription();
  private generation = 0;
  private destroyed = false;
  private readonly data = signal<OwnProfile | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');
  readonly retry = signal(false);
  readonly nombre = signal('');
  readonly email = signal('');
  readonly telefono = signal('');
  readonly direccion = signal('');
  readonly departamento = signal('');
  readonly provincia = signal('');
  readonly distrito = signal('');

  constructor() {
    effect(() => {
      this.auth.cambiosSesion();
      untracked(() => { if (!this.matchesSession()) this.cerrar(); });
    });
  }

  ngOnInit(): void { this.cargar(); }

  private session(): { id: number; token: string } | null {
    try {
      const s = this.auth.obtenerSesion();
      return s?.token && s.tipoUsuario === 'CIUDADANO' && Number.isSafeInteger(s.usuarioId) && s.usuarioId! > 0
        ? { id: s.usuarioId!, token: s.token } : null;
    } catch { return null; }
  }

  private matchesSession(): boolean {
    const now = this.session();
    return this.dialog.esSesionDeApertura() && !!this.context && now?.id === this.context.id && now.token === this.context.token;
  }

  private current(generation: number): boolean {
    return !this.destroyed && this.dialog.abierto() && generation === this.generation && this.matchesSession();
  }

  perfil(): OwnProfile | null { return this.current(this.generation) ? this.data() : null; }

  cargar(): void {
    if (this.destroyed || !this.dialog.abierto()) return;
    this.queries.unsubscribe(); this.queries = new Subscription();
    const generation = ++this.generation;
    this.data.set(null); this.error.set(''); this.aviso.set(''); this.retry.set(false); this.loading.set(false); this.saving.set(false);
    if (!this.matchesSession()) { this.cerrar(); return; }
    const id = this.context!.id;
    this.loading.set(true);
    this.queries.add(this.auth.getUsuarioActual(id).subscribe({
      next: account => {
        if (!this.current(generation)) return;
        if (account?.usuarioId !== id || account?.tipoUsuario !== 'CIUDADANO' || account?.activo !== true || !text(account?.email)) {
          this.incomplete(); return;
        }
        // Ciudadano inherits Usuario's primary key; never use a free client-supplied ID.
        this.queries.add(this.ciudadanos.findById(id).subscribe({
          next: citizen => {
            if (!this.current(generation)) return;
            const datos = citizen as typeof citizen & { departamento?: string | null; provincia?: string | null; distrito?: string | null };
            if (datos?.id !== id || datos?.activo !== true || datos?.email !== account.email) {
              this.incomplete(); return;
            }
            const perfil = {
              nombre: text(datos.nombreCompleto), email: account.email,
              telefono: text(datos.telefono), direccion: text(datos.direccion),
              departamento: text(datos.departamento), provincia: text(datos.provincia),
              distrito: text(datos.distrito), dni: text(datos.dni)
            };
            this.data.set(perfil);
            this.copiar(perfil);
            this.loading.set(false);
          },
          error: error => { if (this.current(generation)) this.failed(error); },
        }));
      },
      error: error => { if (this.current(generation)) this.failed(error); },
    }));
  }

  private incomplete(): void {
    this.data.set(null); this.loading.set(false); this.retry.set(true);
    this.error.set('La información del perfil está incompleta o no coincide entre las consultas. Vuelva a consultar.');
  }

  private failed(error: unknown): void {
    const failure = falloConsulta(error, 'su perfil');
    this.data.set(null); this.loading.set(false); this.error.set(failure.mensaje); this.retry.set(failure.reintentable);
  }

  valor(event: Event): string { return (event.target as HTMLInputElement | HTMLTextAreaElement).value; }

  puedeGuardar(): boolean {
    const telefono = this.telefono().trim();
    return !this.saving() && !this.loading() && this.perfil() !== null
      && this.nombre().trim().length >= 3
      && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email().trim())
      && (telefono === '' || /^9\d{8}$/.test(telefono));
  }

  guardar(): void {
    if (!this.puedeGuardar() || !this.matchesSession()) return;
    const generation = this.generation;
    const id = this.context!.id;
    this.saving.set(true); this.aviso.set('');
    this.queries.add(this.ciudadanos.actualizarContacto(id, {
      nombreCompleto: this.nombre().trim(),
      email: this.email().trim(),
      telefono: this.telefono().trim(),
      direccion: this.direccion().trim(),
      departamento: this.departamento().trim(),
      provincia: this.provincia().trim(),
      distrito: this.distrito().trim(),
    }).subscribe({
      next: saved => {
        if (!this.current(generation)) return;
        this.saving.set(false);
        const sesion = this.auth.obtenerSesion();
        const nombre = text(saved?.nombreCompleto) ?? this.nombre().trim();
        const email = text(saved?.email) ?? this.email().trim();
        if (sesion) this.auth.guardarSesion({ ...sesion, success: true, nombre, nombreCompleto: nombre, email });
      },
      error: error => {
        if (!this.current(generation)) return;
        this.saving.set(false); this.aviso.set(this.mensajeGuardado(error));
      },
    }));
  }

  private copiar(perfil: OwnProfile): void {
    this.nombre.set(perfil.nombre ?? '');
    this.email.set(perfil.email);
    this.telefono.set(perfil.telefono ?? '');
    this.direccion.set(perfil.direccion ?? '');
    this.departamento.set(perfil.departamento ?? '');
    this.provincia.set(perfil.provincia ?? '');
    this.distrito.set(perfil.distrito ?? '');
  }

  private mensajeGuardado(error: unknown): string {
    if (error instanceof HttpErrorResponse && (error.status === 400 || error.status === 409)) {
      const detail = error.error?.detail;
      if (typeof detail === 'string' && detail.length > 0 && detail.length < 180) return detail;
    }
    return 'No se pudieron guardar los cambios. Inténtelo nuevamente.';
  }

  cerrar(): void {
    ++this.generation; this.queries.unsubscribe(); this.data.set(null); this.error.set(''); this.loading.set(false);
    this.dialog.cerrar();
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.cerrar();
  }
}
