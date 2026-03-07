import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-ttaip-segunda-calificacion',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-segunda-calificacion.component.html',
  styleUrl: './ttaip-segunda-calificacion.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipSegundaCalificacionComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly apelacionService = inject(ApelacionService);
  private readonly ttaipService = inject(TtaipService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(false);
  loadingApelacion = signal<boolean>(true);
  error = signal<string>('');
  mensaje = signal<string>('');
  activeTab = signal<string>('subsanacion');

  decision = '';
  fundamentos = '';

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

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
  }

  getObservaciones(): string[] {
    const ap = this.apelacion();
    if (ap?.resolucionPrimeraCalificacion?.observaciones) {
      return ap.resolucionPrimeraCalificacion.observaciones.split(';').map((o: string) => o.trim()).filter((o: string) => o.length > 0);
    }
    return [];
  }

  getSubsanacionFromFundamentos(): string {
    const ap = this.apelacion();
    if (ap?.fundamentos && ap.fundamentos.includes('--- SUBSANACIÓN ---')) {
      const parts = ap.fundamentos.split('--- SUBSANACIÓN ---');
      return parts.length > 1 ? parts[1].trim() : '';
    }
    return '';
  }

  getOriginalFundamentos(): string {
    const ap = this.apelacion();
    if (ap?.fundamentos) {
      if (ap.fundamentos.includes('--- SUBSANACIÓN ---')) {
        return ap.fundamentos.split('--- SUBSANACIÓN ---')[0].trim();
      }
      return ap.fundamentos;
    }
    return '';
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

    this.loading.set(true);
    this.error.set('');

    if (this.decision === 'admitir') {
      this.ttaipService.admitirApelacion(ap.id, { fundamentos: this.fundamentos }).subscribe({
        next: () => this.exito('Apelación admitida a trámite'),
        error: (err) => this.errorHandler(err)
      });
    } else {
      this.ttaipService.inadmitirApelacion(ap.id, { fundamentos: this.fundamentos }).subscribe({
        next: () => this.exito('Apelación declarada improcedente'),
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

