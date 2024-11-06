import { _ModuleSupport, type _Widget } from 'ag-charts-community';

const { BBoxValues } = _ModuleSupport;

type AxesHandlers = {
    onDragStart: (id: string, direction: _ModuleSupport.ChartAxisDirection) => void;
    onDrag: (event: _ModuleSupport.PointerOffsets) => void;
    onDragEnd: () => void;
};

type ProxyAxis = {
    axisId: string;
    div: _Widget.NativeWidget<HTMLDivElement>;
    destroy(): void;
};

export class ZoomDOMProxy {
    private axes: ProxyAxis[] = [];

    private initAxis(
        ctx: Pick<_ModuleSupport.ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        axisId: string,
        handlers: AxesHandlers,
        direction: _ModuleSupport.ChartAxisDirection
    ): ProxyAxis {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        const cursor = ({ [X]: 'ew-resize', [Y]: 'ns-resize' } as const)[direction];
        const parent = 'afterend';
        const div = ctx.proxyInteractionService.createProxyElement({ type: 'region', domManagerId: axisId, parent });
        div.setCursor(cursor);

        const removeListeners = ctx.proxyInteractionService.createDragListeners({
            element: div.getElement(),
            onDragStart: () => handlers.onDragStart(axisId, direction),
            onDrag: handlers.onDrag,
            onDragEnd: handlers.onDragEnd,
        });
        const destroy = () => {
            div.destroy();
            removeListeners();
        };
        return { axisId, div, destroy };
    }

    constructor(private readonly axesHandlers: AxesHandlers) {}

    destroy() {
        this.axes.forEach((a) => a.destroy());
    }

    update(ctx: _ModuleSupport.ModuleContext) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        const axesCtx = [...ctx.axisManager.getAxisContext(X), ...ctx.axisManager.getAxisContext(Y)];
        const { removed, added } = this.diffAxisIds(axesCtx);

        if (removed.length > 0) {
            this.axes = this.axes.filter((entry) => {
                if (removed.includes(entry.axisId)) {
                    entry.destroy();
                    return false;
                }
                return true;
            });
        }

        for (const newAxisCtx of added) {
            const { axisId, direction } = newAxisCtx;
            this.axes.push(this.initAxis(ctx, axisId, this.axesHandlers, direction));
        }

        for (const axis of this.axes) {
            const axisCtx = axesCtx.filter((ac) => ac.axisId === axis.axisId)[0];
            const bbox = axisCtx.getCanvasBounds();
            axis.div.setHidden(BBoxValues.isEmpty(bbox));
            if (bbox !== undefined) {
                axis.div.setBounds(bbox);
            }
        }
    }

    testFindTarget(canvasX: number, canvasY: number): { target: HTMLElement; x: number; y: number } | undefined {
        for (const axis of this.axes) {
            const bbox = axis.div.getBounds();
            if (!axis.div.isHidden() && BBoxValues.containsPoint(bbox, canvasX, canvasY)) {
                const x = canvasX - bbox.x;
                const y = canvasY - bbox.y;
                return { target: axis.div.getElement(), x, y };
            }
        }
        return undefined;
    }

    private diffAxisIds(axesCtx: _ModuleSupport.AxisContext[]) {
        const myIds = this.axes.map((entry) => entry.axisId);
        const ctxIds = axesCtx.map((ctx) => ctx.axisId);

        const removed: string[] = myIds.filter((id) => !ctxIds.includes(id));
        const added: _ModuleSupport.AxisContext[] = axesCtx.filter((ac) => !myIds.includes(ac.axisId));
        return { removed, added };
    }
}
