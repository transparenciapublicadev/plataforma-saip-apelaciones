import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideChevronDown,
  LucideClock,
  LucideFileText,
  LucideHelpCircle,
  LucideMapPin,
  LucideMail,
  LucidePhone,
  LucideScale,
  LucideSearch,
  LucideShield,
} from '@lucide/angular';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  title: string;
  icon: 'file' | 'scale' | 'clock' | 'shield';
  accent: string;
  questions: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'saip',
    title: 'Solicitudes SAIP',
    icon: 'file',
    accent: 'var(--brand-700)',
    questions: [
      {
        question: '¿Qué es una solicitud SAIP?',
        answer:
          'Una Solicitud de Acceso a la Información Pública (SAIP) es el mecanismo formal mediante el cual cualquier ciudadano puede solicitar información a una entidad del Estado peruano, en ejercicio del derecho fundamental reconocido por la Constitución y la Ley N° 27806.',
      },
      {
        question: '¿Qué información puedo solicitar?',
        answer:
          'Puede solicitar cualquier información que posea o produzca una entidad pública, salvo aquella que haya sido clasificada como secreta, reservada o confidencial conforme a ley. Esto incluye documentos, contratos, presupuestos, informes y actas.',
      },
      {
        question: '¿Cómo presento una solicitud SAIP?',
        answer:
          'Regístrese en la plataforma con su DNI, complete el formulario indicando la entidad, el asunto y la descripción detallada de la información que solicita; seleccione el formato de respuesta deseado y envíe.',
      },
      {
        question: '¿Cuánto cuesta presentar una SAIP?',
        answer:
          'La presentación es completamente gratuita. La reproducción (copias, CDs, etc.) puede tener un costo que corresponde únicamente al costo de reproducción.',
      },
      {
        question: '¿Cuánto tiempo tiene la entidad para responder?',
        answer:
          'La entidad tiene un plazo máximo de 10 días hábiles para responder, contados desde el día siguiente de su presentación. Puede prorrogarse 5 días hábiles adicionales de manera excepcional.',
      },
    ],
  },
  {
    id: 'apelaciones',
    title: 'Apelaciones',
    icon: 'scale',
    accent: 'var(--gold-dark)',
    questions: [
      {
        question: '¿Cuándo puedo presentar una apelación?',
        answer:
          'Cuando la entidad deniega total o parcialmente su solicitud, o cuando no responde dentro del plazo (silencio administrativo negativo). Plazo: 15 días calendario desde la notificación o vencimiento.',
      },
      {
        question: '¿Qué documentos necesito para apelar?',
        answer:
          'Tres documentos: (1) copia de la SAIP presentada, (2) copia de la respuesta denegatoria (o declaración jurada en silencio administrativo) y (3) escrito fundamentado del recurso.',
      },
      {
        question: '¿Quién resuelve las apelaciones?',
        answer:
          'El Tribunal de Transparencia y Acceso a la Información Pública (TTAIP), órgano colegiado autónomo del Ministerio de Justicia y Derechos Humanos.',
      },
      {
        question: '¿Cuánto demora la resolución?',
        answer:
          'El TTAIP tiene 10 días hábiles para resolver. El proceso completo (calificación, posible subsanación y resolución final) puede tomar entre 15 y 30 días hábiles.',
      },
      {
        question: '¿Qué resultados puede tener mi apelación?',
        answer:
          'Fundada (se ordena entregar la información), Infundada (se confirma la denegación) o Improcedente (no cumple requisitos formales).',
      },
    ],
  },
  {
    id: 'proceso',
    title: 'Proceso y plazos',
    icon: 'clock',
    accent: 'var(--info)',
    questions: [
      {
        question: '¿Qué es la subsanación?',
        answer:
          'Cuando la apelación tiene defectos formales, el TTAIP otorga 2 días hábiles para subsanar las observaciones. Si no se subsana, la apelación se archiva.',
      },
      {
        question: '¿Cómo se calculan los días hábiles?',
        answer:
          'De lunes a viernes, excluyendo feriados nacionales y días no laborables del sector público. El conteo inicia desde el día siguiente a la notificación.',
      },
      {
        question: '¿Puedo dar seguimiento a mi solicitud?',
        answer:
          'Sí. La plataforma permite seguimiento en tiempo real. También puede consultar de forma pública con el número de expediente, sin iniciar sesión.',
      },
      {
        question: '¿Qué pasa si la entidad no responde a tiempo?',
        answer:
          'Se configura el silencio administrativo negativo (denegación tácita). Puede presentar su apelación ante el TTAIP.',
      },
    ],
  },
  {
    id: 'cuenta',
    title: 'Cuenta y registro',
    icon: 'shield',
    accent: 'var(--success)',
    questions: [
      {
        question: '¿Necesito una cuenta para presentar una SAIP?',
        answer:
          'Sí. El registro es gratuito y solo requiere su DNI, datos personales básicos y un correo electrónico.',
      },
      {
        question: '¿Qué datos necesito para registrarme?',
        answer:
          'DNI (8 dígitos), nombres y apellidos completos, correo válido, teléfono celular (9 dígitos) y una contraseña de al menos 8 caracteres.',
      },
      {
        question: '¿Olvidé mi contraseña, qué hago?',
        answer:
          'Solicite el restablecimiento desde la página de inicio de sesión. Se enviará un enlace de recuperación a su correo registrado.',
      },
    ],
  },
];

@Component({
  selector: 'app-ayuda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideArrowRight,
    LucideChevronDown,
    LucideClock,
    LucideFileText,
    LucideHelpCircle,
    LucideMapPin,
    LucideMail,
    LucidePhone,
    LucideScale,
    LucideSearch,
    LucideShield,
  ],
  templateUrl: './ayuda.component.html',
})
export class AyudaComponent {
  readonly query = signal('');
  readonly openCategory = signal<string>('saip');
  readonly openQuestion = signal<string | null>(null);
  readonly totalQuestions = computed(() =>
    FAQ_CATEGORIES.reduce((sum, category) => sum + category.questions.length, 0)
  );

  readonly categories = computed(() => {
    const search = this.query().trim().toLowerCase();
    if (!search) {
      return FAQ_CATEGORIES;
    }

    return FAQ_CATEGORIES
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (item) =>
            item.question.toLowerCase().includes(search)
            || item.answer.toLowerCase().includes(search)
        ),
      }))
      .filter((category) => category.questions.length > 0);
  });

  setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  limpiarBusqueda(): void {
    this.query.set('');
  }

  seleccionarCategoria(categoryId: string): void {
    this.openCategory.set(categoryId);
    this.openQuestion.set(null);
  }

  toggleCategory(categoryId: string): void {
    this.openCategory.set(this.openCategory() === categoryId ? '' : categoryId);
  }

  toggleQuestion(questionId: string): void {
    this.openQuestion.set(this.openQuestion() === questionId ? null : questionId);
  }

  iconClassForCategory(active: boolean): string {
    if (active) {
      return 'w-10 h-10 rounded-md flex items-center justify-center mb-3 text-white';
    }
    return 'w-10 h-10 rounded-md flex items-center justify-center mb-3 border border-[var(--border)]';
  }
}
