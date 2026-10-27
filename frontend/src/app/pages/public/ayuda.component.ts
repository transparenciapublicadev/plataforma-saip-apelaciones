import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
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

import { APELACION_JOURNEY, FAQ_CATEGORIES, GLOSARIO, SAIP_JOURNEY } from './ayuda-content';

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
  styleUrl: './ayuda.component.css',
})
export class AyudaComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
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
    const q = this.normalizar(this.searchQuery().trim());
    if (!q) {
      return this.faqCategories;
    }
    return this.faqCategories
      .map((cat) => ({
        ...cat,
        questions: cat.questions.filter(
          (faq) => this.normalizar(cat.title).includes(q) || this.normalizar(faq.q).includes(q) || this.normalizar(faq.a).includes(q)
        ),
      }))
      .filter((cat) => cat.questions.length > 0);
  });

  readonly currentFaqList = computed(() =>
    this.isSearching() ? this.filteredCategories() : this.faqCategories
  );

  readonly matchingQuestions = computed(() =>
    this.filteredCategories().reduce((sum, category) => sum + category.questions.length, 0)
  );

  constructor() {
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(fragment => {
      this.searchQuery.set('');
      this.openQuestion.set(null);
      this.tab.set(fragment === 'faq' || fragment === 'estados' ? fragment : 'recorrido');
    });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    this.openQuestion.set(null);
    if (value.trim()) {
      this.tab.set('faq');
    }
  }

  setTab(newTab: 'recorrido' | 'estados' | 'faq'): void {
    this.tab.set(newTab);
    this.openQuestion.set(null);
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
    this.openQuestion.set(null);
    this.searchInput()?.nativeElement.focus();
  }

  private normalizar(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
  }
}
