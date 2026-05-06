import { Component, ChangeDetectionStrategy, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApelacionService } from '../../services/apelacion.service';
import { Apelacion } from '../../models/apelacion.model';

@Component({
  selector: 'app-ttaip-resolucion-detalle',
  imports: [CommonModule, RouterLink],
  templateUrl: './ttaip-resolucion-detalle.component.html',
  styleUrl: './ttaip-resolucion-detalle.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TtaipResolucionDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly apelacionService = inject(ApelacionService);

  apelacion = signal<Apelacion | null>(null);
  loading = signal<boolean>(true);
  error = signal<string>('');
  activeTab = signal<string>('resolucion');

  ngOnInit(): void {
    const expediente = this.route.snapshot.paramMap.get('expediente');
    if (expediente) {
      this.cargarApelacion(expediente);
    }
  }

  cargarApelacion(expediente: string): void {
    this.loading.set(true);
    this.apelacionService.findByExpediente(expediente).subscribe({
      next: (data) => {
        this.apelacion.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Error al cargar la apelación');
        this.loading.set(false);
      }
    });
  }

  cambiarTab(tab: string): void {
    this.activeTab.set(tab);
  }

  getResultadoClass(resultado: string | undefined): string {
    if (!resultado) return 'bg-white/20 text-white';
    if (resultado === 'FUNDADO' || resultado === 'FUNDADO_EN_PARTE') return 'bg-[var(--estado-verde-suave)] text-[var(--estado-verde)]';
    if (resultado === 'INFUNDADO' || resultado === 'INFUNDADO_EN_PARTE') return 'bg-[var(--estado-rojo-suave)] text-[var(--estado-rojo)]';
    if (resultado === 'IMPROCEDENTE') return 'bg-[var(--estado-ambar-suave)] text-[var(--estado-ambar)]';
    if (resultado === 'CONCLUSION_SUSTRACCION_MATERIA') return 'bg-[var(--estado-azul-suave)] text-[var(--estado-azul)]';
    if (resultado === 'CONCLUSION_DESISTIMIENTO') return 'bg-[var(--nieve)] text-[var(--humo)]';
    if (resultado === 'TENER_POR_NO_PRESENTADO') return 'bg-[var(--nieve)] text-[var(--humo)]';
    return 'bg-white/20 text-white';
  }
}

