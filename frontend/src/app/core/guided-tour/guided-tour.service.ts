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

  readonly currentStep = computed(() => {
    const s = this.steps();
    const idx = this.activeStepIndex();
    return s[idx] ?? null;
  });

  checkAutoStart(key: StorageKey, steps: TourStep[], delayMs = 700): void {
    if (typeof window === 'undefined') return;
    try {
      if (!localStorage.getItem(key)) {
        setTimeout(() => this.startTour(key, steps), delayMs);
      }
    } catch {
      /* storage unavailable */
    }
  }

  startTour(key: StorageKey, steps: TourStep[]): void {
    if (typeof window === 'undefined') return;
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
    if (key && typeof window !== 'undefined') {
      try {
        localStorage.setItem(key, '1');
      } catch {
        /* noop */
      }
    }
  }
}
