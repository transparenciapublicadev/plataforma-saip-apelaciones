import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import {
  provideLucideIcons,
  LucideSun, LucideMoon, LucideChevronDown, LucideUser, LucideFileText,
  LucideScale, LucideLogOut, LucideSearch, LucideHelpCircle, LucideLayoutDashboard,
  LucideBuilding2, LucideUsers, LucideSettings, LucideBell, LucideShieldAlert,
  LucideUpload, LucideDownload, LucideSend, LucideSave, LucideEye,
  LucideTrash2, LucideX, LucideCheckCircle2, LucideAlertCircle, LucideAlertTriangle,
  LucideXCircle, LucideClock, LucideFileCheck2, LucideArrowLeft, LucideArrowRight,
  LucidePlus, LucideCheck, LucideInfo, LucideCompass, LucideTrendingUp,
  LucideFlame, LucideCalendar, LucideInbox, LucideLayers, LucideTarget,
  LucideGavel, LucideSparkles, LucideHourglass, LucideActivity, LucideChevronRight,
  LucideShieldCheck, LucideBadgeCheck
} from '@lucide/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    provideLucideIcons(
      LucideSun, LucideMoon, LucideChevronDown, LucideUser, LucideFileText,
      LucideScale, LucideLogOut, LucideSearch, LucideHelpCircle, LucideLayoutDashboard,
      LucideBuilding2, LucideUsers, LucideSettings, LucideBell, LucideShieldAlert,
      LucideUpload, LucideDownload, LucideSend, LucideSave, LucideEye,
      LucideTrash2, LucideX, LucideCheckCircle2, LucideAlertCircle, LucideAlertTriangle,
      LucideXCircle, LucideClock, LucideFileCheck2, LucideArrowLeft, LucideArrowRight,
      LucidePlus, LucideCheck, LucideInfo, LucideCompass, LucideTrendingUp,
      LucideFlame, LucideCalendar, LucideInbox, LucideLayers, LucideTarget,
      LucideGavel, LucideSparkles, LucideHourglass, LucideActivity, LucideChevronRight,
      LucideShieldCheck, LucideBadgeCheck
    )
  ]
};
