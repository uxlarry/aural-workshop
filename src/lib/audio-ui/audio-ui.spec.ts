import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AudioUi } from './audio-ui';

describe('AudioUi', () => {
  let component: AudioUi;
  let fixture: ComponentFixture<AudioUi>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AudioUi],
    }).compileComponents();

    fixture = TestBed.createComponent(AudioUi);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
