import { Component, ChangeDetectionStrategy, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

interface HomeChartDatum {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface HomeDonutChartDatum extends HomeChartDatum {
  dashArray: string;
  dashOffset: string;
}

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  private readonly platformId = inject(PLATFORM_ID);

  readonly indicadores = {
    saipPresentadas: 2847,
    respondidas: 1923,
    apelaciones: 412,
    entidades: 156,
  };

  readonly donutCircumference = 2 * Math.PI * 38;

  readonly solicitudesChartData = this.createChartData(
    [
      { label: 'Respondidas', value: this.indicadores.respondidas, color: '#059669' },
      { label: 'En apelacion', value: this.indicadores.apelaciones, color: '#D97706' },
      {
        label: 'En tramite',
        value: this.indicadores.saipPresentadas - this.indicadores.respondidas - this.indicadores.apelaciones,
        color: '#2563EB',
      },
    ],
    this.indicadores.saipPresentadas
  );

  readonly tipoRespuestaChartData = this.createChartData(
    [
      { label: 'Entrega total', value: 1284, color: '#059669' },
      { label: 'Entrega parcial', value: 639, color: '#22C55E' },
      { label: 'Denegada', value: 412, color: '#DC2626' },
      { label: 'Silencio administrativo', value: 512, color: '#374151' },
    ],
    this.indicadores.saipPresentadas
  );

  readonly tipoRespuestaDonutChartData = this.createDonutChartData(this.tipoRespuestaChartData);

  scrollToSection(sectionId: string): void {
    if (isPlatformBrowser(this.platformId)) {
      const element = document.getElementById(sectionId);
      if (element) {
        const offset = 80;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - offset;

        window.scrollTo({
          top: offsetPosition,
          behavior: 'smooth'
        });
      }
    }
  }

  scrollToTop(): void {
    if (isPlatformBrowser(this.platformId)) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  private createChartData(
    source: Array<{ label: string; value: number; color: string }>,
    total: number
  ): HomeChartDatum[] {
    return source.map((item) => ({
      ...item,
      percentage: this.toPercent(item.value, total),
    }));
  }

  private createDonutChartData(data: HomeChartDatum[]): HomeDonutChartDatum[] {
    let accumulated = 0;

    return data
      .filter((item) => item.value > 0)
      .map((item) => {
        const arc = this.donutCircumference * (item.percentage / 100);
        const result: HomeDonutChartDatum = {
          ...item,
          dashArray: `${arc} ${this.donutCircumference - arc}`,
          dashOffset: `-${accumulated}`,
        };
        accumulated += arc;
        return result;
      });
  }

  private toPercent(value: number, total: number): number {
    if (value <= 0 || total <= 0) {
      return 0;
    }
    return Number(((value / total) * 100).toFixed(1));
  }
}

