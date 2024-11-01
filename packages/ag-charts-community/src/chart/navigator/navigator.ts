import type { LayoutContext, ModuleInstance } from '../../module/baseModule';
import { BaseModuleInstance } from '../../module/module';
import type { ModuleContext } from '../../module/moduleContext';
import type { BBox } from '../../scene/bbox';
import type { Group } from '../../scene/group';
import type { BBoxProvider } from '../../util/bboxinterface';
import { clamp } from '../../util/number';
import { ObserveChanges } from '../../util/proxy';
import { BOOLEAN, OBJECT, POSITIVE_NUMBER, Validate } from '../../util/validation';
import { InteractionState, type PointerInteractionEvent } from '../interaction/interactionManager';
import type { RegionEvent } from '../interaction/regionManager';
import type { ZoomChangeEvent } from '../interaction/zoomManager';
import { type LayoutCompleteEvent, LayoutElement } from '../layout/layoutManager';
import { NavigatorDOMProxy } from './navigatorDOMProxy';
import { RangeHandle } from './shapes/rangeHandle';
import { RangeMask } from './shapes/rangeMask';
import { RangeSelector } from './shapes/rangeSelector';

type NavigatorButtonType = 'min' | 'max' | 'pan';

export class Navigator extends BaseModuleInstance implements ModuleInstance {
    @Validate(OBJECT, { optional: true })
    public miniChart: unknown = undefined;

    @Validate(BOOLEAN)
    @ObserveChanges<Navigator>((target, value) => {
        target.ctx.zoomManager.setNavigatorEnabled(Boolean(value));
        target.updateGroupVisibility();
    })
    public enabled: boolean = false;

    public mask = new RangeMask();
    public minHandle = new RangeHandle();
    public maxHandle = new RangeHandle();
    private readonly maskVisibleRange = {
        id: 'navigator-mask-visible-range',
        getBBox: (): BBox => this.mask.computeVisibleRangeBBox(),
        toCanvasBBox: (): BBox => this.mask.computeVisibleRangeBBox(),
        fromCanvasPoint: (x: number, y: number) => ({ x, y }),
    } satisfies BBoxProvider & { getBBox(): BBox };

    @Validate(POSITIVE_NUMBER)
    public height: number = 30;

    @Validate(POSITIVE_NUMBER)
    public spacing: number = 10;

    protected x = 0;
    protected y = 0;
    protected width = 0;

    private readonly rangeSelector = new RangeSelector([this.mask, this.minHandle, this.maxHandle]);

    private dragging?: NavigatorButtonType;
    private panStart?: number;
    private readonly domProxy: NavigatorDOMProxy;

    constructor(private readonly ctx: ModuleContext) {
        super();

        const region = ctx.regionManager.addRegion('navigator', this.rangeSelector);
        const dragStates = InteractionState.Default | InteractionState.Animation | InteractionState.ZoomDrag;
        this.destroyFns.push(
            ctx.scene.attachNode(this.rangeSelector),
            region.addListener('hover', (event) => this.onHover(event), dragStates),
            region.addListener('drag-start', (event) => this.onDragStart(event), dragStates),
            region.addListener('drag', (event) => this.onDrag(event), dragStates),
            region.addListener('drag-end', (event) => this.onDragEnd(event), dragStates),
            region.addListener('leave', (event) => this.onLeave(event), dragStates),
            () => ctx.regionManager.removeRegion('navigator'),
            this.ctx.localeManager.addListener('locale-changed', () => this.updateZoom()),
            this.ctx.layoutManager.registerElement(LayoutElement.Navigator, (e) => this.onLayoutStart(e)),
            this.ctx.layoutManager.addListener('layout:complete', (e) => this.onLayoutComplete(e)),
            ctx.zoomManager.addListener('zoom-change', (event) => this.onZoomChange(event))
        );

        this.domProxy = new NavigatorDOMProxy(ctx);
        this.updateGroupVisibility();
    }

    public updateBackground(oldGroup?: Group, newGroup?: Group) {
        this.rangeSelector?.updateBackground(oldGroup, newGroup);
    }

    private updateGroupVisibility() {
        const { enabled } = this;

        if (this.rangeSelector == null || enabled === this.rangeSelector.visible) return;
        this.rangeSelector.visible = enabled;
        this.domProxy.updateVisibility(enabled);

        if (enabled) {
            this.updateZoom();
        } else {
            this.ctx.zoomManager.updateZoom('navigator');
        }
    }

    protected onLayoutStart(ctx: LayoutContext) {
        if (this.enabled) {
            const { layoutBox } = ctx;
            const navigatorTotalHeight = this.height + this.spacing;
            layoutBox.shrink(navigatorTotalHeight, 'bottom');
            this.y = layoutBox.y + layoutBox.height + this.spacing;
        } else {
            this.y = 0;
        }
    }

    onLayoutComplete(opts: LayoutCompleteEvent) {
        const { x, width } = opts.series.rect;
        const { y, height } = this;

        this.domProxy.updateVisibility(this.enabled);
        if (this.enabled) {
            this.layoutNodes(x, y, width, height);
            this.domProxy.updateBounds({ x, y, width, height });
        }

        this.x = x;
        this.width = width;
    }

    private onHover(event: RegionEvent<'hover'>) {
        if (!this.enabled) return;
        this.updateCursor(event);
    }

    private updateCursor(event: RegionEvent) {
        if (!this.enabled) return;

        const { mask, minHandle, maxHandle } = this;
        const { regionOffsetX, regionOffsetY } = event;

        if (
            minHandle.containsPoint(regionOffsetX, regionOffsetY) ||
            maxHandle.containsPoint(regionOffsetX, regionOffsetY)
        ) {
            this.ctx.cursorManager.updateCursor('navigator', 'ew-resize');
        } else if (mask.computeVisibleRangeBBox().containsPoint(regionOffsetX, regionOffsetY)) {
            this.ctx.cursorManager.updateCursor('navigator', 'grab');
        } else {
            this.ctx.cursorManager.updateCursor('navigator');
        }
    }

    private onDragStart(event: RegionEvent<'drag-start'>) {
        if (!this.enabled) return;
        this.updateCursor(event);

        const { mask, minHandle, maxHandle, x, width } = this;
        const { _min: min } = this.domProxy;
        const { regionOffsetX, regionOffsetY } = event;

        if (minHandle.zIndex < maxHandle.zIndex) {
            if (maxHandle.containsPoint(regionOffsetX, regionOffsetY)) {
                this.dragging = 'max';
            } else if (minHandle.containsPoint(regionOffsetX, regionOffsetY)) {
                this.dragging = 'min';
            }
        } else if (minHandle.containsPoint(regionOffsetX, regionOffsetY)) {
            this.dragging = 'min';
        } else if (maxHandle.containsPoint(regionOffsetX, regionOffsetY)) {
            this.dragging = 'max';
        }

        if (this.dragging == null && mask.computeVisibleRangeBBox().containsPoint(regionOffsetX, regionOffsetY)) {
            this.dragging = 'pan';
            this.panStart = (regionOffsetX - x) / width - min;
        }

        if (this.dragging != null) {
            this.ctx.zoomManager.fireZoomPanStartEvent('navigator');
        }
    }

    private onDrag(event: RegionEvent<'drag'>) {
        if (!this.enabled || this.dragging == null) return;

        const { dragging, panStart, x, width } = this;
        const { minRange } = this.domProxy;
        let { _min: min, _max: max } = this.domProxy;
        const { regionOffsetX } = event;

        const ratio = (regionOffsetX - x) / width;

        if (dragging === 'min') {
            min = clamp(0, ratio, max - minRange);
        } else if (dragging === 'max') {
            max = clamp(min + minRange, ratio, 1);
        } else if (dragging === 'pan' && panStart != null) {
            const span = max - min;
            min = clamp(0, ratio - panStart, 1 - span);
            max = min + span;
        }

        this.domProxy._min = min;
        this.domProxy._max = max;

        this.updateZoom();
    }

    private onDragEnd(event: RegionEvent<'drag-end'>) {
        this.dragging = undefined;
        this.updateCursor(event);
    }

    private onLeave(_event: PointerInteractionEvent<'leave'>) {
        this.ctx.cursorManager.updateCursor('navigator');
    }

    private onZoomChange(event: ZoomChangeEvent) {
        const { x } = event;
        if (!x) return;

        this.domProxy.updateMinMax(x.min, x.max);
        this.updateNodes(x.min, x.max);
    }

    private layoutNodes(x: number, y: number, width: number, height: number) {
        const { rangeSelector, mask, minHandle, maxHandle } = this;
        const { _min: min, _max: max } = this.domProxy;

        rangeSelector.layout(x, y, width, height, minHandle.width / 2, maxHandle.width / 2);
        mask.layout(x, y, width, height);

        RangeHandle.align(minHandle, maxHandle, x, y, width, height, min, max);

        if (min + (max - min) / 2 < 0.5) {
            minHandle.zIndex = 3;
            maxHandle.zIndex = 4;
        } else {
            minHandle.zIndex = 4;
            maxHandle.zIndex = 3;
        }

        [minHandle, this.maskVisibleRange, maxHandle].forEach((node, index) => {
            const bbox = node.getBBox();
            const tbox = { x: bbox.x - x, y: bbox.y - y, height: bbox.height, width: bbox.width };
            this.domProxy.updateSliderBounds(index, tbox);
        });
    }

    private updateNodes(min: number, max: number) {
        this.mask.update(min, max);
    }

    private updateZoom() {
        if (!this.enabled) return;
        this.domProxy.updateZoom();
    }
}
