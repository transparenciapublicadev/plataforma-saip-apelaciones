import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  LucideArrowRight,
  LucideBuilding2,
  LucideChevronDown,
  LucideFileText,
  LucideHelpCircle,
  LucideMail,
  LucidePhone,
  LucideScale,
  LucideSearch,
  LucideShield,
  LucideZap,
} from '@lucide/angular';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  title: string;
  icon: 'file' | 'scale' | 'process' | 'shield';
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
        question: 'Que es una solicitud SAIP?',
        answer:
          'Es el mecanismo formal para solicitar informacion a una entidad publica conforme a la Ley N. 27806.',
      },
      {
        question: 'Que informacion puedo solicitar?',
        answer:
          'Documentos, contratos, presupuestos, informes y actas en poder de entidades publicas, salvo excepciones legales.',
      },
      {
        question: 'Como presento una SAIP?',
        answer:
          'Registre su cuenta, seleccione entidad, describa el pedido, adjunte sustento y envie el formulario digital.',
      },
      {
        question: 'Cuanto tiempo tiene la entidad para responder?',
        answer:
          'El plazo maximo es de 10 dias habiles desde el dia habil siguiente a la recepcion de la solicitud.',
      },
      {
        question: 'La presentacion tiene costo?',
        answer:
          'La solicitud es gratuita. Solo puede cobrarse el costo de reproduccion cuando corresponda.',
      },
    ],
  },
  {
    id: 'apelaciones',
    title: 'Apelaciones TTAIP',
    icon: 'scale',
    accent: 'var(--gold-dark)',
    questions: [
      {
        question: 'Cuando puedo apelar?',
        answer:
          'Cuando hay denegatoria expresa o silencio administrativo. El plazo es de 15 dias calendario.',
      },
      {
        question: 'Que documentos necesito para apelar?',
        answer:
          'Solicitud SAIP, respuesta de la entidad (o silencio) y fundamentos del recurso con adjuntos pertinentes.',
      },
      {
        question: 'Quien resuelve la apelacion?',
        answer:
          'El Tribunal de Transparencia y Acceso a la Informacion Publica (TTAIP) en segunda instancia.',
      },
      {
        question: 'Cuanto demora una apelacion?',
        answer:
          'El TTAIP resuelve en 10 dias habiles luego de la etapa de admision y actuaciones previas.',
      },
      {
        question: 'Que resultados puede tener mi apelacion?',
        answer:
          'Fundado, fundado en parte, infundado, improcedente o conclusiones especiales conforme a normativa.',
      },
    ],
  },
  {
    id: 'proceso',
    title: 'Proceso y plazos',
    icon: 'process',
    accent: 'var(--info)',
    questions: [
      {
        question: 'Que es la subsanacion?',
        answer:
          'Cuando faltan requisitos, el tribunal solicita subsanar para continuar con la evaluacion del recurso.',
      },
      {
        question: 'Como se calculan los dias habiles?',
        answer:
          'De lunes a viernes, excluyendo feriados. El conteo inicia desde el dia habil siguiente al acto que corresponda.',
      },
      {
        question: 'Puedo dar seguimiento sin iniciar sesion?',
        answer:
          'Si. La consulta publica permite revisar estado y trazabilidad basica con el numero de expediente SAIP.',
      },
      {
        question: 'Que pasa si la entidad no responde?',
        answer:
          'Se configura silencio administrativo negativo y usted puede presentar apelacion ante el TTAIP.',
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
        question: 'Necesito cuenta para presentar SAIP?',
        answer:
          'Si. El registro ciudadano requiere DNI, datos basicos y correo electronico valido.',
      },
      {
        question: 'Que datos necesito para registrarme?',
        answer:
          'DNI, nombres completos, correo, telefono y una contrasena robusta.',
      },
      {
        question: 'Olvide mi contrasena, que hago?',
        answer:
          'Use la recuperacion de acceso desde login para restablecer su contrasena de forma segura.',
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
    LucideBuilding2,
    LucideChevronDown,
    LucideFileText,
    LucideHelpCircle,
    LucideMail,
    LucidePhone,
    LucideScale,
    LucideSearch,
    LucideShield,
    LucideZap,
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
