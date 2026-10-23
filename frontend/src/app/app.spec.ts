import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './services/auth.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    sessionStorage.setItem('saip_splash_shown', 'true');
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    localStorage.clear();
  });

  it('the shared logout handler sends the captured session, navigates once, and ignores a late result', async () => {
    const auth = TestBed.inject(AuthService);
    auth.guardarSesion({ success: true, token: 'closing-session' });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const app = TestBed.createComponent(App).componentInstance;
    app.menuAbierto.set(true);
    app.mobileMenuAbierto.set(true);
    app.logout();
    expect(auth.getToken()).toBeNull();
    expect(app.menuAbierto()).toBe(false);
    expect(app.mobileMenuAbierto()).toBe(false);
    expect(navigate).toHaveBeenCalledExactlyOnceWith(['/']);
    const req = TestBed.inject(HttpTestingController).expectOne('http://localhost:8080/api/auth/logout');
    expect(req.request.headers.get('Authorization')).toBe('Bearer closing-session');
    auth.guardarSesion({ success: true, token: 'new-session' });
    req.flush(null, { status: 204, statusText: 'No Content' });
    await Promise.resolve();
    expect(auth.getToken()).toBe('new-session');
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render header', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('header')).toBeTruthy();
  });
});
