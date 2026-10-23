import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { NotificationBellComponent } from './notification-bell.component';

describe('NotificationBellComponent', () => {
  let component: NotificationBellComponent;
  let fixture: ComponentFixture<NotificationBellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationBellComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationBellComponent);
    component = fixture.componentInstance;
  });

  it('should initialize and display 4 operational notifications for ADMINISTRADOR role', () => {
    fixture.componentRef.setInput('userType', 'ADMINISTRADOR');
    fixture.detectChanges();

    const items = component.items();
    expect(items.length).toBeGreaterThanOrEqual(4);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('adm-venc');
    expect(ids).toContain('adm-pend');
    expect(ids).toContain('adm-apel');
    expect(ids).toContain('adm-res');
  });

  it('should handle toggleOpen and mark all read', () => {
    fixture.componentRef.setInput('userType', 'ADMIN');
    fixture.detectChanges();

    expect(component.abierto()).toBe(false);
    component.toggleOpen();
    expect(component.abierto()).toBe(true);

    component.marcarTodasComoLeidas();
    expect(component.noLeidasCount()).toBe(0);
  });
});
