import type { ModuleContext } from '../../module/moduleContext';
import { setAttribute } from '../../util/attributeUtil';
import { DestroyFns } from '../../util/destroy';
import { formatPercent } from '../../util/format.util';
import { initToolbarKeyNav } from '../../util/keynavUtil';
import { clamp } from '../../util/number';

export class NavigatorDOMProxy {
    public _min = 0;
    public _max = 1;

    public readonly minRange = 0.001;

    public readonly proxyNavigatorToolbar: HTMLElement;
    public readonly proxyNavigatorElements: [HTMLInputElement, HTMLInputElement, HTMLInputElement];

    private readonly destroyFns = new DestroyFns();
    private readonly ctx: Pick<ModuleContext, 'zoomManager' | 'localeManager'>;

    constructor(ctx: Pick<ModuleContext, 'zoomManager' | 'proxyInteractionService' | 'localeManager'>) {
        this.ctx = ctx;
        this.proxyNavigatorToolbar = ctx.proxyInteractionService.createProxyContainer({
            type: 'toolbar',
            id: `navigator-toolbar`,
            classList: ['ag-charts-proxy-navigator-toolbar'],
            ariaOrientation: 'vertical',
            ariaLabel: { id: 'ariaLabelNavigator' },
        });

        this.proxyNavigatorElements = [
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                id: 'ag-charts-navigator-min',
                ariaLabel: { id: 'ariaLabelNavigatorMinimum' },
                ariaOrientation: 'horizontal',
                parent: this.proxyNavigatorToolbar,
                onchange: (ev) => this.onMinSliderChange(ev),
            }),
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                id: 'ag-charts-navigator-pan',
                ariaLabel: { id: 'ariaLabelNavigatorRange' },
                ariaOrientation: 'horizontal',
                parent: this.proxyNavigatorToolbar,
                onchange: (ev) => this.onPanSliderChange(ev),
            }),
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                id: 'ag-charts-navigator-max',
                ariaLabel: { id: 'ariaLabelNavigatorMaximum' },
                ariaOrientation: 'horizontal',
                parent: this.proxyNavigatorToolbar,
                onchange: (ev) => this.onMaxSliderChange(ev),
            }),
        ];
        this.proxyNavigatorElements.forEach((slider) => setAttribute(slider, 'data-preventdefault', false));
        this.setSliderRatio(this.proxyNavigatorElements[0], this._min);
        this.setSliderRatio(this.proxyNavigatorElements[2], this._max);
        this.setPanSliderValue(this._min, this._max);
        initToolbarKeyNav({
            orientation: 'vertical',
            toolbar: this.proxyNavigatorToolbar,
            buttons: this.proxyNavigatorElements,
        });
        this.destroyFns.push(() => {
            this.proxyNavigatorElements.forEach((e) => e.remove());
            this.proxyNavigatorToolbar.remove();
        });
    }

    destroy() {
        this.destroyFns.destroy();
    }

    updateZoom(): void {
        const { _min: min, _max: max } = this;
        if (min == null || max == null) return;

        return this.ctx.zoomManager.updateZoom('navigator', { x: { min, max } });
    }

    private onPanSliderChange(_event: Event) {
        const ratio = this.getSliderRatio(this.proxyNavigatorElements[1]);
        const span = this._max - this._min;
        this._min = clamp(0, ratio, 1 - span);
        this._max = this._min + span;
        this.updateZoom();
    }

    private onMinSliderChange(_event: Event) {
        const slider = this.proxyNavigatorElements[0];
        this._min = this.setSliderRatioClamped(slider, 0, this._max - this.minRange);
        this.updateZoom();
    }

    private onMaxSliderChange(_event: Event) {
        const slider = this.proxyNavigatorElements[2];
        this._max = this.setSliderRatioClamped(slider, this._min + this.minRange, 1);
        this.updateZoom();
    }

    setPanSliderValue(min: number, max: number) {
        this.proxyNavigatorElements[1].value = `${Math.round(min * 100)}`;
        this.proxyNavigatorElements[1].ariaValueText = this.ctx.localeManager.t('ariaValuePanRange', { min, max });
    }

    private setSliderRatioClamped(slider: HTMLInputElement, clampMin: number, clampMax: number) {
        const ratio = this.getSliderRatio(slider);
        const clampedRatio = clamp(clampMin, ratio, clampMax);
        if (clampedRatio !== ratio) {
            this.setSliderRatio(slider, clampedRatio);
        }
        return clampedRatio;
    }

    setSliderRatio(slider: HTMLInputElement, ratio: number) {
        const value = Math.round(ratio * 100);
        slider.value = `${value}`;
        slider.ariaValueText = formatPercent(value / 100);
    }

    private getSliderRatio(slider: HTMLInputElement) {
        return parseFloat(slider.value) / 100;
    }
}
