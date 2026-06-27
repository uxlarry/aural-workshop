import { TestBed, ComponentFixture } from '@angular/core/testing';
import { App } from './app';
import { appRoutes } from './app.routes';
import { provideRouter } from '@angular/router';

describe('App', () => {
  let component: App;
  let fixture: ComponentFixture<App>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(appRoutes)],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create the app component', () => {
    expect(component).toBeTruthy();
  });

  it('should render brand title', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain(
      'Aural Workshop',
    );
  });

  it('should render coming soon hero message', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero h1')?.textContent).toContain(
      'Our New Experience Is Almost Here',
    );
  });

  it('should render launch information cards', () => {
    const cards = fixture.nativeElement.querySelectorAll('mat-card');
    expect(cards.length).toBe(2);
    expect(cards[0]?.textContent).toContain('Launch Status');
    expect(cards[1]?.textContent).toContain('Hero Image');
  });

  it('should render footer copy', () => {
    const footer = fixture.nativeElement.querySelector('.site-footer');
    expect(footer).toBeTruthy();
    expect(footer?.textContent).toContain('Aural Workshop');
  });

  it('should apply change detection strategy OnPush', () => {
    const metadata = (App as unknown as { ɵcmp: { onPush: boolean } })['ɵcmp'];
    expect(metadata.onPush).toBeTruthy();
  });
});
