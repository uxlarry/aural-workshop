import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChannelStrip } from './channel-strip';

describe('ChannelStrip', () => {
  let component: ChannelStrip;
  let fixture: ComponentFixture<ChannelStrip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChannelStrip],
    }).compileComponents();

    fixture = TestBed.createComponent(ChannelStrip);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('channel', {
      id: 'virtual-amp',
      type: 'internal',
      label: 'Virtual Amp',
      gainDb: 0,
      pan: 0,
      muted: false,
      solo: false,
      effects: [
        {
          id: 'fx-1',
          type: 'highpass',
          label: 'High-Pass',
          bypassed: false,
          mix: 1,
          parameters: {
            frequencyHz: 120,
            q: 0.707,
          },
        },
      ],
    });
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should emit gain parameter change', () => {
    const emitSpy = vi.spyOn(component.parameterChange, 'emit');

    component.onGainChange(3);

    expect(emitSpy).toHaveBeenCalledWith({
      channelId: 'virtual-amp',
      parameter: 'gainDb',
      value: 3,
    });
  });

  it('should emit effect selection for settings', () => {
    const emitSpy = vi.spyOn(component.effectSelected, 'emit');

    component.selectEffect('fx-1');

    expect(emitSpy).toHaveBeenCalledWith({
      channelId: 'virtual-amp',
      effectId: 'fx-1',
    });
  });
});
