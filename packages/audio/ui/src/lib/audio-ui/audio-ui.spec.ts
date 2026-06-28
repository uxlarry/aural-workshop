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
    fixture.componentRef.setInput('channels', [
      {
        id: 'input',
        type: 'input',
        label: 'Input',
        gainDb: 0,
        pan: 0,
        muted: false,
        solo: false,
      },
    ]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
