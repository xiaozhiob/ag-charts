import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

type Handler = (direction: _ModuleSupport.ChartAxisDirection) => void;

export class ZoomDOMProxy {
    private readonly hAxis: HTMLDivElement;
    private readonly vAxis: HTMLDivElement;
    private readonly destroyFns = new _Util.DestroyFns();

    private initAxis(
        ctx: Pick<_ModuleSupport.ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        domManagerId: string,
        onEnter: Handler,
        onLeave: Handler,
        direction: _ModuleSupport.ChartAxisDirection,
        cursor: 'ew-resize' | 'ns-resize'
    ) {
        const parent = 'afterend';
        const axis = ctx.proxyInteractionService.createProxyElement({ type: 'region', domManagerId, parent });
        _Util.setElementStyle(axis, 'cursor', cursor);
        const [mouseenter, mouseleave] = [() => onEnter(direction), () => onLeave(direction)];
        axis.addEventListener('mouseenter', mouseenter);
        axis.addEventListener('mouseleave', mouseleave);
        this.destroyFns.push(() => {
            axis.removeEventListener('mouseenter', mouseenter);
            axis.removeEventListener('mouseleave', mouseleave);
        });

        return axis;
    }
    constructor(
        ctx: Pick<_ModuleSupport.ModuleContext, 'proxyInteractionService' | 'localeManager'>,
        onEnter: Handler,
        onLeave: Handler
    ) {
        const { X, Y } = _ModuleSupport.ChartAxisDirection;
        this.hAxis = this.initAxis(ctx, 'hori-axis-zoom', onEnter, onLeave, X, 'ew-resize');
        this.vAxis = this.initAxis(ctx, 'vert-axis-zoom', onEnter, onLeave, Y, 'ns-resize');
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
