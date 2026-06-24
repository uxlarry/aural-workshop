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

  it('should emit gain changes', () => {
    const emitSpy = vi.spyOn(component.parameterChange, 'emit');

    component.onGainChange('input', 4.5);

    expect(emitSpy).toHaveBeenCalledWith({
      channelId: 'input',
      parameter: 'gainDb',
      value: 4.5,
    });
  });

  it('should emit pan, muted, and solo changes', () => {
    const emitSpy = vi.spyOn(component.parameterChange, 'emit');

    component.onPanChange('input', -0.25);
    component.onMutedChange('input', true);
    component.onSoloChange('input', true);

    expect(emitSpy).toHaveBeenNthCalledWith(1, {
      channelId: 'input',
      parameter: 'pan',
      value: -0.25,
    });
    expect(emitSpy).toHaveBeenNthCalledWith(2, {
      channelId: 'input',
      parameter: 'muted',
      value: true,
    });
    expect(emitSpy).toHaveBeenNthCalledWith(3, {
      channelId: 'input',
      parameter: 'solo',
      value: true,
    });
  });
});
