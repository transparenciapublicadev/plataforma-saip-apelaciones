import { Injectable, signal, computed } from '@angular/core';
import { StorageKey, TourStep } from './guided-tour.model';

@Injectable({
  providedIn: 'root'
})
export class GuidedTourService {
  readonly activeStepIndex = signal<number>(0);
  readonly isOpen = signal<boolean>(false);
  readonly steps = signal<TourStep[]>([]);
  readonly currentStorageKey = signal<StorageKey | null>(null);

  private readonly visitedKeys = signal<Set<string>>(this.initVisitedKeys());

  private initVisitedKeys(): Set<string> {
    const keys: StorageKey[] = ['saip_tour_done', 'saip_tour_funcionario', 'saip_tour_ttaip', 'saip_tour_admin'];
    const visited = new Set<string>();
    if (typeof window !== 'undefined') {
      keys.forEach(k => {
        try {
          if (localStorage.getItem(k)) visited.add(k);
        } catch {
          /* noop */
        }
      });
    }
    return visited;
  }

  readonly currentStep = computed(() => {
    const s = this.steps();
    const idx = this.activeStepIndex();
    return s[idx] ?? null;
  });

  closeUIOverlays(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('close-ui-overlays'));
    }
  }

  isFirstVisit(key: StorageKey): boolean {
    return !this.visitedKeys().has(key);
  }

  markAsVisited(key: StorageKey): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* noop */
      }
    }
    this.visitedKeys.update(set => {
      if (set.has(key)) return set;
      const next = new Set(set);
      next.add(key);
      return next;
    });
  }

  checkAutoStart(_key: StorageKey, _steps: TourStep[], _delayMs = 700): void {
    // Non-intrusive strategy: Automatic modal popping on page load is eliminated.
    // First-visit indicator is displayed on the "Ver tutorial" button instead.
  }

  startTour(key: StorageKey, steps: TourStep[]): void {
    if (typeof window === 'undefined') return;
    this.markAsVisited(key);
    this.closeUIOverlays();
    this.currentStorageKey.set(key);
    this.steps.set(steps);
    this.activeStepIndex.set(0);

    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      this.isOpen.set(true);
    }, 300);
  }

  nextStep(): void {
    const s = this.steps();
    const idx = this.activeStepIndex();
    if (idx < s.length - 1) {
      this.activeStepIndex.set(idx + 1);
    } else {
      this.endTour();
    }
  }

  prevStep(): void {
    const idx = this.activeStepIndex();
    if (idx > 0) {
      this.activeStepIndex.set(idx - 1);
    }
  }

  setStepIndex(index: number): void {
    const s = this.steps();
    if (index >= 0 && index < s.length) {
      this.activeStepIndex.set(index);
    }
  }

  endTour(): void {
    this.isOpen.set(false);
    const key = this.currentStorageKey();
    if (key) {
      this.markAsVisited(key);
    }

    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 100);
    }
  }
}
