import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

type AxesHandlers = {
    onDragStart: (id: string, direction: _ModuleSupport.ChartAxisDirection) => void;
    onDrag: (event: _ModuleSupport.PointerOffsets) => void;
    onDragEnd: () => void;
};

export class ZoomDOMProxy {
    private axes: { axisId: string; div: HTMLDivElement }[] = [];
    private readonly destroyFns = new _Util.DestroyFns();

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
        axisId: string,
        handlers: AxesHandlers,
        direction: _ModuleSupport.ChartAxisDirection
    ) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        const cursor = ({ [X]: 'ew-resize', [Y]: 'ns-resize' } as const)[direction];
        const parent = 'afterend';
        const axis = ctx.proxyInteractionService.createProxyElement({ type: 'region', domManagerId: axisId, parent });
        _Util.setElementStyle(axis, 'cursor', cursor);

        const mousedown = (sourceEvent: MouseEvent) => {
            const { button, offsetX, offsetY, clientX, clientY } = sourceEvent;
            if (button === 0) {
                this.dragState = { direction, start: { offsetX, offsetY, clientX, clientY } };
                handlers.onDragStart(axisId, direction);
            }
        };
        const mousemove = (sourceEvent: MouseEvent) => {
            if (this.dragState?.direction === direction) {
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

    constructor(private readonly axesHandlers: AxesHandlers) {}

    destroy() {
        this.destroyFns.destroy();
    }

    update(ctx: _ModuleSupport.ModuleContext) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        const axisCtx = [...ctx.axisManager.getAxisContext(X), ...ctx.axisManager.getAxisContext(Y)];
        const { removed, added } = this.diffAxisIds(axisCtx);

        if (removed.length > 0) {
            this.axes = this.axes.filter((entry) => {
                if (removed.includes(entry.axisId)) {
                    entry.div.remove();
                    return false;
                }
                return true;
            });
        }

        for (const newAxisCtx of added) {
            const { axisId, direction } = newAxisCtx;
            const div = this.initAxis(ctx, axisId, this.axesHandlers, direction);
            this.axes.push({ axisId, div });
        }

        for (const axis of this.axes) {
            const bbox = axisCtx.filter((ac) => ac.axisId === axis.axisId)[0].getCanvasBounds();
            if (bbox === undefined) {
                _Util.setElementStyle(axis.div, 'display', 'none');
            } else {
                _ModuleSupport.setElementBBox(axis.div, bbox);
                _Util.setElementStyle(axis.div, 'display', undefined);
            }
        }
    }

    private diffAxisIds(axisCtx: _ModuleSupport.AxisContext[]) {
        const myIds = this.axes.map((entry) => entry.axisId);
        const ctxIds = axisCtx.map((ctx) => ctx.axisId);

        const removed: string[] = myIds.filter((id) => !ctxIds.includes(id));
        const added: _ModuleSupport.AxisContext[] = axisCtx.filter((ac) => !myIds.includes(ac.axisId));
        return { removed, added };
    }
}
