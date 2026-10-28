import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

/** Opens the citizen overlay; the server still authorizes every profile query. */
@Injectable({ providedIn: 'root' })
export class ProfileDialogService {
  private readonly auth = inject(AuthService);
  private readonly visible = signal(false);
  private openedFor: { id: number; token: string; revision: number } | null = null;
  readonly abierto = this.visible.asReadonly();

  abrir(): void {
    try {
      const session = this.auth.obtenerSesion();
      if (session?.token && session.tipoUsuario === 'CIUDADANO' &&
          Number.isSafeInteger(session.usuarioId) && session.usuarioId! > 0) {
        this.openedFor = { id: session.usuarioId!, token: session.token, revision: this.auth.cambiosSesion() };
        this.visible.set(true);
      }
    } catch { /* An unreadable session never grants access. */ }
  }

  esSesionDeApertura(): boolean {
    try {
      const session = this.auth.obtenerSesion();
      return !!this.openedFor && session?.tipoUsuario === 'CIUDADANO' &&
        session.usuarioId === this.openedFor.id && session.token === this.openedFor.token &&
        this.auth.cambiosSesion() === this.openedFor.revision;
    } catch { return false; }
  }

  cerrar(): void { this.visible.set(false); this.openedFor = null; }
}
