import { Component, ChangeDetectionStrategy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-proceso-disciplinario',
  imports: [CommonModule, RouterLink],
  templateUrl: './proceso-disciplinario.component.html',
  styleUrl: './proceso-disciplinario.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcesoDisciplinarioComponent implements OnInit {
  procesos = signal<any[]>([]);
  loading = signal<boolean>(true);

  estadisticas = signal({
    enInvestigacion: 3,
    pendientesRemision: 2,
    remitidos: 8,
    archivados: 1
  });

  ngOnInit(): void {
    setTimeout(() => {
      this.procesos.set([
        {
          id: 1,
          expediente: 'PD-2025-00001',
          apelacionExpediente: 'TTAIP-2025-00089',
          entidad: 'Entidad Nacional de Educación',
          funcionario: 'Juan Pérez García',
          fechaInicio: '2025-01-15',
          estado: 'EN_INVESTIGACION',
          motivo: 'Incumplimiento de plazo de respuesta'
        },
        {
          id: 2,
          expediente: 'PD-2025-00002',
          apelacionExpediente: 'TTAIP-2025-00102',
          entidad: 'Entidad Nacional de Salud',
          funcionario: 'María López Ruiz',
          fechaInicio: '2025-02-20',
          estado: 'PENDIENTE_REMISION',
          motivo: 'Denegación injustificada'
        }
      ]);
      this.loading.set(false);
    }, 500);
  }

  getEstadoClass(estado: string): string {
    const clases: { [key: string]: string } = {
      'EN_INVESTIGACION': 'bg-yellow-100 text-yellow-800',
      'PENDIENTE_REMISION': 'bg-orange-100 text-orange-800',
      'REMITIDO': 'bg-blue-100 text-blue-800',
      'ARCHIVADO': 'bg-gray-100 text-gray-800'
    };
    return clases[estado] || 'bg-gray-100 text-gray-800';
  }

  getEstadoTexto(estado: string): string {
    const textos: { [key: string]: string } = {
      'EN_INVESTIGACION': 'En Investigación',
      'PENDIENTE_REMISION': 'Pendiente Remisión',
      'REMITIDO': 'Remitido a Contraloría',
      'ARCHIVADO': 'Archivado'
    };
    return textos[estado] || estado;
  }
}

