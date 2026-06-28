import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioAppShell } from './audio-app-shell';

describe('AudioAppShell', () => {
  let component: AudioAppShell;
  let fixture: ComponentFixture<AudioAppShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioAppShell],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioAppShell);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
