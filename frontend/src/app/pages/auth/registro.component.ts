import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';
import { RegistroRequest } from '../../models/usuario.model';
import {
  LucideArrowLeft, LucideShield, LucideUserPlus, LucideCheck,
  LucideEye, LucideEyeOff, LucideArrowRight, LucideLoaderCircle,
  LucideBuilding2, LucideUser, LucideMapPin, LucideFileText, LucideX, LucideInfo, LucideLock
} from '@lucide/angular';

@Component({
  selector: 'app-registro',
  imports: [
    NgClass, FormsModule, RouterLink,
    LucideArrowLeft, LucideShield, LucideUserPlus, LucideCheck,
    LucideEye, LucideEyeOff, LucideArrowRight, LucideLoaderCircle,
    LucideBuilding2, LucideUser, LucideMapPin, LucideFileText, LucideX, LucideInfo, LucideLock
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
  private readonly razonSocialRegex = /^[a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\.\,-]+$/;
  private readonly tieneLetraRegex = /.*[A-Za-zÁÉÍÓÚÜÑáéíóúüñ].*/;

  // Step 1: Identificación y Tipo de Persona
  tipoPersona = signal<'NATURAL' | 'JURIDICA'>('NATURAL');
  
  // Persona Natural
  dni = '';
  nombres = '';
  apellidoPaterno = '';
  apellidoMaterno = '';

  // Persona Jurídica
  ruc = '';
  razonSocial = '';
  representanteDni = '';
  representanteNombreCompleto = '';

  // Contacto (Transversal)
  email = '';
  telefono = '';

  // Step 2: Domicilio Legal Estructurado
  departamento = 'LIMA';
  provincia = 'LIMA';
  distrito = '';
  ubigeo = '';
  tipoVia = 'Avenida';
  nombreVia = '';
  numero = '';
  interior = '';
  urbanizacion = '';
  referencia = '';

  // Step 3: Credenciales & Términos
  password = '';
  confirmarPassword = '';
  showPassword = signal(false);
  acceptTerms = false;
  showTermsModal = signal(false);

  // Wizard state
  currentStep = signal<number>(1);
  loading = signal<boolean>(false);
  error = signal<string>('');
  mensaje = signal<string>('');

  readonly tiposVia = [
    'Avenida', 'Calle', 'Jirón', 'Pasaje', 'Alameda', 'Carretera', 'Prolongación', 'Autopista', 'Urbanización'
  ];

  readonly departamentos = [
    'AMAZONAS', 'ANCASH', 'APURIMAC', 'AREQUIPA', 'AYACUCHO', 'CAJAMARCA',
    'CALLAO', 'CUSCO', 'HUANCAVELICA', 'HUANUCO', 'ICA', 'JUNIN', 'LA LIBERTAD',
    'LAMBAYEQUE', 'LIMA', 'LORETO', 'MADRE DE DIOS', 'MOQUEGUA', 'PASCO',
    'PIURA', 'PUNO', 'SAN MARTIN', 'TACNA', 'TUMBES', 'UCAYALI'
  ];

  setTipoPersona(tipo: 'NATURAL' | 'JURIDICA'): void {
    this.tipoPersona.set(tipo);
    this.error.set('');
  }

  step1Valid(): boolean {
    const isEmailValid = this.emailRegex.test(this.email.trim());
    const isPhoneValid = /^\d{9}$/.test(this.telefono.trim());

    if (this.tipoPersona() === 'NATURAL') {
      return /^\d{8}$/.test(this.dni)
        && this.isNombreValido(this.nombres)
        && this.isNombreValido(this.apellidoPaterno)
        && this.isNombreValido(this.apellidoMaterno)
        && isEmailValid
        && isPhoneValid;
    } else {
      return /^\d{11}$/.test(this.ruc)
        && this.razonSocial.trim().length >= 3
        && this.razonSocialRegex.test(this.razonSocial.trim())
        && /^\d{8}$/.test(this.representanteDni)
        && this.isNombreValido(this.representanteNombreCompleto)
        && isEmailValid
        && isPhoneValid;
    }
  }

  step2Valid(): boolean {
    const nombreViaTrim = this.nombreVia.trim();
    const isNombreViaValido = nombreViaTrim.length >= 2 && this.tieneLetraRegex.test(nombreViaTrim);
    const isUbigeoValido = !this.ubigeo.trim() || /^\d{6}$/.test(this.ubigeo.trim());

    return this.departamento.trim().length > 0
      && this.provincia.trim().length > 0
      && this.distrito.trim().length > 0
      && this.tipoVia.trim().length > 0
      && isNombreViaValido
      && this.numero.trim().length > 0
      && this.referencia.trim().length >= 3
      && isUbigeoValido;
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

  step3Valid(): boolean {
    return this.emailRegex.test(this.email.trim())
      && this.passwordRequirements().every((rule) => rule.met)
      && this.password === this.confirmarPassword
      && this.acceptTerms;
  }

  esPasoValido(paso: number): boolean {
    if (paso === 1) return this.step1Valid();
    if (paso === 2) return this.step2Valid();
    if (paso === 3) return this.step3Valid();
    return false;
  }

  getInputClasses(ctrl: any): Record<string, boolean> {
    const isInvalid = ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty);
    const isValid = ctrl && ctrl.valid && (ctrl.touched || ctrl.dirty) && ctrl.value;
    return {
      'border-red-500/70 text-red-900 bg-red-50/40 focus:border-red-500 focus:ring-red-500/20 dark:border-red-500/60 dark:text-red-200 dark:bg-red-950/20 dark:focus:border-red-400': !!isInvalid,
      'border-emerald-600/60 focus:border-emerald-600 dark:border-emerald-500/50 dark:focus:border-emerald-400': !!isValid
    };
  }

  getButtonClasses(paso: number): Record<string, boolean> {
    const valido = this.esPasoValido(paso);
    return {
      'bg-[#8B1D24] hover:bg-[#6f171d] text-white shadow-md active:scale-[0.99] dark:bg-[#a3222a] dark:hover:bg-[#8B1D24]': valido,
      'bg-slate-200 text-slate-500 border border-slate-300/80 cursor-not-allowed opacity-70 dark:bg-slate-800/80 dark:text-slate-400 dark:border-slate-700/80': !valido
    };
  }

  goToStep(step: number): void {
    if (step === 2 && !this.step1Valid()) {
      this.error.set('Por favor complete todos los datos requeridos del Paso 1.');
      return;
    }
    if (step === 3 && (!this.step1Valid() || !this.step2Valid())) {
      this.error.set('Por favor complete los datos requeridos del Paso 1 y Paso 2.');
      return;
    }
    this.error.set('');
    this.currentStep.set(step);
  }

  toggleShowPassword(): void {
    this.showPassword.set(!this.showPassword());
  }

  openTerms(): void {
    this.showTermsModal.set(true);
  }

  closeTerms(): void {
    this.showTermsModal.set(false);
  }

  acceptTermsFromModal(): void {
    this.acceptTerms = true;
    this.showTermsModal.set(false);
  }

  navigateToHome(): void {
    this.router.navigate(['/']);
  }

  onDniInput(value: string): void {
    this.dni = value.replace(/\D/g, '').slice(0, 8);
  }

  onRucInput(value: string): void {
    this.ruc = value.replace(/\D/g, '').slice(0, 11);
  }

  onRepresentanteDniInput(value: string): void {
    this.representanteDni = value.replace(/\D/g, '').slice(0, 8);
  }

  onTelefonoInput(value: string): void {
    this.telefono = value.replace(/\D/g, '').slice(0, 9);
  }

  onUbigeoInput(value: string): void {
    this.ubigeo = value.replace(/\D/g, '').slice(0, 6);
  }

  registrar(): void {
    if (!this.step1Valid() || !this.step2Valid() || !this.step3Valid()) {
      this.error.set('Complete todos los campos obligatorios antes de continuar.');
      return;
    }

    const email = this.email.trim().toLowerCase();
    const telefono = this.telefono.trim();
    const isNatural = this.tipoPersona() === 'NATURAL';

    let nombreCompleto = '';
    if (isNatural) {
      const nom = this.normalizarTexto(this.nombres);
      const pat = this.normalizarTexto(this.apellidoPaterno);
      const mat = this.normalizarTexto(this.apellidoMaterno);
      nombreCompleto = `${nom} ${pat} ${mat}`.trim();
    } else {
      nombreCompleto = this.razonSocial.trim();
    }

    // Dirección estructurada consolidada
    const direccionConsolidada = `${this.tipoVia} ${this.nombreVia} ${this.numero}${this.interior ? ' Int. ' + this.interior : ''} - ${this.distrito}, ${this.provincia} (${this.departamento})`;

    this.loading.set(true);
    this.error.set('');

    const checkObs = isNatural
      ? forkJoin({
          dni: this.authService.verificarDni(this.dni),
          email: this.authService.verificarEmail(email),
        })
      : forkJoin({
          email: this.authService.verificarEmail(email),
          dni: of({ existe: false })
        });

    checkObs
      .pipe(
        switchMap(({ dni, email: emailResult }) => {
          if (isNatural && dni.existe) {
            this.error.set('El DNI ya se encuentra registrado en la plataforma');
            return of(null);
          }

          if (emailResult.existe) {
            this.error.set('El correo electrónico ya se encuentra registrado');
            return of(null);
          }

          const datos: RegistroRequest = {
            email,
            password: this.password,
            tipoPersona: this.tipoPersona(),
            dni: isNatural ? this.dni : undefined,
            nombres: isNatural ? this.normalizarTexto(this.nombres) : undefined,
            apellidoPaterno: isNatural ? this.normalizarTexto(this.apellidoPaterno) : undefined,
            apellidoMaterno: isNatural ? this.normalizarTexto(this.apellidoMaterno) : undefined,
            nombreCompleto,
            ruc: !isNatural ? this.ruc : undefined,
            razonSocial: !isNatural ? this.razonSocial.trim() : undefined,
            representanteDni: !isNatural ? this.representanteDni : undefined,
            representanteNombreCompleto: !isNatural ? this.representanteNombreCompleto.trim() : undefined,
            telefono,
            ubigeo: this.ubigeo,
            departamento: this.departamento,
            provincia: this.provincia,
            distrito: this.distrito,
            tipoVia: this.tipoVia,
            nombreVia: this.nombreVia,
            numero: this.numero,
            interior: this.interior,
            referencia: this.referencia,
            direccion: direccionConsolidada,
          };

          return this.authService.registro(datos);
        }),
        finalize(() => this.loading.set(false))
      )
      .subscribe({
        next: (response) => {
          if (!response) return;

          if (response.success) {
            this.mensaje.set('Registro exitoso. Redirigiendo al inicio de sesión...');
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
