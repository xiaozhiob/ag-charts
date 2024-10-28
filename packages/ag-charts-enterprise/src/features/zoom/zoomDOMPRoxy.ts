import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

type Handler<A> = (direction: A) => void;

type AxesHandlers = {
    onEnter: Handler<_ModuleSupport.ChartAxisDirection>;
    onLeave: Handler<_ModuleSupport.ChartAxisDirection>;
    onDragStart: Handler<Pick<_ModuleSupport.RegionEvent, 'offsetX' | 'offsetY' | 'sourceEvent' | 'button'>>;
    onDrag: Handler<_ModuleSupport.PointerOffsets>;
    onDragEnd: Handler<undefined>;
};

export class ZoomDOMProxy {
    private readonly hAxis: HTMLDivElement;
    private readonly vAxis: HTMLDivElement;
    private readonly destroyFns = new _Util.DestroyFns();

    private initAxis(
        ctx: Pick<_ModuleSupport.ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        domManagerId: string,
        handlers: AxesHandlers,
        direction: _ModuleSupport.ChartAxisDirection,
        cursor: 'ew-resize' | 'ns-resize'
    ) {
        const parent = 'afterend';
        const axis = ctx.proxyInteractionService.createProxyElement({ type: 'region', domManagerId, parent });
        _Util.setElementStyle(axis, 'cursor', cursor);

        let dragging = false;
        const mouseenter = () => handlers.onEnter(direction);
        const mouseleave = () => handlers.onLeave(direction);
        const mousedown = (sourceEvent: MouseEvent) => {
            const { button, offsetX, offsetY } = sourceEvent;
            if (button === 0) {
                dragging = true;
                handlers.onDragStart({ button, offsetX, offsetY, sourceEvent });
            }
        };
        const mousemove = (sourceEvent: MouseEvent) => {
            if (dragging && sourceEvent.button === 0) {
                handlers.onDrag(sourceEvent);
            }
        };
        const mouseup = (sourceEvent: MouseEvent) => {
            if (sourceEvent.button === 0) {
                dragging = false;
                handlers.onDragEnd(undefined);
            }
        };

        axis.addEventListener('mouseenter', mouseenter);
        axis.addEventListener('mouseleave', mouseleave);
        axis.addEventListener('mousedown', mousedown);
        axis.addEventListener('mousemove', mousemove);
        axis.addEventListener('mouseup', mouseup);
        this.destroyFns.push(() => {
            axis.removeEventListener('mouseenter', mouseenter);
            axis.removeEventListener('mouseleave', mouseleave);
            axis.removeEventListener('mousedown', mousedown);
            axis.removeEventListener('mousemove', mousemove);
            axis.removeEventListener('mouseup', mouseup);
        });

        return axis;
    }
    constructor(
        ctx: Pick<_ModuleSupport.ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        axesHandlers: AxesHandlers
    ) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        this.hAxis = this.initAxis(ctx, 'hori-axis-zoom', axesHandlers, X, 'ew-resize');
        this.vAxis = this.initAxis(ctx, 'vert-axis-zoom', axesHandlers, Y, 'ns-resize');
    }

    destroy() {
        this.destroyFns.destroy();
    }

    update(ctx: Pick<_ModuleSupport.ModuleContext, 'axisManager'>) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        for (const [axis, dir] of [
            [this.hAxis, X],
            [this.vAxis, Y],
        ] as const) {
            const axisCtx = ctx.axisManager.getAxisContext(dir);
            const bboxes = axisCtx.map((ac) => ac.getCanvasBounds()).filter((bb): bb is _Util.BBoxValues => bb != null);
            const union = _Scene.BBox.merge(bboxes);
            _ModuleSupport.setElementBBox(axis, union);
        }
    }
}
