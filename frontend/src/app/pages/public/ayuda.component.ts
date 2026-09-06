import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  LucideAlertTriangle,
  LucideArrowLeft,
  LucideArrowRight,
  LucideBell,
  LucideBookOpen,
  LucideCheckCircle2,
  LucideChevronDown,
  LucideChevronRight,
  LucideCircleDot,
  LucideClock,
  LucideCoins,
  LucideFileSearch,
  LucideFileText,
  LucideGavel,
  LucideHelpCircle,
  LucideListChecks,
  LucideMail,
  LucideMapPin,
  LucidePackageCheck,
  LucidePauseCircle,
  LucidePenLine,
  LucidePhone,
  LucideRotateCcw,
  LucideRoute,
  LucideScale,
  LucideSearch,
  LucideSend,
  LucideShield,
  LucideSplit,
  LucideXCircle,
} from '@lucide/angular';

export interface RamaItem {
  label: string;
  tone: 'ok' | 'warn' | 'bad' | 'info';
  text: string;
}

export interface JourneyStepItem {
  icon: 'send' | 'file-search' | 'clock' | 'package-check' | 'coins' | 'scale' | 'split' | 'pause-circle' | 'gavel' | 'bell' | 'rotate-ccw';
  accent: string;
  plazo: string;
  title: string;
  desc: string;
  ramas: RamaItem[];
}

export interface GlosarioItem {
  estado: string;
  desc: string;
}

export interface GlosarioGrupo {
  grupo: string;
  accent: string;
  items: GlosarioItem[];
}

export interface FaqQuestion {
  q: string;
  a: string;
}

export interface FaqCategory {
  id: string;
  title: string;
  icon: 'file' | 'pen' | 'package' | 'scale' | 'clock' | 'shield';
  accent: string;
  questions: FaqQuestion[];
}

export const SAIP_JOURNEY: JourneyStepItem[] = [
  {
    icon: 'send', accent: 'var(--brand-700)', plazo: 'Gratuito',
    title: '1 · Presenta su SAIP',
    desc: 'Registra la solicitud por el canal digital indicando la entidad, el asunto y el detalle de la información. El sistema genera un número de expediente con fecha y hora, que constituye su cargo.',
    ramas: [],
  },
  {
    icon: 'file-search', accent: 'var(--info)', plazo: '2 días hábiles',
    title: '2 · Revisión de requisitos',
    desc: 'La entidad verifica que la solicitud cumpla los requisitos de ley. Si todo está conforme, pasa a trámite automáticamente.',
    ramas: [
      { label: 'Observada', tone: 'warn', text: 'Si falta un requisito o el pedido no es claro, la solicitud queda OBSERVADA. Usted tiene 2 días hábiles para subsanar o precisar. Si subsana correctamente, el plazo de atención recién empieza a contar desde el día siguiente.' },
      { label: 'No subsanada', tone: 'bad', text: 'Si no subsana dentro del plazo, la solicitud se archiva.' },
    ],
  },
  {
    icon: 'clock', accent: 'var(--brand-700)', plazo: '10 días hábiles',
    title: '3 · En trámite',
    desc: 'La entidad busca y prepara la información. Durante esta etapa pueden ocurrir situaciones especiales:',
    ramas: [
      { label: 'Prórroga', tone: 'info', text: 'De manera excepcional la entidad puede ampliar el plazo. Se le comunicará hasta el día hábil 2 la nueva fecha; si supera los 30 días hábiles, se le entregará un cronograma de entrega.' },
      { label: 'Encauzamiento total → denegatoria total', tone: 'bad', text: 'Si la entidad no posee la información ni está obligada a poseerla, remite toda la solicitud a la entidad competente. Para usted el tipo de respuesta es una denegatoria total: su SAIP queda "Denegada". El encauzamiento se comunica dentro de 4 días hábiles.' },
      { label: 'Encauzamiento parcial → entrega parcial', tone: 'warn', text: 'La entidad atiende la parte que sí le corresponde y remite a la entidad competente la parte ajena. El tipo de respuesta es entrega parcial; queda pendiente la información encauzada. El sistema genera el nuevo expediente en la entidad de destino.' },
    ],
  },
  {
    icon: 'package-check', accent: 'var(--success)', plazo: 'Resultado',
    title: '4 · Respuesta de la entidad',
    desc: 'La solicitud se resuelve con uno de estos sentidos:',
    ramas: [
      { label: 'Entrega total', tone: 'ok', text: 'Se entrega toda la información solicitada.' },
      { label: 'Entrega parcial', tone: 'warn', text: 'Se entrega una parte. La parte no atendida puede apelarse.' },
      { label: 'Denegatoria', tone: 'bad', text: 'Se rechaza el pedido, invocando una de las 7 causales de la ley (información inexistente, secreta, reservada, confidencial, etc.). Habilita apelación en 15 días hábiles.' },
      { label: 'Silencio administrativo', tone: 'bad', text: 'Si la entidad no responde dentro del plazo, se configura la denegatoria tácita. Puede apelar sin plazo perentorio.' },
    ],
  },
  {
    icon: 'coins', accent: 'var(--gold-dark)', plazo: 'Si aplica',
    title: '5 · Costo de reproducción',
    desc: 'La SAIP es gratuita, pero las copias/soportes tienen un costo de reproducción. Cuando corresponde, la entidad emite una liquidación detallada.',
    ramas: [
      { label: 'Cupón de pago', tone: 'info', text: 'Recibe una liquidación con el desglose (folios, copias certificadas, soporte). Al pagar, la información queda lista para recojo.' },
      { label: 'Recojo', tone: 'info', text: 'Tiene 30 días calendario para recoger la información puesta a disposición. Vencido el plazo sin recojo o sin pago, el expediente se archiva.' },
    ],
  },
  {
    icon: 'scale', accent: 'var(--brand-700)', plazo: '15 días hábiles',
    title: '6 · ¿No está conforme? Apele',
    desc: 'Si la respuesta lo deja insatisfecho (denegatoria, entrega parcial o silencio), puede recurrir en segunda instancia ante el Tribunal (TTAIP).',
    ramas: [],
  },
];

export const APELACION_JOURNEY: JourneyStepItem[] = [
  {
    icon: 'split', accent: 'var(--brand-700)', plazo: '3 vías de ingreso',
    title: '1 · Presenta la apelación',
    desc: 'Existen tres formas de llegar al Tribunal:',
    ramas: [
      { label: 'Directa', tone: 'info', text: 'Cuando su SAIP fue tramitada en esta plataforma, apela directamente.' },
      { label: 'Elevada por la entidad', tone: 'info', text: 'Si presentó su recurso físicamente ante la entidad, esta lo eleva al TTAIP.' },
      { label: 'Admisión excepcional', tone: 'info', text: 'Si apeló ante la entidad y esta no elevó el recurso, puede acreditarlo y el TTAIP admite excepcionalmente.' },
    ],
  },
  {
    icon: 'file-search', accent: 'var(--info)', plazo: '7 días hábiles',
    title: '2 · Primera calificación',
    desc: 'El Tribunal revisa que el recurso cumpla los requisitos formales:',
    ramas: [
      { label: 'Admisible', tone: 'ok', text: 'El recurso pasa a la etapa de resolución.' },
      { label: 'Inadmisible · subsanable', tone: 'warn', text: 'Tiene defectos formales. Usted cuenta con 2 días hábiles para subsanar. Si no subsana, se tiene por no presentado.' },
      { label: 'Improcedente', tone: 'bad', text: 'No corresponde al TTAIP resolver o no cumple requisitos de fondo. Concluye.' },
    ],
  },
  {
    icon: 'pause-circle', accent: 'var(--gold-dark)', plazo: 'Suspende el contador',
    title: '3 · Instrucción del expediente',
    desc: 'El Tribunal recaba información. Estas actuaciones suspenden el cómputo de los 10 días:',
    ramas: [
      { label: 'Descargos de la entidad', tone: 'info', text: 'La entidad tiene 7 días hábiles para presentar sus descargos. Estos 7 días siempre suspenden el plazo, presente o no.' },
      { label: 'Informe oral', tone: 'info', text: 'Si el recurrente o la entidad lo solicitan, suspende 3 días adicionales.' },
      { label: 'Información complementaria', tone: 'info', text: 'Si el TTAIP requiere más información, suspende 3 días adicionales.' },
    ],
  },
  {
    icon: 'gavel', accent: 'var(--brand-700)', plazo: '10 días efectivos',
    title: '4 · Resolución de fondo',
    desc: 'El Tribunal resuelve. Los sentidos posibles son:',
    ramas: [
      { label: 'Fundado / Fundado en parte', tone: 'ok', text: 'Se ordena a la entidad entregar la información. Abre seguimiento de cumplimiento.' },
      { label: 'Infundado / Infundado en parte', tone: 'bad', text: 'Se confirma la decisión de la entidad.' },
      { label: 'Nulidad', tone: 'warn', text: 'Se detecta un vicio: se retrotrae el procedimiento al momento del vicio y se ordena la actuación que corresponda.' },
      { label: 'Otros', tone: 'info', text: 'Improcedente, sustracción de la materia, desistimiento, estése a lo resuelto o tener por no presentado.' },
    ],
  },
  {
    icon: 'bell', accent: 'var(--info)', plazo: 'Puerta obligatoria',
    title: '5 · Notificación validada',
    desc: 'La resolución se notifica a ambas partes mediante cédula. Solo una notificación validada (con cargos y acuses conformes) da por concluido el trámite.',
    ramas: [],
  },
  {
    icon: 'rotate-ccw', accent: 'var(--success)', plazo: '7 días hábiles',
    title: '6 · Cumplimiento',
    desc: 'Solo cuando la resolución es fundada o fundada en parte, se abre el seguimiento del cumplimiento de la entidad. Si la entidad no cumple, el TTAIP reitera y usted puede recurrir a la vía judicial.',
    ramas: [],
  },
];

export const GLOSARIO: GlosarioGrupo[] = [
  {
    grupo: 'Estados de su SAIP',
    accent: 'var(--brand-700)',
    items: [
      { estado: 'Recepcionada', desc: 'La solicitud se registró y tiene número de expediente.' },
      { estado: 'En revisión', desc: 'La entidad verifica los requisitos de admisibilidad.' },
      { estado: 'Observada', desc: 'Falta un requisito o precisión. Debe subsanar en 2 días hábiles.' },
      { estado: 'En trámite', desc: 'Admitida; la entidad prepara la información (10 días hábiles).' },
      { estado: 'Encauzada', desc: 'La entidad derivó su pedido a la competente (4 días hábiles). Si el encauzamiento es total, el resultado es una denegatoria total; si es parcial, se atiende una parte y se remite la otra como entrega parcial.' },
      { estado: 'Entrega total / parcial', desc: 'La entidad respondió entregando toda o parte de la información.' },
      { estado: 'Denegada', desc: 'Se rechazó el pedido invocando una causal legal.' },
      { estado: 'Información puesta a disposición / Recogida', desc: 'Hay una liquidación/cupón; la información espera su pago y recojo (30 días calendario). Pasa a "Recogida" cuando usted la retira.' },
      { estado: 'Vencida · denegatoria tácita', desc: 'La entidad no respondió a tiempo: se configura el silencio administrativo negativo. Puede apelar.' },
      { estado: 'Atendida / Concluida', desc: 'El trámite terminó y el expediente está listo para archivo.' },
    ],
  },
  {
    grupo: 'Estados de su apelación',
    accent: 'var(--gold-dark)',
    items: [
      { estado: 'Elevada por la entidad', desc: 'Su apelación ingresó al TTAIP porque la entidad la elevó (vía B).' },
      { estado: 'En 1ra calificación', desc: 'El TTAIP revisa si el recurso es admisible (7 días hábiles).' },
      { estado: 'Inadmisible · subsanable / En subsanación', desc: 'El recurso tiene defectos formales; tiene 2 días hábiles para corregirlos.' },
      { estado: 'En 2da calificación', desc: 'Tras la subsanación, el Tribunal vuelve a calificar el recurso.' },
      { estado: 'En resolución', desc: 'El expediente está listo para que el Tribunal resuelva el fondo (10 días efectivos).' },
      { estado: 'Fundado / Fundado en parte', desc: 'Le dieron la razón; se ordena entregar la información y se abre seguimiento de cumplimiento.' },
      { estado: 'Infundado / Improcedente', desc: 'Se confirmó la denegación o el recurso no procedía.' },
      { estado: 'Nulidad del acto', desc: 'Se anula lo actuado y se retrotrae al momento del vicio.' },
      { estado: 'Sustracción / Desistimiento / Estése / No presentado', desc: 'Otras formas de conclusión del recurso previstas por la ley.' },
      { estado: 'Concluido', desc: 'La apelación quedó resuelta y notificada válidamente.' },
    ],
  },
];

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'saip', title: 'Solicitudes SAIP', icon: 'file', accent: 'var(--brand-700)',
    questions: [
      { q: '¿Qué es una solicitud SAIP?', a: 'Una Solicitud de Acceso a la Información Pública (SAIP) es el mecanismo formal mediante el cual cualquier administrado —persona natural (ciudadano) o persona jurídica (empresa)— puede solicitar información a una entidad del Estado peruano, en ejercicio del derecho fundamental reconocido por la Constitución y la Ley N° 27806.' },
      { q: '¿Quién puede presentar una SAIP?', a: 'Cualquier administrado. Si es persona natural (ciudadano) se identifica con su DNI; si es persona jurídica (empresa) se identifica con su RUC y actúa a través de su representante legal. En ambos casos el derecho de acceso a la información es el mismo.' },
      { q: '¿Qué información puedo solicitar?', a: 'Puede solicitar cualquier información que posea o produzca una entidad pública, salvo aquella que haya sido clasificada como secreta, reservada o confidencial conforme a ley. Esto incluye documentos, contratos, presupuestos, informes y actas.' },
      { q: '¿Cómo presento una solicitud SAIP?', a: 'Regístrese en la plataforma como persona natural (con su DNI) o persona jurídica (con su RUC), complete el formulario indicando la entidad, el asunto y la descripción detallada de la información que solicita; seleccione el formato de respuesta deseado y envíe.' },
      { q: '¿Cuánto cuesta presentar una SAIP?', a: 'La presentación es completamente gratuita. La reproducción (copias, CDs, etc.) puede tener un costo que corresponde únicamente al costo de reproducción, detallado en una liquidación.' },
      { q: '¿Cuánto tiempo tiene la entidad para responder?', a: 'La entidad tiene un plazo máximo de 10 días hábiles para responder, contados desde el día siguiente de su presentación. Puede prorrogarse de manera excepcional, comunicándole la nueva fecha o un cronograma si supera los 30 días hábiles.' },
    ],
  },
  {
    id: 'subsanacion', title: 'Observación y subsanación', icon: 'pen', accent: 'var(--warning)',
    questions: [
      { q: 'Mi solicitud aparece "Observada", ¿qué significa?', a: 'La entidad detectó que falta un requisito o que el pedido no es lo suficientemente claro. No es un rechazo: es un pedido de precisión. Debe subsanar dentro de 2 días hábiles contados desde el día siguiente de la notificación.' },
      { q: '¿Cómo subsano una observación?', a: 'Desde el detalle de su solicitud verá el requerimiento de la entidad y un espacio para responder o precisar. Al enviar su subsanación, la entidad la evalúa; si es correcta, la solicitud pasa a trámite y el plazo de 10 días recién empieza a contar.' },
      { q: '¿Qué pasa si no subsano a tiempo?', a: 'Si no subsana dentro de los 2 días hábiles, o si la subsanación no es aceptada, la solicitud se archiva por no haberse completado los requisitos.' },
      { q: '¿La causa más común de observación?', a: 'Que el pedido no sea concreto y preciso. Describa con el mayor detalle posible qué documento o dato necesita, el periodo y la entidad, para evitar observaciones.' },
    ],
  },
  {
    id: 'respuesta', title: 'Respuesta, costos y recojo', icon: 'package', accent: 'var(--success)',
    questions: [
      { q: '¿Qué tipos de respuesta puede dar la entidad?', a: 'Entrega total (toda la información), entrega parcial (una parte), o denegatoria (rechazo con causal legal). Si no responde a tiempo, se configura el silencio administrativo negativo.' },
      { q: '¿Cuáles son las causales de denegatoria?', a: 'La ley reconoce 7: información inexistente que debería crearse; que exige análisis o evaluación; extraviada/destruida; que la entidad no posee y no está obligada a poseer (encauzamiento); información secreta; reservada; o confidencial. Una sola causal debidamente motivada habilita la denegatoria y su apelación.' },
      { q: '¿Qué es el encauzamiento?', a: 'Es cuando la entidad no posee la información ni está obligada a poseerla y la deriva a la entidad competente, comunicándoselo dentro de 4 días hábiles. Si es TOTAL, se remite toda la solicitud y el tipo de respuesta es una denegatoria total (su SAIP queda "Denegada"). Si es PARCIAL, la entidad atiende la parte que le corresponde y remite la ajena, con tipo de respuesta "entrega parcial". El sistema genera el nuevo expediente en la entidad de destino.' },
      { q: '¿Qué es la liquidación y el cupón de pago?', a: 'Cuando hay costo de reproducción, la entidad emite una liquidación con el desglose: número de folios, copias certificadas y soporte (CD/USB). Ese monto se refleja en un cupón de pago. Al pagar, la información queda lista para recojo.' },
      { q: '¿Cuánto tiempo tengo para recoger la información?', a: 'Cuenta con 30 días calendario desde que la información se pone a disposición. Si no paga ni recoge en ese plazo, el expediente se archiva.' },
      { q: '¿La notificación siempre es física?', a: 'No. Puede ser física (con recojo) o por correo/plataforma. En ambos casos la entidad adjunta el cargo y valida la notificación.' },
    ],
  },
  {
    id: 'apelaciones', title: 'Apelaciones (TTAIP)', icon: 'scale', accent: 'var(--gold-dark)',
    questions: [
      { q: '¿Cuándo puedo presentar una apelación?', a: 'Cuando la entidad deniega total o parcialmente su solicitud, cuando la entrega es incompleta, o cuando no responde dentro del plazo (silencio administrativo negativo). Plazo: 15 días hábiles desde la notificación en denegatoria expresa; en silencio no hay plazo perentorio.' },
      { q: '¿Existen distintas formas de apelar?', a: 'Sí, tres vías: (1) directa —cuando su SAIP fue tramitada en la plataforma—; (2) elevada por la entidad —si apeló físicamente ante ella—; y (3) admisión excepcional —si apeló ante la entidad y esta no elevó su recurso, acreditando la omisión.' },
      { q: '¿Qué documentos necesito para apelar?', a: 'Identificación y domicilio, el acto impugnado y sus fundamentos, petitorio concreto, firma, copia de la SAIP atendida por la entidad y el cargo/respuesta cuando corresponda.' },
      { q: '¿Quién resuelve las apelaciones?', a: 'El Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), órgano colegiado autónomo del Ministerio de Justicia y Derechos Humanos.' },
      { q: '¿Qué resultados puede tener mi apelación?', a: 'Fundada o fundada en parte (se ordena entregar), infundada o infundada en parte (se confirma la denegación), improcedente, nulidad del acto (se retrotrae al vicio), sustracción de la materia, desistimiento, estése a lo resuelto o tener por no presentado.' },
      { q: 'Mi apelación fue "Fundada", ¿y ahora?', a: 'La entidad tiene 7 días hábiles para cumplir lo ordenado. El sistema abre el seguimiento del cumplimiento. Si la entidad no cumple, el TTAIP reitera y usted puede recurrir a la vía judicial.' },
    ],
  },
  {
    id: 'proceso', title: 'Plazos y seguimiento', icon: 'clock', accent: 'var(--info)',
    questions: [
      { q: '¿Cómo funciona el plazo de 10 días del Tribunal?', a: 'El TTAIP tiene 10 días hábiles efectivos para resolver. Ese cómputo se suspende durante los 7 días de descargos de la entidad y, si se solicitan, 3 días por informe oral y 3 días por información complementaria. Por eso a veces el proceso completo toma más tiempo calendario.' },
      { q: '¿Qué es la subsanación en segunda instancia?', a: 'Si el recurso de apelación tiene defectos formales, el TTAIP le otorga 2 días hábiles para subsanarlos. Si no lo hace, el recurso se tiene por no presentado.' },
      { q: '¿Qué son los descargos, el informe oral y la información complementaria?', a: 'Son actuaciones del expediente: los descargos son la posición de la entidad (7 días); el informe oral es una audiencia solicitada por las partes; y la información complementaria es lo que el TTAIP pide para resolver mejor. Las tres suspenden el contador de plazos.' },
      { q: '¿Cómo se calculan los días hábiles?', a: 'De lunes a viernes, excluyendo feriados nacionales y días no laborables del sector público. El conteo inicia desde el día siguiente a la notificación.' },
      { q: '¿Puedo dar seguimiento a mi solicitud?', a: 'Sí, en tiempo real desde su panel. También puede consultar de forma pública con el número de expediente, sin iniciar sesión. En cada etapa verá el estado, los plazos y las notificaciones emitidas.' },
      { q: '¿Qué pasa si la entidad no responde a tiempo?', a: 'Se configura el silencio administrativo negativo (denegatoria tácita). El sistema habilita el botón para apelar ante el TTAIP.' },
    ],
  },
  {
    id: 'cuenta', title: 'Cuenta y registro', icon: 'shield', accent: 'var(--success)',
    questions: [
      { q: '¿Necesito una cuenta para presentar una SAIP?', a: 'Sí. El registro es gratuito. La persona natural (ciudadano) se registra con su DNI y la persona jurídica (empresa) con su RUC; en ambos casos se solicitan datos básicos, domicilio y un correo electrónico.' },
      { q: '¿Qué datos necesito para registrarme?', a: 'Persona natural (ciudadano): DNI (8 dígitos), nombres y apellidos. Persona jurídica (empresa): RUC (11 dígitos), razón social y representante legal. En ambos casos: correo válido, teléfono celular (9 dígitos), domicilio completo y una contraseña de al menos 8 caracteres.' },
      { q: 'Olvidé mi contraseña, ¿qué hago?', a: 'Solicite el restablecimiento desde la página de inicio de sesión. Se enviará un enlace de recuperación a su correo registrado.' },
    ],
  },
];

@Component({
  selector: 'app-ayuda',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    RouterLink,
    LucideAlertTriangle,
    LucideArrowLeft,
    LucideArrowRight,
    LucideBell,
    LucideBookOpen,
    LucideCheckCircle2,
    LucideChevronDown,
    LucideChevronRight,
    LucideCircleDot,
    LucideClock,
    LucideCoins,
    LucideFileSearch,
    LucideFileText,
    LucideGavel,
    LucideHelpCircle,
    LucideListChecks,
    LucideMail,
    LucideMapPin,
    LucidePackageCheck,
    LucidePauseCircle,
    LucidePenLine,
    LucidePhone,
    LucideRotateCcw,
    LucideRoute,
    LucideScale,
    LucideSearch,
    LucideSend,
    LucideShield,
    LucideSplit,
    LucideXCircle,
  ],
  templateUrl: './ayuda.component.html',
})
export class AyudaComponent {
  readonly searchQuery = signal('');
  readonly tab = signal<'recorrido' | 'estados' | 'faq'>('recorrido');
  readonly openCategory = signal<string>('saip');
  readonly openQuestion = signal<string | null>(null);

  readonly saipJourney = SAIP_JOURNEY;
  readonly apelacionJourney = APELACION_JOURNEY;
  readonly glosario = GLOSARIO;
  readonly faqCategories = FAQ_CATEGORIES;

  readonly totalQuestions = computed(() =>
    this.faqCategories.reduce((sum, c) => sum + c.questions.length, 0)
  );

  readonly isSearching = computed(() => this.searchQuery().trim().length > 0);

  readonly filteredCategories = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) {
      return this.faqCategories;
    }
    return this.faqCategories
      .map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (faq) => faq.q.toLowerCase().includes(q) || faq.a.toLowerCase().includes(q)
        ),
      }))
      .filter((cat) => cat.questions.length > 0);
  });

  readonly currentFaqList = computed(() =>
    this.isSearching() ? this.filteredCategories() : this.faqCategories
  );

  onSearch(value: string): void {
    this.searchQuery.set(value);
    if (value.trim()) {
      this.tab.set('faq');
    }
  }

  setTab(newTab: 'recorrido' | 'estados' | 'faq'): void {
    this.tab.set(newTab);
  }

  setCategory(catId: string): void {
    this.openCategory.set(catId);
    this.openQuestion.set(null);
  }

  toggleCategory(catId: string): void {
    if (!this.isSearching()) {
      this.openCategory.set(this.openCategory() === catId ? '' : catId);
    }
  }

  toggleQuestion(key: string): void {
    this.openQuestion.set(this.openQuestion() === key ? null : key);
  }

  limpiarBusqueda(): void {
    this.searchQuery.set('');
  }
}
