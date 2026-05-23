import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
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
import {
  AyudaPublicaService,
  CategoriaAyudaPublica,
  ContactoAyudaPublica,
} from '../../services/ayuda-publica.service';

type FaqIcon = 'file' | 'scale' | 'clock' | 'shield';

interface FaqItem {
  question: string;
  answer: string;
}

interface FaqCategory {
  id: string;
  title: string;
  icon: FaqIcon;
  accent: string;
  questions: FaqItem[];
}

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
export class AyudaComponent implements OnInit {
  private readonly ayudaPublicaService = inject(AyudaPublicaService);

  readonly query = signal('');
  readonly openCategory = signal<string>('');
  readonly openQuestion = signal<string | null>(null);
  readonly allCategories = signal<FaqCategory[]>([]);
  readonly contacto = signal<ContactoAyudaPublica>({ telefono: '', correo: '', direccion: '' });

  readonly totalQuestions = computed(() =>
    this.allCategories().reduce((sum, category) => sum + category.questions.length, 0)
  );

  readonly categories = computed(() => {
    const search = this.query().trim().toLowerCase();
    const allCategories = this.allCategories();
    if (!search) {
      return allCategories;
    }

    return allCategories
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

  ngOnInit(): void {
    this.ayudaPublicaService.getAyuda().subscribe({
      next: (data) => {
        const categories = (data.categorias ?? []).map((category) => this.toFaqCategory(category));
        this.allCategories.set(categories);
        this.contacto.set(data.contacto ?? { telefono: '', correo: '', direccion: '' });
        this.openCategory.set(categories[0]?.id ?? '');
      },
      error: () => {
        this.allCategories.set([]);
        this.contacto.set({ telefono: '', correo: '', direccion: '' });
        this.openCategory.set('');
      },
    });
  }

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

  private toFaqCategory(category: CategoriaAyudaPublica): FaqCategory {
    return {
      id: category.id,
      title: category.titulo,
      icon: this.toFaqIcon(category.icono),
      accent: category.colorAcento || 'var(--brand-700)',
      questions: (category.preguntas ?? []).map((item) => ({
        question: item.pregunta,
        answer: item.respuesta,
      })),
    };
  }

  private toFaqIcon(icono: string | null | undefined): FaqIcon {
    const allowed: FaqIcon[] = ['file', 'scale', 'clock', 'shield'];
    return allowed.includes(icono as FaqIcon) ? icono as FaqIcon : 'file';
  }
}
