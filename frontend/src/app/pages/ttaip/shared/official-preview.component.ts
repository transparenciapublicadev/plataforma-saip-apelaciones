import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  LucideFileText,
  LucideMaximize2,
  LucideX,
} from '@lucide/angular';
import {
  CedulaRecipient,
  CedulaVariant,
  DRAFT_NOTICE,
  DRAFT_DETAILS,
  DocContext,
  OfficialStage,
  STAGE_LABEL,
  buildCtx,
  numeroEnLetras,
  recipientsForResolution,
  resolucionArticulos,
  resultadoLabel,
} from './official-docs.util';

type PreviewDocTab = 'resolucion' | 'cedula-recurrente' | 'cedula-entidad';

@Component({
  selector: 'app-official-preview',
  standalone: true,
  imports: [CommonModule, LucideFileText, LucideMaximize2, LucideX],
  template: `
    <div class="form-shell overflow-hidden">
      <!-- Header de la sección de vista previa -->
      <div
        class="flex items-center justify-between px-4 py-2.5 border-b"
        style="border-color: var(--border); background: var(--brand-subtle)"
      >
        <div class="flex items-center gap-2">
          <svg lucideFileText class="w-4 h-4" style="color: var(--brand-700)"></svg>
          <span class="text-xs font-semibold" style="color: var(--brand-700)">
            Borrador · {{ getStageTitle() }}
          </span>
        </div>

        <button
          type="button"
          (click)="toggleZoom()"
          class="w-7 h-7 rounded flex items-center justify-center transition-colors hover:bg-black/10"
          title="Pantalla completa"
        >
          <svg lucideMaximize2 class="w-3.5 h-3.5 text-foreground/80"></svg>
        </button>
      </div>

      <!-- Pestañas de previsualización -->
      <div
        class="flex border-b overflow-x-auto bg-card"
        style="border-color: var(--border)"
      >
        <button
          type="button"
          (click)="activeDoc.set('resolucion')"
          class="px-4 py-3 text-xs whitespace-nowrap relative flex-shrink-0 transition-colors"
          [style.color]="
            activeDoc() === 'resolucion' ? 'var(--brand-700)' : 'var(--muted-foreground)'
          "
          [style.fontWeight]="activeDoc() === 'resolucion' ? 600 : 400"
        >
          Resolución
          @if (activeDoc() === 'resolucion') {
            <span
              class="absolute left-0 right-0 bottom-[-1px] h-[2px]"
              style="background: var(--brand-700)"
            ></span>
          }
        </button>

        <button
          type="button"
          (click)="activeDoc.set('cedula-recurrente')"
          class="px-4 py-3 text-xs whitespace-nowrap relative flex-shrink-0 transition-colors"
          [style.color]="
            activeDoc() === 'cedula-recurrente' ? 'var(--brand-700)' : 'var(--muted-foreground)'
          "
          [style.fontWeight]="activeDoc() === 'cedula-recurrente' ? 600 : 400"
        >
          Cédula · Administrado
          @if (activeDoc() === 'cedula-recurrente') {
            <span
              class="absolute left-0 right-0 bottom-[-1px] h-[2px]"
              style="background: var(--brand-700)"
            ></span>
          }
        </button>

        @if (mostrarCedulaEntidad()) {
          <button
            type="button"
            (click)="activeDoc.set('cedula-entidad')"
            class="px-4 py-3 text-xs whitespace-nowrap relative flex-shrink-0 transition-colors"
            [style.color]="
              activeDoc() === 'cedula-entidad' ? 'var(--brand-700)' : 'var(--muted-foreground)'
            "
            [style.fontWeight]="activeDoc() === 'cedula-entidad' ? 600 : 400"
          >
            Cédula · Entidad
            @if (activeDoc() === 'cedula-entidad') {
              <span
                class="absolute left-0 right-0 bottom-[-1px] h-[2px]"
                style="background: var(--brand-700)"
              ></span>
            }
          </button>
        }
      </div>

      <!-- Contenedor Hoja de papel A4 -->
      <div
        class="relative overflow-auto p-4 md:p-6"
        style="background: var(--muted); max-height: 72vh"
      >
        <ng-container *ngTemplateOutlet="documentSheet; context: { fullscreen: false }"></ng-container>
      </div>
    </div>

    <!-- Modal Fullscreen / Zoom -->
    @if (isZoomed()) {
      <div
        class="fixed inset-0 z-[70] overflow-auto p-4 md:p-10 bg-black/80 flex items-start justify-center backdrop-blur-xs"
        (click)="isZoomed.set(false)"
      >
        <button
          type="button"
          (click)="isZoomed.set(false)"
          class="fixed top-4 right-4 w-10 h-10 rounded-md flex items-center justify-center z-10 text-white bg-white/20 hover:bg-white/30"
          title="Cerrar vista completa"
        >
          <svg lucideX class="w-5 h-5"></svg>
        </button>

        <div (click)="$event.stopPropagation()" class="my-auto">
          <ng-container *ngTemplateOutlet="documentSheet; context: { fullscreen: true }"></ng-container>
        </div>
      </div>
    }

    <!-- Template de la Hoja A4 Reutilizable -->
    <ng-template #documentSheet let-fullscreen="fullscreen">
      <div
        class="mx-auto bg-white text-black select-text"
        [style.maxWidth.px]="760"
        style="
          width: 100%;
          padding: 54px 64px 44px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.16);
          font-family: Georgia, 'Times New Roman', serif;
          color: #1a1a1a;
          line-height: 1.55;
        "
      >
        <p role="note" style="border: 2px solid #8b1a1a; padding: 8px; font-weight: 700; text-align: center">
          {{ draftNotice }}
        </p>
        <p style="font-size: 11px; margin: 8px 0 16px">{{ draftDetails }}</p>
        <p style="font-size: 11px">Numeración mostrada: solo referencia registrada, cuando exista; este borrador no la reserva ni acredita emisión.</p>
        <!-- A) Vista de Resolución -->
        @if (activeDoc() === 'resolucion') {
          <!-- Escudo Oficial -->
          <div style="text-align: center; margin-bottom: 8px">
            <img
              src="/assets/oficial/iconos/escudo.png"
              alt="Escudo Nacional del Perú"
              style="height: 90px; display: inline-block; object-fit: contain"
            />
          </div>

          <p
            style="
              text-align: center;
              font-style: italic;
              font-size: 17px;
              margin: 4px 0 2px;
              font-weight: 500;
            "
          >
            Tribunal de Transparencia y Acceso a la Información Pública
          </p>
          <div style="border-bottom: 1px solid #777; margin: 6px 0 16px"></div>

          <p style="text-align: center; font-weight: 700; letter-spacing: 0.3px; margin: 0 0 4px">
            RESOLUCIÓN N.° {{ effectiveResolucionNro() }}
          </p>
          <p
            style="
              text-align: center;
              font-style: italic;
              font-size: 13px;
              color: #444;
              margin: 0 0 18px;
            "
          >
            {{ getStageTitle() }}
          </p>

          <!-- Bloque de datos del caso -->
          <table
            style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 18px"
          >
            <tbody>
              <tr>
                <td
                  style="
                    vertical-align: top;
                    font-weight: 700;
                    white-space: nowrap;
                    padding-right: 12px;
                    width: 130px;
                  "
                >
                  Expediente N.°
                </td>
                <td style="vertical-align: top">: {{ contextData().expediente }}</td>
              </tr>
              <tr>
                <td style="vertical-align: top; font-weight: 700; white-space: nowrap; padding-right: 12px">
                  Recurrente
                </td>
                <td style="vertical-align: top">: {{ contextData().recurrente }}</td>
              </tr>
              <tr>
                <td style="vertical-align: top; font-weight: 700; white-space: nowrap; padding-right: 12px">
                  Entidad
                </td>
                <td style="vertical-align: top">: {{ contextData().entidad }}</td>
              </tr>
              <tr>
                <td style="vertical-align: top; font-weight: 700; white-space: nowrap; padding-right: 12px">
                  Sumilla
                </td>
                <td style="vertical-align: top">: {{ contextData().sumilla }}</td>
              </tr>
            </tbody>
          </table>

          <p style="text-align: right; margin: 0 0 16px; font-size: 13px">
            Miraflores, {{ contextData().fechaResolucion }}
          </p>

          <p style="text-align: justify; margin: 0 0 12px; font-size: 13.5px">
            <strong>VISTO:</strong> {{ vistos || ('El recurso de apelación interpuesto por ' + contextData().recurrente + ' contra ' + contextData().entidad + ', en el procedimiento de acceso a la información pública tramitado en el expediente de la referencia; y,') }}
          </p>

          <p style="text-align: center; font-weight: 700; margin: 16px 0 8px; font-size: 13.5px">
            CONSIDERANDO:
          </p>

          @if (considerando) {
            <p style="text-align: justify; margin: 0 0 12px; font-size: 13px">
              {{ considerando }}
            </p>
          } @else {
            <p style="font-weight: 700; margin: 0 0 4px; font-size: 13px">I. ANTECEDENTES</p>
            <p style="text-align: justify; margin: 0 0 10px; font-size: 13px">
              Que, el recurrente presentó ante {{ contextData().entidad }} una solicitud de acceso a la
              información pública al amparo del derecho fundamental reconocido en el numeral 5 del
              artículo 2 de la Constitución Política del Perú y en el Texto Único Ordenado de la Ley
              N.° 27806, Ley de Transparencia y Acceso a la Información Pública.
            </p>
            <p style="text-align: justify; margin: 0 0 12px; font-size: 13px">
              Que, ante la respuesta o denegatoria de la entidad, el administrado interpuso recurso de
              apelación, elevándose los actuados a este Tribunal para su calificación y resolución
              conforme a sus competencias.
            </p>

            <p style="font-weight: 700; margin: 10px 0 4px; font-size: 13px">II. ANÁLISIS</p>
            <p style="text-align: justify; margin: 0 0 10px; font-size: 13px">
              Que, el derecho de acceso a la información pública es un principio medular del Estado
              constitucional que garantiza a toda persona acceder a los documentos en poder de la
              administración sin expresión de causa, salvo excepciones taxativas de ley.
            </p>
            <p style="text-align: justify; margin: 0 0 10px; font-size: 13px">
              Que, conforme al artículo 3 de la Ley N.° 27806, toda información en poder de las
              entidades públicas se presume pública, correspondiendo a la entidad la carga probatoria
              de acreditar cualquier excepción legal aplicable.
            </p>
            <p style="text-align: justify; margin: 0 0 14px; font-size: 13px">
              Que, valorados los actuados y los argumentos expuestos por las partes, este Colegiado
              concluye que corresponde declarar
              <strong>{{ currentResultadoLabel() }}</strong> el recurso de apelación de conformidad con
              los fundamentos precedentes.
            </p>
          }

          <p style="text-align: center; font-weight: 700; margin: 16px 0 8px; font-size: 13.5px">
            SE RESUELVE:
          </p>

          @if (seResuelve) {
            <p style="text-align: justify; margin: 0 0 10px; font-size: 13px">
              <strong>Artículo 1.-</strong> {{ seResuelve }}
            </p>
          } @else {
            @for (art of articulosResolucion(); track $index) {
              <p style="text-align: justify; margin: 0 0 10px; font-size: 13px">
                <strong>Artículo {{ $index + 1 }}.-</strong> {{ art }}
              </p>
            }
          }

          <p style="text-align: center; margin: 20px 0 4px; font-size: 13px">
            Regístrese, comuníquese y publíquese.
          </p>

          <div style="text-align: center; margin-top: 36px; font-size: 12px">
            Firmantes no disponibles. Sin verificación de firma digital.
          </div>
        }

        <!-- B) Vista de Cédula (Administrado o Entidad) -->
        @if (activeDoc() === 'cedula-recurrente' || activeDoc() === 'cedula-entidad') {
          <div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a">
            <!-- Banners MINJUS y Bicentenario -->
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 6px;
              "
            >
              <img
                src="/assets/oficial/iconos/minjus-banner.png"
                alt="MINJUS — Tribunal de Transparencia"
                style="height: 44px; object-fit: contain"
              />
              <img
                src="/assets/oficial/iconos/bicentenario.png"
                alt="200 años de Justicia"
                style="height: 50px; object-fit: contain"
              />
            </div>

            <p
              style="
                text-align: center;
                font-style: italic;
                font-size: 11px;
                color: #333;
                margin: 6px 0 2px;
              "
            >
              “Año de la Esperanza y el Fortalecimiento de la Democracia”
            </p>
            <p
              style="
                text-align: center;
                font-style: italic;
                font-size: 13px;
                margin: 8px 0 4px;
                font-weight: 600;
              "
            >
              Tribunal de Transparencia y Acceso a la Información Pública
            </p>

            <p
              style="
                text-align: center;
                font-weight: 700;
                text-decoration: underline;
                font-size: 14px;
                margin: 14px 0 16px;
              "
            >
              CÉDULA DE NOTIFICACIÓN N.° {{ effectiveCedulaNro() }}
            </p>

            <!-- Datos de notificación -->
            <table
              style="width: 100%; border-collapse: collapse; font-size: 12.5px; margin-bottom: 16px"
            >
              <tbody>
                <tr>
                  <td
                    style="
                      vertical-align: top;
                      font-weight: 700;
                      white-space: nowrap;
                      padding-right: 10px;
                      width: 120px;
                    "
                  >
                    Expediente N.°
                  </td>
                  <td style="vertical-align: top">: {{ contextData().expediente }}</td>
                </tr>
                <tr>
                  <td
                    style="
                      vertical-align: top;
                      font-weight: 700;
                      white-space: nowrap;
                      padding-right: 10px;
                    "
                  >
                    {{
                      activeDoc() === 'cedula-recurrente'
                        ? (contextData().recurrenteTipo === 'juridica'
                            ? 'Razón social'
                            : 'Señor(a)')
                        : 'Entidad'
                    }}
                  </td>
                  <td style="vertical-align: top">
                    :
                    {{
                      activeDoc() === 'cedula-recurrente'
                        ? contextData().recurrente
                        : contextData().entidad
                    }}
                  </td>
                </tr>
                <tr>
                  <td
                    style="
                      vertical-align: top;
                      font-weight: 700;
                      white-space: nowrap;
                      padding-right: 10px;
                    "
                  >
                    Domicilio
                  </td>
                  <td style="vertical-align: top">
                    :
                    {{
                      activeDoc() === 'cedula-recurrente'
                        ? contextData().correo
                        : contextData().direccionEntidad
                    }}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style="border-bottom: 1px solid #333; margin: 0 0 16px"></div>

            <!-- Cuerpo de la cédula -->
            <div style="font-size: 12.5px; line-height: 1.6">
              <p style="text-align: justify; margin: 0 0 12px">
                Por disposición del Tribunal de Transparencia y Acceso a la Información Pública se
                propone la notificación de la
                <strong>RESOLUCIÓN N.° {{ effectiveResolucionNro() }}</strong> de fecha
                {{ contextData().fechaResolucion }}, la cual declara
                <strong>{{ currentResultadoLabel() }}</strong> el recurso de apelación.
                @if (contextData().folios !== null) {
                  Folios: {{ numeroEnLetras(contextData().folios) }} ({{ contextData().folios }}).
                } @else { Folios no registrados. }
              </p>

              @if (contextData().driveUrl) {
              <p style="text-align: justify; margin: 0 0 12px">
                Enlace registrado de descarga de los actuados:
                <a
                  [href]="contextData().driveUrl"
                  target="_blank"
                  rel="noopener"
                  style="color: #1155cc; word-break: break-all"
                >
                  {{ contextData().driveUrl }}
                </a>
              </p>

              } @else { <p>Enlace de actuados no disponible.</p> }

              @if (cedulaVariant === 'fundado') {
                <p style="text-align: justify; margin: 0 0 12px">
                  Finalmente, ponemos en su conocimiento la nota informativa a tener en cuenta en caso
                  de incumplimiento de la entidad respecto de lo ordenado en la mencionada resolución:
                  <a
                    href="https://www.gob.pe/institucion/minjus/informes-publicaciones/6146010-nota-informativa"
                    target="_blank"
                    rel="noopener"
                    style="color: #1155cc; word-break: break-all"
                  >
                    https://www.gob.pe/institucion/minjus/informes-publicaciones/6146010-nota-informativa
                  </a>
                </p>
              }

              @if (activeDoc() === 'cedula-recurrente' && cedulaVariant !== 'otro') {
                <p style="text-align: justify; margin: 0 0 12px">
                  Se le informa que la presente notificación se realiza al correo electrónico
                  consignado por usted, en señal de autorización expresa para ser notificado por este
                  medio, conforme a los Lineamientos aprobados por el Tribunal.
                </p>
              }
            </div>

            <p style="text-align: right; font-size: 12.5px; margin: 20px 0 18px">
              Miraflores, {{ contextData().fechaCedula }}
            </p>

            <div style="text-align: center; font-size: 12.5px; margin-bottom: 22px">
              Secretario técnico: no disponible. Sin verificación de firma digital.
            </div>

            <!-- Nota institucional -->
            <div style="font-size: 10.5px; color: #333">
              <p style="font-weight: 700; margin: 0 0 4px">NOTA:</p>
              <p style="margin: 0 0 6px; padding-left: 12px; text-align: justify">
                • La presentación de todo escrito (recurso de apelación, descargos u otro documento)
                debe realizarse en la mesa de partes virtual o física (Scipión Llona 350, Miraflores –
                Lima). Consultas sobre el trámite del expediente al (01) 204 8020 anexo 1301.
              </p>
              <p style="margin: 0 0 8px; padding-left: 12px; text-align: justify">
                • Si busca dar respuesta a una comunicación nuestra, señale en el formulario de Mesa
                de Partes, en el campo “Datos del Documento”, que SÍ está realizando un trámite de
                respuesta e indique como referencia el número de la presente cédula.
              </p>
              <p
                style="
                  font-size: 9px;
                  color: #777;
                  text-align: justify;
                  border-top: 1px solid #ccc;
                  padding-top: 6px;
                "
              >
                Borrador de plantilla. No acredita emisión ni autenticidad del documento del expediente.
              </p>
            </div>
          </div>
        }
      </div>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfficialPreviewComponent implements OnChanges {
  @Input({ required: true }) stage: OfficialStage = 'primera';
  @Input() decision: string | null | undefined = null;
  @Input() cedulaVariant: CedulaVariant = 'otro';
  @Input() ctx: Partial<DocContext> = {};
  @Input() vistos?: string;
  @Input() considerando?: string;
  @Input() seResuelve?: string;

  readonly activeDoc = signal<PreviewDocTab>('resolucion');
  readonly isZoomed = signal<boolean>(false);

  readonly draftNotice = DRAFT_NOTICE;
  readonly draftDetails = DRAFT_DETAILS;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ctx']) {
      this.activeDoc.set('resolucion');
      this.isZoomed.set(false);
    }
    if (changes['decision'] || changes['stage']) {
      if (this.activeDoc() === 'cedula-entidad' && !this.mostrarCedulaEntidad()) {
        this.activeDoc.set('resolucion');
      }
    }
  }

  toggleZoom(): void {
    this.isZoomed.update((v) => !v);
  }

  getStageTitle(): string {
    return STAGE_LABEL[this.stage];
  }

  contextData(): DocContext {
    return buildCtx(this.ctx, this.stage);
  }

  mostrarCedulaEntidad(): boolean {
    const recipients = recipientsForResolution(this.stage, this.decision || undefined);
    return recipients.includes('entidad');
  }

  currentResultadoLabel(): string {
    return resultadoLabel(this.stage, this.decision || undefined);
  }

  effectiveResolucionNro(): string { return this.contextData().resolucionNro; }

  effectiveCedulaNro(): string { return this.contextData().cedulaNro; }

  articulosResolucion(): string[] {
    return resolucionArticulos(this.stage, this.decision || undefined, this.contextData());
  }

  numeroEnLetras(n: number | null): string {
    return numeroEnLetras(n);
  }
}
