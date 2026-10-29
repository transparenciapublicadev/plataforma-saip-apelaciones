import { Injectable, signal, computed } from '@angular/core';
import { StorageKey, TourStep } from './guided-tour.model';

@Injectable({
  providedIn: 'root'
})
export class GuidedTourService {
  readonly activeStepIndex = signal<number>(0);
  readonly isOpen = signal<boolean>(false);
  readonly steps = signal<TourStep[]>([]);
  // Historical caller key, used only as an in-memory panel owner. Never persisted.
  readonly currentStorageKey = signal<StorageKey | null>(null);

  readonly currentStep = computed(() => {
    const s = this.steps();
    const idx = this.activeStepIndex();
    return s[idx] ?? null;
  });

  // Compatibility for panel callers: no automatic opening or first-visit marks.
  isFirstVisit(_key: StorageKey): boolean { return false; }
  checkAutoStart(_key: StorageKey, _steps: TourStep[], _delayMs = 700): void {
  }

  hasBlockingDialog(except?: HTMLElement): boolean {
    if (typeof document === 'undefined') return false;
    return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]'))
      .some(el => !except?.contains(el) && !el.closest('[hidden], [aria-hidden="true"]')
        && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden');
  }

  startTour(key: StorageKey, steps: TourStep[]): boolean {
    if (typeof window === 'undefined' || !steps.length || this.isOpen() || this.hasBlockingDialog()) return false;
    this.currentStorageKey.set(key);
    this.steps.set([...steps]);
    this.activeStepIndex.set(0);
    this.isOpen.set(true);
    return true;
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
    this.steps.set([]);
    this.activeStepIndex.set(0);
    this.currentStorageKey.set(null);
  }

  endTourFor(key: StorageKey): void { if (this.currentStorageKey() === key) this.endTour(); }
}
