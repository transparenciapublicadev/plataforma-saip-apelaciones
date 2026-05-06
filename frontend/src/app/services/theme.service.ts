import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly storageKey = 'saip-theme-mode';

  private readonly currentTheme = signal<ThemeMode>('light');
  readonly theme = this.currentTheme.asReadonly();

  constructor() {
    this.initializeTheme();
  }

  toggleTheme(): void {
    this.applyTheme(this.currentTheme() === 'dark' ? 'light' : 'dark');
  }

  private initializeTheme(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const savedTheme = localStorage.getItem(this.storageKey);
    if (savedTheme === 'dark' || savedTheme === 'light') {
      this.applyTheme(savedTheme);
      return;
    }

    const prefersDark = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.applyTheme(prefersDark ? 'dark' : 'light');
  }

  private applyTheme(theme: ThemeMode): void {
    this.currentTheme.set(theme);

    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem(this.storageKey, theme);
  }
}
