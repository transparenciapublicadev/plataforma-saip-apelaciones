import { Component, OnInit, ChangeDetectionStrategy, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/usuario.model';
import { problemDetailsMessage } from '../../utils/problem-details.util';
import {
  LucideArrowLeft, LucideShield, LucideLogIn,
  LucideEye, LucideEyeOff, LucideArrowRight, LucideLoaderCircle
} from '@lucide/angular';
import { YaikuLogoComponent } from '../../shared/yaiku-logo.component';

type TipoUsuarioRole = 'CIUDADANO' | 'FUNCIONARIO' | 'TTAIP' | 'ADMINISTRADOR';
type InternalRole = Exclude<TipoUsuarioRole, 'CIUDADANO'>;
type AccessMode = 'citizen' | 'internal';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule, RouterLink,
    LucideArrowLeft, LucideShield, LucideLogIn,
    LucideEye, LucideEyeOff, LucideArrowRight, LucideLoaderCircle,
    YaikuLogoComponent
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  showPassword = signal(false);

  accessMode = signal<AccessMode>('citizen');
  requiredRole = signal<InternalRole | null>(null);

  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');
  readonly showQuickAccess = signal<boolean>(false);

  fillDemo(id: string, pass: string): void {
    this.email = id;
    this.password = pass;
    this.error.set('');
  }

  portalTitle = computed(() => {
    if (this.accessMode() === 'citizen') return 'Acceso para Administrados';
    const role = this.requiredRole();
    return `Acceso ${this.getRoleLabel(role)}`;
  });

  portalSubtitle = computed(() => {
    if (this.accessMode() === 'citizen') {
      return 'Portal público para solicitudes SAIP y apelaciones (Persona Natural y Jurídica)';
    }
    return 'Portal institucional para personal autorizado';
  });

  identifierLabel = computed(() => this.isCitizenPortal() ? 'Correo electrónico, DNI o RUC' : 'Usuario institucional');
  identifierPlaceholder = computed(() => this.isCitizenPortal() ? 'correo@ejemplo.com, DNI (8 dígitos) o RUC (11 dígitos)' : 'Usuario o correo institucional');

  isCitizenPortal = computed(() => this.accessMode() === 'citizen');

  constructor() {}

  ngOnInit(): void {
    const snapQp = this.route.snapshot?.queryParams;
    if (snapQp && this.hasAccesoRapido(snapQp)) {
      this.showQuickAccess.set(true);
    }

    if (this.route.queryParams) {
      this.route.queryParams.subscribe(params => {
        this.showQuickAccess.set(this.hasAccesoRapido(params));
      });
    }

    const accessModeData = this.route.snapshot?.data?.['accessMode'];
    const requiredRoleData = this.route.snapshot?.data?.['requiredRole'];
    const requiredRole = this.toInternalRole(requiredRoleData);

    if (accessModeData === 'internal' && requiredRole) {
      this.accessMode.set('internal');
      this.requiredRole.set(requiredRole);
    } else {
      this.accessMode.set('citizen');
      this.requiredRole.set(null);
    }

    if (this.authService.estaLogueado()) {
      this.redirigirSegunTipo();
    }
  }

  private hasAccesoRapido(params: Record<string, any> | undefined | null): boolean {
    if (!params) return false;
    if (!('acceso-rapido' in params)) return false;
    const val = params['acceso-rapido'];
    return val !== 'false' && val !== false;
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error.set('Por favor complete todos los campos');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.mensaje.set('');

    const credentials: LoginRequest = {
      identificador: this.email.trim(),
      password: this.password
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          const userRole = this.toTipoUsuario(response.tipoUsuario);
          if (!userRole) {
            this.error.set('No se pudo validar su tipo de usuario. Intente nuevamente.');
            return;
          }

          if (!this.canAccessPortal(userRole)) {
            this.error.set(this.getPortalAccessError(userRole));
            return;
          }

          this.authService.guardarSesion(response);
          this.redirigirSegunTipo();
        } else {
          this.error.set(response.mensaje || 'Error al iniciar sesión');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(problemDetailsMessage(err, 'Usuario o contraseña incorrectos.'));
      }
    });
  }

  private redirigirSegunTipo(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion?.redirectUrl) {
      const rutaFrontend = this.convertirRuta(sesion.redirectUrl);
      this.router.navigate([rutaFrontend]);
    } else {
      this.router.navigate(['/']);
    }
  }

  private convertirRuta(rutaBackend: string): string {
    const mapeo: { [key: string]: string } = {
      '/ciudadano/dashboard': '/ciudadano',
      '/entidad/dashboard': '/funcionario',
      '/ttaip/dashboard': '/ttaip',
      '/admin/dashboard': '/admin'
    };
    return mapeo[rutaBackend] || '/';
  }

  private canAccessPortal(userRole: TipoUsuarioRole): boolean {
    if (this.accessMode() === 'citizen') {
      return userRole === 'CIUDADANO';
    }

    const requiredRole = this.requiredRole();
    if (!requiredRole) {
      return userRole !== 'CIUDADANO';
    }

    return userRole === requiredRole;
  }

  private getPortalAccessError(userRole: TipoUsuarioRole): string {
    if (this.accessMode() === 'citizen') {
      return 'Esta entrada es exclusiva para ciudadanos.';
    }

    if (userRole === 'CIUDADANO') {
      return 'Credenciales no autorizadas para este acceso institucional.';
    }

    return 'Su perfil no está autorizado para este portal institucional.';
  }

  private toTipoUsuario(value: string | undefined): TipoUsuarioRole | null {
    const normalized = (value ?? '').toUpperCase();
    if (normalized === 'CIUDADANO' || normalized === 'FUNCIONARIO' || normalized === 'TTAIP' || normalized === 'ADMINISTRADOR') {
      return normalized;
    }
    return null;
  }

  private toInternalRole(value: unknown): InternalRole | null {
    const normalized = String(value ?? '').toUpperCase();
    if (normalized === 'FUNCIONARIO' || normalized === 'TTAIP' || normalized === 'ADMINISTRADOR') {
      return normalized;
    }
    return null;
  }

  private getRoleLabel(role: InternalRole | null): string {
    if (role === 'FUNCIONARIO') return 'Funcionario';
    if (role === 'TTAIP') return 'TTAIP';
    if (role === 'ADMINISTRADOR') return 'Administración';
    return 'Interno';
  }
}
