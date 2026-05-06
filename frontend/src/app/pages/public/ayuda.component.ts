import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  title: string;
  questions: FaqItem[];
}

const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: 'saip',
    title: 'Solicitudes SAIP',
    questions: [
      {
        question: 'Que es una solicitud SAIP?',
        answer:
          'Es el mecanismo formal para solicitar informacion a una entidad publica en el marco de la Ley N. 27806.',
      },
      {
        question: 'Cuanto tiempo tiene la entidad para responder?',
        answer:
          'La entidad tiene 10 dias habiles para responder, contados desde el dia habil siguiente a la recepcion.',
      },
      {
        question: 'La presentacion tiene costo?',
        answer:
          'La presentacion de la solicitud es gratuita. Solo puede cobrarse el costo de reproduccion de documentos.',
      },
    ],
  },
  {
    id: 'apelaciones',
    title: 'Apelaciones TTAIP',
    questions: [
      {
        question: 'Cuando puedo apelar?',
        answer:
          'Puede apelar ante denegatoria expresa o silencio administrativo, dentro del plazo legal de 15 dias.',
      },
      {
        question: 'Quien resuelve la apelacion?',
        answer:
          'El Tribunal de Transparencia y Acceso a la Informacion Publica (TTAIP) resuelve en segunda instancia.',
      },
      {
        question: 'Cuanto demora una apelacion?',
        answer:
          'La resolucion final tiene un plazo de 10 dias habiles luego de culminar las etapas previas del procedimiento.',
      },
    ],
  },
  {
    id: 'cuenta',
    title: 'Cuenta y registro',
    questions: [
      {
        question: 'Que necesito para registrarme?',
        answer:
          'DNI, nombres completos, correo valido, telefono y una contrasena robusta para su cuenta ciudadana.',
      },
      {
        question: 'Puedo consultar sin registrarme?',
        answer:
          'Si. Puede usar la opcion de consulta publica con el numero de expediente SAIP.',
      },
      {
        question: 'Como recupero mi contrasena?',
        answer:
          'Desde login puede seleccionar recuperacion de contrasena para restablecer acceso de forma segura.',
      },
    ],
  },
];

@Component({
  selector: 'app-ayuda',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './ayuda.component.html',
})
export class AyudaComponent {
  readonly query = signal('');
  readonly openCategory = signal<string>('saip');
  readonly openQuestion = signal<string | null>(null);

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

  toggleCategory(categoryId: string): void {
    this.openCategory.set(this.openCategory() === categoryId ? '' : categoryId);
  }

  toggleQuestion(questionId: string): void {
    this.openQuestion.set(this.openQuestion() === questionId ? null : questionId);
  }
}
