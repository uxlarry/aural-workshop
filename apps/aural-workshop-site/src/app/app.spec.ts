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

  it('should render the hero image', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const image = compiled.querySelector('.hero-image') as HTMLImageElement;
    expect(image).toBeTruthy();
    expect(image.getAttribute('src')).toBe('/assets/hero-image.png');
  });

  it('should render only one image on the page', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const images = compiled.querySelectorAll('img');
    expect(images.length).toBe(1);
  });

  it('should include descriptive image alt text', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const image = compiled.querySelector('.hero-image') as HTMLImageElement;
    expect(image.getAttribute('alt')).toContain('Aural Workshop hero image');
  });

  it('should apply change detection strategy OnPush', () => {
    const metadata = (App as unknown as { ɵcmp: { onPush: boolean } })['ɵcmp'];
    expect(metadata.onPush).toBeTruthy();
  });
});
