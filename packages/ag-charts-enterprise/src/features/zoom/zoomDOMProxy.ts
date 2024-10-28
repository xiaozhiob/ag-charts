import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

type AxesHandlers = {
    onDragStart: (direction: _ModuleSupport.ChartAxisDirection) => void;
    onDrag: (event: _ModuleSupport.PointerOffsets) => void;
    onDragEnd: () => void;
};

export class ZoomDOMProxy {
    private readonly hAxis: HTMLDivElement;
    private readonly vAxis: HTMLDivElement;
    private readonly destroyFns = new _Util.DestroyFns();

    private draggedAxis?: _ModuleSupport.ChartAxisDirection;

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

        const mousedown = (sourceEvent: MouseEvent) => {
            if (sourceEvent.button === 0) {
                this.draggedAxis = direction;
                handlers.onDragStart(direction);
            }
        };
        const mousemove = (sourceEvent: MouseEvent) => {
            if (this.draggedAxis !== undefined) {
                handlers.onDrag(sourceEvent);
            }
        };
        const mouseup = (sourceEvent: MouseEvent) => {
            if (this.draggedAxis !== undefined && sourceEvent.button === 0) {
                this.draggedAxis = undefined;
                handlers.onDragEnd();
            }
        };

        const window = _ModuleSupport.getWindow();
        axis.addEventListener('mousedown', mousedown);
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);
        this.destroyFns.push(() => {
            axis.removeEventListener('mousedown', mousedown);
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
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
