import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { AuthService } from '../../services/auth.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-subsanacion',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './subsanacion.component.html',
  styleUrl: './subsanacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubsanacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly authService = inject(AuthService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  fundamentosAdicionales = '';

  nombreUsuario = signal<string>('');

  ngOnInit(): void {
    const sesion = this.authService.obtenerSesion();
    if (sesion) {
      this.nombreUsuario.set(sesion.nombre || 'Usuario');
    }

    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (expediente) {
      this.cargarApelacion(expediente);
    }
  }

  cargarApelacion(expediente: string): void {
    this.loadingApelacion.set(true);
    this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.apelacion.set(data);
        this.loadingApelacion.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la apelación');
        this.loadingApelacion.set(false);
      }
    });
  }

  calcularDiasRestantes(): number {
    const ap = this.apelacion();
    if (!ap || !ap.fechaSubsanacion || !ap.diasSubsanacion) return 0;

    const fechaLimite = new Date(ap.fechaSubsanacion);
    fechaLimite.setDate(fechaLimite.getDate() + ap.diasSubsanacion);
    const hoy = new Date();
    const diff = Math.ceil((fechaLimite.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  }

  enviarSubsanacion(): void {
    const ap = this.apelacion();
    if (!ap) return;

    if (!this.fundamentosAdicionales.trim()) {
      this.error.set('Debe ingresar los fundamentos adicionales o correcciones');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.apelacionService.subsanar(ap.id, this.fundamentosAdicionales).subscribe({
      next: () => {
        this.loading.set(false);
        this.mensaje.set('Subsanación enviada correctamente. Su apelación será revisada nuevamente.');
        setTimeout(() => this.router.navigate(['/ciudadano']), 2000);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.mensaje || err.error?.message || 'Error al enviar la subsanación');
      }
    });
  }
}

