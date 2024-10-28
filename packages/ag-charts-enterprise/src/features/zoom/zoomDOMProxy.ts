import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

type AxesHandlers = {
    onDragStart: (id: string, direction: _ModuleSupport.ChartAxisDirection) => void;
    onDrag: (event: _ModuleSupport.PointerOffsets) => void;
    onDragEnd: () => void;
};

export class ZoomDOMProxy {
    private readonly hAxis: HTMLDivElement;
    private readonly vAxis: HTMLDivElement;
    private readonly destroyFns = new _Util.DestroyFns();

    private readonly axisIds: {
        [_ModuleSupport.ChartAxisDirection.X]?: string;
        [_ModuleSupport.ChartAxisDirection.Y]?: string;
    } = {};

    private dragState?: {
        direction: _ModuleSupport.ChartAxisDirection;
        start: {
            offsetX: number;
            offsetY: number;
            clientX: number;
            clientY: number;
        };
    };

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
            const { button, offsetX, offsetY, clientX, clientY } = sourceEvent;
            if (button === 0) {
                this.dragState = { direction, start: { offsetX, offsetY, clientX, clientY } };
                const id = this.axisIds[direction] ?? 'unknown';
                handlers.onDragStart(id, direction);
            }
        };
        const mousemove = (sourceEvent: MouseEvent) => {
            if (this.dragState !== undefined) {
                // [offsetX, offsetY] is relative to the sourceEvent.target, which can be another element
                // such as a legend button. Therefore, calculate [offsetX, offsetY] relative to the axis
                // element that fired the 'mousedown' event.
                const { start } = this.dragState;
                handlers.onDrag({
                    offsetX: start.offsetX + (sourceEvent.clientX - start.clientX),
                    offsetY: start.offsetY + (sourceEvent.clientY - start.clientY),
                });
            }
        };
        const mouseup = (sourceEvent: MouseEvent) => {
            if (this.dragState !== undefined && sourceEvent.button === 0) {
                this.dragState = undefined;
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
            this.axisIds[dir] = axisCtx[0].axisId;
        }
    }
}
