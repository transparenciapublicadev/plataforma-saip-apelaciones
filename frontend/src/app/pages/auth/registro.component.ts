import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { RegistroRequest } from '../../models/usuario.model';
import {
  LucideArrowLeft, LucideShield, LucideUserPlus, LucideCheck,
  LucideEye, LucideEyeOff, LucideArrowRight, LucideScale,
} from '@lucide/angular';

@Component({
  selector: 'app-registro',
  imports: [
    FormsModule, RouterLink,
    LucideArrowLeft, LucideShield, LucideUserPlus, LucideCheck,
    LucideEye, LucideEyeOff, LucideArrowRight, LucideScale,
  ],
  templateUrl: './registro.component.html',
  styleUrl: './registro.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegistroComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  private readonly nombreRegex = /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\s-]+$/;

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

  step1Valid(): boolean {
    return this.dni.length === 8
      && /^\d+$/.test(this.dni)
      && this.isNombreValido(this.nombres)
      && this.isNombreValido(this.apellidoPaterno)
      && this.isNombreValido(this.apellidoMaterno);
  }

  passwordRequirements(): Array<{ met: boolean; text: string }> {
    return [
      { met: this.password.length >= 8, text: 'Mínimo 8 caracteres' },
      { met: /[A-Z]/.test(this.password), text: 'Una mayúscula' },
      { met: /[a-z]/.test(this.password), text: 'Una minúscula' },
      { met: /\d/.test(this.password), text: 'Un número' },
      { met: /[^A-Za-z\d]/.test(this.password), text: 'Un símbolo (!@#$...)' },
    ];
  }

  canSubmitStep2(): boolean {
    return this.emailRegex.test(this.email.trim())
      && this.passwordRequirements().every((rule) => rule.met)
      && this.password === this.confirmarPassword
      && this.acceptTerms;
  }

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
    const nombres = this.normalizarTexto(this.nombres);
    const apellidoPaterno = this.normalizarTexto(this.apellidoPaterno);
    const apellidoMaterno = this.normalizarTexto(this.apellidoMaterno);
    const email = this.email.trim().toLowerCase();
    const telefono = this.telefono.trim();
    const nombreCompleto = `${nombres} ${apellidoPaterno} ${apellidoMaterno}`.trim();

    if (!this.dni || !nombreCompleto || !email || !this.password) {
      this.error.set('Todos los campos obligatorios deben ser completados');
      return;
    }
    if (this.dni.length !== 8) {
      this.error.set('El DNI debe tener 8 dígitos');
      return;
    }
    if (!this.isNombreValido(nombres) || !this.isNombreValido(apellidoPaterno) || !this.isNombreValido(apellidoMaterno)) {
      this.error.set('Los nombres y apellidos solo deben contener letras.');
      return;
    }
    if (!this.emailRegex.test(email)) {
      this.error.set('Ingrese un correo electrónico válido');
      return;
    }
    if (telefono && telefono.length !== 9) {
      this.error.set('El teléfono debe tener 9 dígitos');
      return;
    }
    if (this.password !== this.confirmarPassword) {
      this.error.set('Las contraseñas no coinciden');
      return;
    }
    if (!this.passwordRequirements().every((rule) => rule.met)) {
      this.error.set('La contraseña no cumple los requisitos de seguridad');
      return;
    }
    if (!this.acceptTerms) {
      this.error.set('Debe aceptar los términos y condiciones');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    forkJoin({
      dni: this.authService.verificarDni(this.dni),
      email: this.authService.verificarEmail(email),
    })
      .pipe(
        switchMap(({ dni, email: emailResult }) => {
          if (dni.existe) {
            this.error.set('El DNI ya está registrado en la plataforma');
            return of(null);
          }

          if (emailResult.existe) {
            this.error.set('El correo ya se encuentra registrado');
            return of(null);
          }

          const datos: RegistroRequest = {
            dni: this.dni,
            nombreCompleto,
            email,
            password: this.password,
            telefono,
          };

          return this.authService.registro(datos);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (!response) return;

          if (response.success) {
            this.mensaje.set('Registro exitoso. Redirigiendo al login ciudadano...');
            setTimeout(() => {
              this.router.navigate(['/login']);
            }, 1800);
          } else {
            this.error.set(response.mensaje || 'Error en el registro');
          }
        },
        error: (err) => {
          this.error.set(err.error?.mensaje || 'No se pudo completar el registro. Intente nuevamente.');
        }
      });
  }

  private normalizarTexto(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }

  private isNombreValido(value: string): boolean {
    const normalizado = this.normalizarTexto(value);
    return normalizado.length >= 2 && this.nombreRegex.test(normalizado);
  }
}

