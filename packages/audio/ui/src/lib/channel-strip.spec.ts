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
        {
          id: 'fx-2',
          type: 'compressor',
          label: 'Compressor',
          bypassed: false,
          mix: 1,
          parameters: {
            thresholdDb: -24,
            ratio: 4,
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

  it('should emit add effect request', () => {
    const emitSpy = vi.spyOn(component.addEffectRequested, 'emit');

    component.requestAddEffect();

    expect(emitSpy).toHaveBeenCalledWith({
      channelId: 'virtual-amp',
    });
  });

  it('should emit reordered effects on drag end after preview reorder', () => {
    const emitSpy = vi.spyOn(component.effectReordered, 'emit');

    const listElement = document.createElement('div');
    listElement.className = 'effect-rack__list';
    listElement.getBoundingClientRect = () => ({ left: 0, top: 0 }) as DOMRect;

    const buttonElement = document.createElement('button');
    buttonElement.getBoundingClientRect = () =>
      ({ left: 0, top: 0 }) as DOMRect;
    buttonElement.closest = vi.fn().mockReturnValue(listElement);
    buttonElement.setPointerCapture = vi.fn();
    buttonElement.releasePointerCapture = vi.fn();
    buttonElement.hasPointerCapture = vi.fn().mockReturnValue(true);

    component.onEffectDragStart(
      {
        pointerId: 1,
        clientX: 10,
        clientY: 10,
        currentTarget: buttonElement,
        preventDefault: vi.fn(),
      } as unknown as PointerEvent,
      'fx-1',
    );
    component.onEffectDragMove({
      pointerId: 1,
      clientX: 60,
      clientY: 10,
    } as PointerEvent);
    component.onEffectDragEnd({
      pointerId: 1,
    } as PointerEvent);

    expect(emitSpy).toHaveBeenCalledWith({
      channelId: 'virtual-amp',
      effectIds: ['fx-2', 'fx-1'],
    });
  });
});
