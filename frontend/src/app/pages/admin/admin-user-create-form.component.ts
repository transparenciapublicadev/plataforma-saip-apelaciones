import { ChangeDetectionStrategy, Component, OnDestroy, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { Subscription } from 'rxjs';
import { Entidad } from '../../models/entidad.model';
import { CrearUsuarioAdmin, UsuarioAdmin, UsuarioService } from '../../services/usuario.service';

// BCrypt's existing encoder limit counts UTF-8 bytes, including accented characters.
const bcryptByteLimit: ValidatorFn = (control) => new TextEncoder().encode(control.value ?? '').length <= 72
  ? null : { passwordBytes: true };

@Component({
  selector: 'app-admin-user-create-form',
  imports: [ReactiveFormsModule],
  templateUrl: './admin-user-create-form.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex min-h-0 flex-1 flex-col' },
})
export class AdminUserCreateFormComponent implements OnDestroy {
  private readonly usuarios = inject(UsuarioService);
  readonly entidades = input<Entidad[]>([]);
  readonly created = output<UsuarioAdmin>();
  readonly cancelled = output<void>();
  readonly saving = signal(false);
  readonly error = signal('');
  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    tipoUsuario: new FormControl<UsuarioAdmin['tipoUsuario']>('CIUDADANO', { nonNullable: true, validators: Validators.required }),
    entidadId: new FormControl<number | null>(null),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.minLength(8), Validators.maxLength(72), bcryptByteLimit] }),
    confirmation: new FormControl('', { nonNullable: true, validators: Validators.required }),
  }, { validators: (group) => group.get('password')?.value === group.get('confirmation')?.value ? null : { passwordMismatch: true } });
  private request?: Subscription;
  private closed = false;

  submit(): void {
    if (this.closed || this.saving()) return;
    this.form.markAllAsTouched();
    this.error.set('');
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    const body: CrearUsuarioAdmin = {
      email: value.email.trim(), password: value.password, tipoUsuario: value.tipoUsuario,
      ...(value.nombre.trim() ? { nombre: value.nombre.trim() } : {}),
      ...(value.tipoUsuario === 'FUNCIONARIO' && value.entidadId !== null ? { entidadId: value.entidadId } : {}),
    };
    this.saving.set(true);
    this.request = this.usuarios.crear(body).subscribe({
      next: (user) => {
        if (this.closed) return;
        this.saving.set(false);
        this.clearPassword();
        if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.email !== body.email || user.tipoUsuario !== body.tipoUsuario) {
          this.error.set('No se pudo confirmar el alta. Consulte el listado antes de volver a crear la cuenta.');
          return;
        }
        this.created.emit(user);
      },
      error: (err: { status?: number }) => {
        if (this.closed) return;
        this.saving.set(false);
        this.clearPassword();
        this.error.set(err.status === 400 ? 'Revise los datos del alta y vuelva a introducir la contraseña.'
          : err.status === 401 ? 'Su sesión no es válida. Inicie sesión nuevamente.'
          : err.status === 403 ? 'No tiene permiso para crear usuarios.'
          : err.status === 409 ? 'El correo ya está registrado. Consulte el listado de usuarios.'
          : 'No se pudo confirmar el alta. Consulte el listado antes de reintentar e introduzca nuevamente la contraseña.');
      },
    });
  }

  cancel(): void {
    this.ngOnDestroy();
    this.cancelled.emit();
  }

  ngOnDestroy(): void {
    this.closed = true;
    this.request?.unsubscribe();
    this.clearPassword();
  }

  private clearPassword(): void {
    this.form.controls.password.reset('');
    this.form.controls.confirmation.reset('');
  }
}
