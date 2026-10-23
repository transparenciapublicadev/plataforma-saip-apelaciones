import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { PaginationComponent } from './pagination.component';

describe('PaginationComponent', () => {
  let component: PaginationComponent;
  let fixture: ComponentFixture<PaginationComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginationComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(PaginationComponent);
    component = fixture.componentInstance;
  });

  it('should not render anything when total is 0', () => {
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.componentRef.setInput('total', 0);
    fixture.componentRef.setInput('rangeFrom', 0);
    fixture.componentRef.setInput('rangeTo', 0);
    fixture.detectChanges();

    const el = fixture.nativeElement.querySelector('div');
    expect(el).toBeNull();
  });

  it('should render counter and page items when total > 0 even with 1 page', () => {
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 1);
    fixture.componentRef.setInput('total', 5);
    fixture.componentRef.setInput('rangeFrom', 1);
    fixture.componentRef.setInput('rangeTo', 5);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Mostrando 1–5 de 5');
    expect(text).toContain('Página 1 de 1');
  });

  it('should generate gaps for large page counts', () => {
    fixture.componentRef.setInput('page', 5);
    fixture.componentRef.setInput('totalPages', 10);
    fixture.componentRef.setInput('total', 100);
    fixture.componentRef.setInput('rangeFrom', 41);
    fixture.componentRef.setInput('rangeTo', 50);
    fixture.detectChanges();

    const items = component.pageItems();
    expect(items).toContain('gap');
    expect(items[0]).toBe(1);
    expect(items[items.length - 1]).toBe(10);
  });

  it('should emit goTo when clicking an active page button', () => {
    let emittedPage = 0;
    component.goTo.subscribe((p) => (emittedPage = p));

    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('totalPages', 3);
    fixture.componentRef.setInput('total', 25);
    fixture.componentRef.setInput('rangeFrom', 1);
    fixture.componentRef.setInput('rangeTo', 10);
    fixture.detectChanges();

    component.onGoTo(2);
    expect(emittedPage).toBe(2);
  });
});
