import { isPlatformBrowser } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, PLATFORM_ID, afterNextRender, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { combineLatest } from 'rxjs';
import { LucideArrowRight, LucideCheck, LucideCode2, LucidePenTool } from '@lucide/angular';
import { InfoPageShellComponent } from './info-page-shell.component';
import { YaikuLogoComponent } from '../../shared/yaiku-logo.component';

@Component({
  selector: 'app-info-pages',
  imports: [RouterLink, InfoPageShellComponent, YaikuLogoComponent, LucideArrowRight, LucideCheck, LucideCode2, LucidePenTool],
  templateUrl: './info-pages.component.html',
  styleUrl: './info-pages.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InfoPagesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));
  private focusGeneration = 0;
  readonly page = signal<'documentacion' | 'acerca' | null>(null);
  readonly modules = [
    { perfil: 'Administrado', quien: 'Personas que solicitan información', items: [
      'Presentar solicitudes SAIP a las entidades disponibles.',
      'Consultar el expediente autorizado desde el panel ciudadano.',
      'Atender requerimientos de precisión SAIP y subsanación TTAIP.',
      'Preparar una apelación vinculada a una solicitud o una apelación externa.',
    ] },
    { perfil: 'Funcionario de la entidad', quien: 'Acceso institucional autorizado', items: [
      'Consultar las solicitudes del ámbito institucional autorizado.',
      'Registrar respuestas totales, parciales o denegatorias con su fundamento.',
      'Adjuntar documentos a la respuesta y recuperar su recepción.',
      'Utilizar las actuaciones habilitadas según las condiciones del expediente.',
    ] },
    { perfil: 'Personal del TTAIP', quien: 'Segunda instancia administrativa', items: [
      'Consultar apelaciones y las actuaciones registradas.',
      'Utilizar las operaciones de calificación y resolución que estén habilitadas.',
      'Consultar seguimientos de cumplimiento registrados.',
      'Distinguir borradores de documentos y actuaciones persistidos.',
    ] },
    { perfil: 'Administrador', quien: 'Gestión mediante acceso interno autorizado', items: [
      'Gestionar usuarios y entidades con los permisos correspondientes.',
      'Consultar los reportes y opciones de configuración disponibles.',
    ] },
  ];
  readonly guide = [
    { title: 'Crea tu cuenta', detail: 'Utiliza el registro del acceso ciudadano y completa los datos solicitados.' },
    { title: 'Presenta tu SAIP', detail: 'Elige la entidad, describe la información y revisa el medio de entrega.' },
    { title: 'Consulta tu expediente', detail: 'Ingresa a tu panel para revisar los datos y actuaciones autorizados.' },
    { title: 'Atiende requerimientos', detail: 'Abre el requerimiento concreto y sigue las indicaciones de su formulario.' },
    { title: 'Prepara tu apelación', detail: 'Utiliza el recorrido vinculado a tu solicitud o el de apelación externa, según corresponda.' },
  ];

  constructor() {
    const title = inject(Title);
    const previousTitle = title.getTitle();
    // Direct SSR entry already has this route's title; restore the existing index
    // title when leaving for routes that do not define one, without changing them.
    const returnTitle = ['Documentación | Yaiku', 'Acerca de Yaiku'].includes(previousTitle)
      ? 'TTAIP - Sistema de Acceso a la Información Pública' : previousTitle;
    inject(DestroyRef).onDestroy(() => { ++this.focusGeneration; title.setTitle(returnTitle); });
    combineLatest([this.route.data, this.route.fragment]).pipe(takeUntilDestroyed()).subscribe(([data, fragment]) => {
      this.page.set(data['infoPage'] === 'documentacion' || data['infoPage'] === 'acerca' ? data['infoPage'] : null);
      const generation = ++this.focusGeneration;
      if (!this.browser) return;
      afterNextRender(() => {
        if (generation !== this.focusGeneration) return;
        const root = this.host.nativeElement;
        // Match literal IDs inside this page; fragments never become CSS selectors.
        const section = fragment ? Array.from(root.querySelectorAll<HTMLElement>('h2[id]')).find(node => node.id === fragment) : null;
        const target = section || root.querySelector<HTMLElement>('h1');
        if (section) section.scrollIntoView?.({ block: 'start', behavior: 'instant' });
        target?.focus({ preventScroll: true });
      }, { injector: this.injector });
    });
  }
}
