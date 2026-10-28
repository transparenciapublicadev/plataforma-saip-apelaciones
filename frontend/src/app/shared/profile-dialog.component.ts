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
  dni: string | null;
}
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;

/** Read-only until a narrow own-profile command can preserve protected fields. */
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
  readonly error = signal('');
  readonly retry = signal(false);

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
    this.data.set(null); this.error.set(''); this.retry.set(false); this.loading.set(false);
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
            if (citizen?.id !== id || citizen?.activo !== true || citizen?.email !== account.email) {
              this.incomplete(); return;
            }
            this.data.set({ nombre: text(citizen.nombreCompleto), email: account.email,
              telefono: text(citizen.telefono), direccion: text(citizen.direccion), dni: text(citizen.dni) });
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

  cerrar(): void {
    ++this.generation; this.queries.unsubscribe(); this.data.set(null); this.error.set(''); this.loading.set(false);
    this.dialog.cerrar();
  }

  ngOnDestroy(): void {
    this.destroyed = true; this.cerrar();
  }
}
