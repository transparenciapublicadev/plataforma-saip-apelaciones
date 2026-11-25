import { Component, OnInit, ChangeDetectionStrategy, computed, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/usuario.model';
import { problemDetailsMessage } from '../../utils/problem-details.util';
import {
  LucideArrowLeft, LucideShield, LucideLogIn,
  LucideEye, LucideEyeOff, LucideArrowRight, LucideLoaderCircle,
  LucideLock, LucideBadgeCheck
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
    LucideLock, LucideBadgeCheck,
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

  formEyebrow = computed(() => this.isCitizenPortal() ? 'Acceso público' : 'Acceso institucional');

  formTitle = computed(() => this.isCitizenPortal() ? 'Administrado' : this.getRoleLabel(this.requiredRole()));

  formSubtitle = computed(() => this.isCitizenPortal()
    ? 'Ingrese para presentar y consultar sus solicitudes.'
    : 'Ingrese al espacio interno de gestión de Yaiku.');

  identifierLabel = computed(() => this.isCitizenPortal() ? 'Correo electrónico, DNI o RUC' : 'Usuario institucional');
  identifierPlaceholder = computed(() => this.isCitizenPortal() ? 'correo@ejemplo.com, DNI (8 dígitos) o RUC (11 dígitos)' : 'Usuario o correo institucional');

  isCitizenPortal = computed(() => this.accessMode() === 'citizen');


  constructor() {}

  ngOnInit(): void {
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

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  togglePasswordVisibility(): void {
    this.showPassword.update(v => !v);
  }

  login(): void {
    if (this.loading()) return;
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
        if (response.success) {
          const userRole = this.toTipoUsuario(response.tipoUsuario);
          if (!userRole) {
            this.loading.set(false);
            this.error.set('No se pudo validar su tipo de usuario. Intente nuevamente.');
            return;
          }

          if (!this.canAccessPortal(userRole)) {
            this.loading.set(false);
            this.error.set(this.getPortalAccessError(userRole));
            return;
          }

          this.authService.guardarSesion(response);
          this.redirigirSegunTipo();
          return;
        }
        this.loading.set(false);
        this.error.set(response.mensaje || 'Error al iniciar sesión');
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
    if (role === 'TTAIP') return 'Personal TTAIP';
    if (role === 'ADMINISTRADOR') return 'Administrador';
    return 'Interno';
  }
}
