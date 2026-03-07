import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-ttaip-calificar',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-calificar.component.html',
  styleUrl: './ttaip-calificar.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipCalificarComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');

  decision = '';
  fundamentos = '';
  observaciones = '';
  diasSubsanacion = 2;

  ngOnInit(): void {
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

  enviarCalificacion(): void {
    const ap = this.apelacion();
    if (!ap) return;

    if (!this.decision) {
      this.error.set('Debe seleccionar una decisión');
      return;
    }
    if (!this.fundamentos.trim()) {
      this.error.set('Los fundamentos son obligatorios');
      return;
    }
    if (this.decision === 'subsanar' && !this.observaciones.trim()) {
      this.error.set('Las observaciones son obligatorias para subsanación');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    if (this.decision === 'admitir') {
      this.ttaipService.admitirApelacion(ap.id, { fundamentos: this.fundamentos }).subscribe({
        next: () => this.exito('Apelación admitida correctamente'),
        error: (err) => this.errorHandler(err)
      });
    } else if (this.decision === 'subsanar') {
      this.ttaipService.requerirSubsanacion(ap.id, {
        fundamentos: this.fundamentos,
        observaciones: this.observaciones,
        diasSubsanacion: this.diasSubsanacion
      }).subscribe({
        next: () => this.exito('Subsanación requerida correctamente'),
        error: (err) => this.errorHandler(err)
      });
    } else if (this.decision === 'inadmitir') {
      this.ttaipService.inadmitirApelacion(ap.id, { fundamentos: this.fundamentos }).subscribe({
        next: () => this.exito('Apelación inadmitida'),
        error: (err) => this.errorHandler(err)
      });
    }
  }

  private exito(msg: string): void {
    this.loading.set(false);
    this.mensaje.set(msg);
    setTimeout(() => this.router.navigate(['/ttaip']), 2000);
  }

  private errorHandler(err: any): void {
    this.loading.set(false);
    this.error.set(err.error?.mensaje || 'Error al procesar');
  }
}

