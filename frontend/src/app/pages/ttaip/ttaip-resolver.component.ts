import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { TtaipService } from '../../services/ttaip.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-ttaip-resolver',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ttaip-resolver.component.html',
  styleUrl: './ttaip-resolver.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolverComponent implements OnInit {
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
  iniciarProcesoDisciplinario = false;

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

  enviarResolucion(): void {
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

    const request = { fundamentos: this.fundamentos, iniciarProcesoDisciplinario: this.iniciarProcesoDisciplinario };

    const serviceMap: Record<string, () => void> = {
      'fundado': () => this.ttaipService.declararFundado(ap.id, request).subscribe({ next: () => this.exito('Apelación declarada FUNDADA'), error: (err) => this.errorHandler(err) }),
      'fundado_en_parte': () => this.ttaipService.declararFundadoEnParte(ap.id, request).subscribe({ next: () => this.exito('Apelación declarada FUNDADA EN PARTE'), error: (err) => this.errorHandler(err) }),
      'infundado': () => this.ttaipService.declararInfundado(ap.id, { fundamentos: this.fundamentos }).subscribe({ next: () => this.exito('Apelación declarada INFUNDADA'), error: (err) => this.errorHandler(err) }),
      'infundado_en_parte': () => this.ttaipService.declararInfundadoEnParte(ap.id, { fundamentos: this.fundamentos }).subscribe({ next: () => this.exito('Apelación declarada INFUNDADA EN PARTE'), error: (err) => this.errorHandler(err) }),
      'improcedente': () => this.ttaipService.declararImprocedente(ap.id, { fundamentos: this.fundamentos }).subscribe({ next: () => this.exito('Apelación declarada IMPROCEDENTE'), error: (err) => this.errorHandler(err) }),
      'sustraccion_materia': () => this.ttaipService.declararSustraccionMateria(ap.id, { fundamentos: this.fundamentos }).subscribe({ next: () => this.exito('Conclusión por sustracción de la materia'), error: (err) => this.errorHandler(err) }),
      'desistimiento': () => this.ttaipService.declararDesistimiento(ap.id, { fundamentos: this.fundamentos }).subscribe({ next: () => this.exito('Conclusión por desistimiento'), error: (err) => this.errorHandler(err) })
    };

    const handler = serviceMap[this.decision];
    if (handler) {
      handler();
    } else {
      this.loading.set(false);
      this.error.set('Decisión no válida');
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

  getDecisionLabel(): string {
    const labels: Record<string, string> = {
      'fundado': 'FUNDADA',
      'fundado_en_parte': 'FUNDADA EN PARTE',
      'infundado': 'INFUNDADA',
      'infundado_en_parte': 'INFUNDADA EN PARTE',
      'improcedente': 'IMPROCEDENTE',
      'sustraccion_materia': 'SUSTRACCIÓN DE MATERIA',
      'desistimiento': 'DESISTIMIENTO'
    };
    return labels[this.decision] || '';
  }
}

