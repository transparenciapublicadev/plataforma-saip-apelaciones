import { Component, OnInit, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LoginRequest } from '../../models/usuario.model';

@Component({
  selector: 'app-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  email = '';
  password = '';
  tipoUsuario = signal<string>('ciudadano');
  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');

  constructor() {}

  ngOnInit(): void {
    if (this.authService.estaLogueado()) {
      this.redirigirSegunTipo();
    }
  }

  selectUserType(tipo: string): void {
    this.tipoUsuario.set(tipo);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  login(): void {
    if (!this.email || !this.password) {
      this.error.set('Por favor complete todos los campos');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const credentials: LoginRequest = {
      identificador: this.email,
      password: this.password
    };

    this.authService.login(credentials).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.authService.guardarSesion(response);
          this.redirigirSegunTipo();
        } else {
          this.error.set(response.mensaje || 'Error al iniciar sesión');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error de conexión');
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
}

