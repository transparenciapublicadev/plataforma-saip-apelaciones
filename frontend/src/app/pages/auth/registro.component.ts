import { Component, ChangeDetectionStrategy, signal, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RegistroRequest } from '../../models/usuario.model';

@Component({
  selector: 'app-registro',
  imports: [FormsModule, RouterLink],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistroComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  dni = '';
  nombres = '';
  apellidoPaterno = '';
  apellidoMaterno = '';
  email = '';
  telefono = '';
  password = '';
  confirmarPassword = '';
  showPassword = signal(false);
  acceptTerms = false;

  currentStep = signal<number>(1);
  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');

  step1Valid = computed(() =>
    this.dni.length === 8 && /^\d+$/.test(this.dni) &&
    this.nombres.trim().length >= 2 &&
    this.apellidoPaterno.trim().length >= 2 &&
    this.apellidoMaterno.trim().length >= 2
  );

  passwordRequirements = computed(() => [
    { met: this.password.length >= 8, text: 'Mínimo 8 caracteres' },
    { met: /[A-Z]/.test(this.password), text: 'Una mayúscula' },
    { met: /[a-z]/.test(this.password), text: 'Una minúscula' },
    { met: /\d/.test(this.password), text: 'Un número' },
  ]);

  goToStep2(): void {
    this.currentStep.set(2);
  }

  goToStep1(): void {
    this.currentStep.set(1);
  }

  toggleShowPassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  onDniInput(value: string): void {
    this.dni = value.replace(/\D/g, '').slice(0, 8);
  }

  onTelefonoInput(value: string): void {
    this.telefono = value.replace(/\D/g, '').slice(0, 9);
  }

  registrar(): void {
    const nombreCompleto = `${this.nombres} ${this.apellidoPaterno} ${this.apellidoMaterno}`.trim();

    if (!this.dni || !nombreCompleto || !this.email || !this.password) {
      this.error.set('Todos los campos obligatorios deben ser completados');
      return;
    }
    if (this.dni.length !== 8) {
      this.error.set('El DNI debe tener 8 dígitos');
      return;
    }
    if (this.password !== this.confirmarPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (!this.acceptTerms) {
      this.error.set('Debe aceptar los términos y condiciones');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const datos: RegistroRequest = {
      dni: this.dni,
      nombreCompleto,
      email: this.email,
      password: this.password,
      telefono: this.telefono
    };

    this.authService.registro(datos).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.mensaje.set('Registro exitoso. Redirigiendo al login...');
          setTimeout(() => {
            this.router.navigate(['/login']);
          }, 2000);
        } else {
          this.error.set(response.mensaje || 'Error en el registro');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || 'Error de conexión');
      }
    });
  }
}

