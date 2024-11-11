import { getDocument } from '../util/dom';
import { formatPercent } from '../util/format.util';
import { clamp } from '../util/number';
import { Widget } from './widget';
import type { FocusWidgetEvent, KeyboardWidgetEvent } from './widgetEvents';

type SliderStep = typeof SliderWidget.STEP_ONE | typeof SliderWidget.STEP_HUNDRETH;
export class SliderWidget extends Widget<HTMLInputElement> {
    public static readonly STEP_ONE = { attributeValue: '1', divider: 1 } as const;
    public static readonly STEP_HUNDRETH = { attributeValue: '0.01', divider: 100 } as const;
    private _step: Readonly<SliderStep> = SliderWidget.STEP_ONE;
    private _keyboardStep?: {
        step: Readonly<SliderStep>;
        onKeyDown: (target: SliderWidget, ev: KeyboardWidgetEvent) => void;
        onKeyUp: (target: SliderWidget, ev: KeyboardWidgetEvent) => void;
        onBlur: (target: SliderWidget, ev: FocusWidgetEvent) => void;
    };

    public get step() {
        return this._step;
    }
    public set step(step: Readonly<SliderStep>) {
        this._step = step;
        this.getElement().step = step.attributeValue;
    }

    public get keyboardStep() {
        return this._keyboardStep?.step ?? this._step;
    }
    public set keyboardStep(step: Readonly<SliderStep> | undefined) {
        if (step === this._keyboardStep?.step) return;

        if (this._keyboardStep !== undefined) {
            this.removeListener('keydown', this._keyboardStep.onKeyDown);
            this.removeListener('keyup', this._keyboardStep.onKeyUp);
            this.removeListener('blur', this._keyboardStep.onBlur);
            this._keyboardStep = undefined;
        }

        if (step !== undefined) {
            const onKeyDown = () => (this.getElement().step = step.attributeValue);
            const resetStep = () => (this.getElement().step = this._step.attributeValue);
            this._keyboardStep = { step, onKeyDown, onKeyUp: resetStep, onBlur: resetStep };
            this.addListener('keydown', this._keyboardStep.onKeyDown);
            this.addListener('keyup', this._keyboardStep.onKeyUp);
            this.addListener('blur', this._keyboardStep.onBlur);
        }
    }

    constructor() {
        super(getDocument().createElement('input'));
    }

    protected override destructor() {} // NOSONAR

    clampValueRatio(clampMin: number, clampMax: number) {
        const ratio = this.getValueRatio();
        const clampedRatio = clamp(clampMin, ratio, clampMax);
        if (clampedRatio !== ratio) {
            this.setValueRatio(clampedRatio);
        }
        return clampedRatio;
    }

    setValueRatio(ratio: number, opts?: { ariaValueText?: string }) {
        const { divider } = this.step;
        const value = Math.round(ratio * 10000) / divider;
        const { ariaValueText = formatPercent(value / divider) } = opts ?? {};
        const elem = this.getElement();
        elem.value = `${value}`;
        elem.ariaValueText = ariaValueText;
    }

    getValueRatio() {
        return parseFloat(this.getElement().value) / this.step.divider;
    }
}
