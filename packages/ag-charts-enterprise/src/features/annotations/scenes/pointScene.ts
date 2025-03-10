import { _ModuleSupport } from 'ag-charts-community';

import type { AnnotationContext } from '../annotationTypes';
import type { PointProperties } from '../properties/pointProperties';
import { validateDatumPoint } from '../utils/validation';
import { convertPoint, invertCoords } from '../utils/values';
import { AnnotationScene } from './annotationScene';
import { DivariantHandle } from './handle';

const { Vec2 } = _ModuleSupport;

export abstract class PointScene<Datum extends PointProperties> extends AnnotationScene {
    override activeHandle?: string;

    protected readonly handle = new DivariantHandle();

    protected dragState?: {
        offset: _ModuleSupport.Vec2;
        handle: _ModuleSupport.Vec2;
    };

    protected anchor: _ModuleSupport.ToolbarAnchor = {
        x: 0,
        y: 0,
        position: 'above',
    };

    public update(datum: Datum, context: AnnotationContext) {
        const coords = convertPoint(datum, context);

        this.updateHandle(datum, coords);
        this.anchor = this.updateAnchor(datum, coords, context);
    }

    public dragStart(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext) {
        this.dragState = {
            offset: target,
            handle: convertPoint(datum, context),
        };
    }

    public drag(datum: Datum, target: _ModuleSupport.Vec2, context: AnnotationContext) {
        const { dragState } = this;

        if (datum.locked || !dragState) return;

        const coords = Vec2.add(dragState.handle, Vec2.sub(target, dragState.offset));
        const point = invertCoords(coords, context);

        datum.x = point.x;
        datum.y = point.y;
    }

    public translate(datum: Datum, translation: _ModuleSupport.Vec2, context: AnnotationContext) {
        const coords = Vec2.add(convertPoint(datum, context), translation);
        const point = invertCoords(coords, context);

        if (!validateDatumPoint(context, point)) {
            return;
        }

        datum.x = point.x;
        datum.y = point.y;
    }

    override toggleHandles(show: boolean | Partial<Record<'handle', boolean>>) {
        this.handle.visible = Boolean(show);
        this.handle.toggleHovered(this.activeHandle === 'handle');
    }

    override toggleActive(active: boolean) {
        this.toggleHandles(active);
        this.handle.toggleActive(active);
    }

    override stopDragging() {
        this.handle.toggleDragging(false);
    }

    public copy(datum: Datum, copiedDatum: Datum, context: AnnotationContext) {
        const coords = convertPoint(datum, context);

        const point = invertCoords({ x: coords.x - 30, y: coords.y - 30 }, context);

        copiedDatum.x = point.x;
        copiedDatum.y = point.y;

        return copiedDatum;
    }

    override getAnchor(): _ModuleSupport.ToolbarAnchor {
        return this.anchor;
    }

    override getCursor() {
        return 'pointer';
    }

    override containsPoint(x: number, y: number) {
        const { handle } = this;

        this.activeHandle = undefined;

        if (handle.containsPoint(x, y)) {
            this.activeHandle = 'handle';
            return true;
        }

        return false;
    }

    override getNodeAtCoords(x: number, y: number): string | undefined {
        if (this.handle.containsPoint(x, y)) return 'handle';
    }

    protected updateHandle(datum: Datum, point: _ModuleSupport.Vec2, bbox?: _ModuleSupport.BBox) {
        const { x, y } = this.getHandleCoords(datum, point, bbox);
        const styles = this.getHandleStyles(datum);

        this.handle.update({ ...styles, x, y });
        this.handle.toggleLocked(datum.locked ?? false);
    }

    protected updateAnchor(datum: Datum, point: _ModuleSupport.Vec2, context: AnnotationContext) {
        const coords = this.getHandleCoords(datum, point);
        return {
            x: coords.x + context.seriesRect.x,
            y: coords.y + context.seriesRect.y,
            position: this.anchor.position,
        };
    }

    protected getHandleCoords(
        _datum: Datum,
        point: _ModuleSupport.Vec2,
        _bbox?: _ModuleSupport.BBox
    ): _ModuleSupport.Vec2 {
        return {
            x: point.x,
            y: point.y,
        };
    }

    protected getHandleStyles(datum: Datum) {
        return {
            fill: datum.handle.fill,
            stroke: datum.handle.stroke,
            strokeOpacity: datum.handle.strokeOpacity,
            strokeWidth: datum.handle.strokeWidth,
        };
    }
}
