import type { ProxyDragHandlerEvent } from '../../dom/proxyInteractionService';
import type { ModuleContext } from '../../module/moduleContext';
import { setAttribute } from '../../util/attributeUtil';
import type { BBoxValues } from '../../util/bboxinterface';
import { formatPercent } from '../../util/format.util';
import { initToolbarKeyNav } from '../../util/keynavUtil';
import { clamp } from '../../util/number';
import type { SliderWidget } from '../../widget/sliderWidget';
import type { ToolbarWidget } from '../../widget/toolbarWidget';

export type NavigatorButtonType = 'min' | 'max' | 'pan';

type SliderDragHandlers = {
    onDragStart(type: NavigatorButtonType, event: { offsetX: number }): void;
    onDrag(type: NavigatorButtonType, event: { offsetX: number }): void;
};

export class NavigatorDOMProxy {
    public _min = 0;
    public _max = 1;

    public readonly minRange = 0.001;

    private dragStartX = 0;

    private readonly toolbar: ToolbarWidget;
    private readonly sliders: [SliderWidget, SliderWidget, SliderWidget];

    private destroyDragListeners?: () => void;

    constructor(
        private readonly ctx: Pick<ModuleContext, 'zoomManager' | 'proxyInteractionService' | 'localeManager'>,
        private readonly sliderHandlers: SliderDragHandlers
    ) {
        this.ctx = ctx;
        this.toolbar = ctx.proxyInteractionService.createProxyContainer({
            type: 'toolbar',
            domManagerId: `navigator-toolbar`,
            classList: ['ag-charts-proxy-navigator-toolbar'],
            ariaOrientation: 'vertical',
            ariaLabel: { id: 'ariaLabelNavigator' },
        });

        this.sliders = [
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                ariaLabel: { id: 'ariaLabelNavigatorMinimum' },
                ariaOrientation: 'horizontal',
                parent: this.toolbar,
                cursor: 'ew-resize',
                onchange: (ev) => this.onMinSliderChange(ev),
            }),
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                ariaLabel: { id: 'ariaLabelNavigatorRange' },
                ariaOrientation: 'horizontal',
                parent: this.toolbar,
                cursor: 'grab',
                onchange: (ev) => this.onPanSliderChange(ev),
            }),
            ctx.proxyInteractionService.createProxyElement({
                type: 'slider',
                ariaLabel: { id: 'ariaLabelNavigatorMaximum' },
                ariaOrientation: 'horizontal',
                parent: this.toolbar,
                cursor: 'ew-resize',
                onchange: (ev) => this.onMaxSliderChange(ev),
            }),
        ];
        this.setSliderRatio(this.sliders[0], this._min);
        this.setSliderRatio(this.sliders[2], this._max);
        this.setPanSliderValue(this._min, this._max);
        initToolbarKeyNav({
            orientation: 'vertical',
            toolbar: this.toolbar.getElement(),
            buttons: this.sliders.map((widget) => widget.getElement()),
        });
        this.updateVisibility(false);
    }

    destroy() {
        this.toolbar.destroy();
    }

    private initDragListeners() {
        if (this.destroyDragListeners != null) return;

        for (const [index, key] of (['min', 'pan', 'max'] as const).entries()) {
            const slider = this.sliders[index];
            slider.getElement().step = '0.01';
            setAttribute(slider.getElement(), 'data-preventdefault', false);
            this.destroyDragListeners = this.ctx.proxyInteractionService.createDragListeners({
                element: slider.getElement(),
                onDragStart: (ev) => this.onDragStart(ev, key, slider),
                onDrag: (ev) => this.onDrag(ev, key),
                onDragEnd: () => this.updateSliderRatios(),
            });
        }
    }

    updateVisibility(visible: boolean): void {
        this.toolbar.setHidden(!visible);
        if (visible) {
            this.initDragListeners();
        } else {
            this.destroyDragListeners?.();
            this.destroyDragListeners = undefined;
        }
    }

    updateZoom(): void {
        const { _min: min, _max: max } = this;
        if (min == null || max == null) return;

        return this.ctx.zoomManager.updateZoom('navigator', { x: { min, max } });
    }

    updateBounds(bounds: BBoxValues): void {
        this.toolbar.setBounds(bounds);
    }

    updateSliderBounds(sliderIndex: number, bounds: BBoxValues): void {
        this.sliders[sliderIndex].setBounds(bounds);
    }

    updateMinMax(min: number, max: number) {
        this._min = min;
        this._max = max;
        this.updateSliderRatios();
    }

    private updateSliderRatios() {
        this.setPanSliderValue(this._min, this._max);
        this.setSliderRatio(this.sliders[0], this._min);
        this.setSliderRatio(this.sliders[2], this._max);
    }

    private toCanvasOffsets(event: ProxyDragHandlerEvent): { offsetX: number } {
        return { offsetX: this.dragStartX + event.originDeltaX };
    }

    private onDragStart(event: ProxyDragHandlerEvent, key: NavigatorButtonType, slider: SliderWidget) {
        const toolbarLeft = this.toolbar.cssLeft();
        const sliderLeft = slider.cssLeft();
        this.dragStartX = toolbarLeft + sliderLeft + event.offsetX;
        this.sliderHandlers.onDragStart(key, this.toCanvasOffsets(event));
    }

    private onDrag(event: ProxyDragHandlerEvent, key: NavigatorButtonType) {
        this.sliderHandlers.onDrag(key, this.toCanvasOffsets(event));
    }

    private onPanSliderChange(_event: Event) {
        const ratio = this.getSliderRatio(this.sliders[1]);
        const span = this._max - this._min;
        this._min = clamp(0, ratio, 1 - span);
        this._max = this._min + span;
        this.updateZoom();
    }

    private onMinSliderChange(_event: Event) {
        const slider = this.sliders[0];
        this._min = this.setSliderRatioClamped(slider, 0, this._max - this.minRange);
        this.updateZoom();
    }

    private onMaxSliderChange(_event: Event) {
        const slider = this.sliders[2];
        this._max = this.setSliderRatioClamped(slider, this._min + this.minRange, 1);
        this.updateZoom();
    }

    private setPanSliderValue(min: number, max: number) {
        const value = Math.round(min * 10000) / 100;
        const slider = this.sliders[1].getElement();
        slider.value = `${value}`;
        slider.ariaValueText = this.ctx.localeManager.t('ariaValuePanRange', { min, max });
    }

    private setSliderRatioClamped(slider: SliderWidget, clampMin: number, clampMax: number) {
        const ratio = this.getSliderRatio(slider);
        const clampedRatio = clamp(clampMin, ratio, clampMax);
        if (clampedRatio !== ratio) {
            this.setSliderRatio(slider, clampedRatio);
        }
        return clampedRatio;
    }

    private setSliderRatio(widget: SliderWidget, ratio: number) {
        const slider = widget.getElement();
        const value = Math.round(ratio * 10000) / 100;
        slider.value = `${value}`;
        slider.ariaValueText = formatPercent(value / 100);
    }

    private getSliderRatio(widget: SliderWidget) {
        return parseFloat(widget.getElement().value) / 100;
    }

    testFindTarget(
        type: NavigatorButtonType,
        canvasX: number,
        canvasY: number
    ): { target: HTMLElement; x: number; y: number } {
        const targetWidth = this.sliders[{ min: 0, pan: 1, max: 2 }[type]];
        const x = canvasX - targetWidth.cssLeft() - this.toolbar.cssLeft();
        const y = canvasY - targetWidth.cssTop() - this.toolbar.cssTop();
        const target = targetWidth.getElement();
        return { target, x, y };
    }
}
