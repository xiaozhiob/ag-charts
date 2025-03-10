import type { AgZoomRange, AgZoomRatio } from 'ag-charts-types';

import type { MementoOriginator } from '../../api/state/memento';
import { ContinuousScale } from '../../scale/continuousScale';
import { OrdinalTimeScale } from '../../scale/ordinalTimeScale';
import type { BBox } from '../../scene/bbox';
import { includes } from '../../util/array';
import { BaseManager } from '../../util/baseManager';
import type { BBoxValues } from '../../util/bboxinterface';
import { deepClone } from '../../util/json';
import { Logger } from '../../util/logger';
import { calcPanToBBoxRatios } from '../../util/panToBBox';
import { StateTracker } from '../../util/stateTracker';
import { isFiniteNumber, isObject } from '../../util/type-guards';
import { ChartAxisDirection } from '../chartAxisDirection';
import type { AxisLayout, LayoutCompleteEvent, LayoutManager } from '../layout/layoutManager';

export interface ZoomState {
    min: number;
    max: number;
}

export interface AxisZoomState {
    x?: ZoomState;
    y?: ZoomState;
}

export interface DefinedZoomState {
    x: ZoomState;
    y: ZoomState;
}

export type ZoomMemento = {
    rangeX?: AgZoomRange;
    rangeY?: AgZoomRange;
    ratioX?: AgZoomRatio;
    ratioY?: AgZoomRatio;
};

export interface ZoomChangeEvent extends AxisZoomState {
    type: 'zoom-change';
    callerId: string;
    axes: Record<string, ZoomState | undefined>;
}

export interface ZoomPanStartEvent {
    type: 'zoom-pan-start';
    callerId: string;
}

export type ChartAxisLike = {
    id: string;
    direction: ChartAxisDirection;
    visibleRange: [number, number];
};

type ZoomEvents = ZoomChangeEvent | ZoomPanStartEvent;

const expectedMementoKeys: Array<keyof ZoomMemento> = ['rangeX', 'rangeY', 'ratioX', 'ratioY'];

/**
 * Manages the current zoom state for a chart. Tracks the requested zoom from distinct dependents
 * and handles conflicting zoom requests.
 */
export class ZoomManager extends BaseManager<ZoomEvents['type'], ZoomEvents> implements MementoOriginator<ZoomMemento> {
    public mementoOriginatorKey = 'zoom' as const;

    private readonly axisZoomManagers = new Map<string, AxisZoomManager>();
    private readonly state = new StateTracker<AxisZoomState>(undefined, 'initial');

    private axes?: LayoutCompleteEvent['axes'];

    private lastRestoredState?: AxisZoomState;
    private independentAxes = false;
    private navigatorModule = false;
    private zoomModule = false;

    // The initial state memento can not be restored until the chart has performed its first layout. Instead save it as
    // pending and restore then delete it on the first layout.
    private pendingMemento?: {
        version: string;
        mementoVersion: string;
        memento: ZoomMemento | undefined;
    };

    public addLayoutListeners(layoutManager: LayoutManager) {
        this.destroyFns.push(
            layoutManager.addListener('layout:complete', (event) => {
                const { pendingMemento } = this;
                this.axes = event.axes;
                if (pendingMemento) {
                    this.restoreMemento(pendingMemento.version, pendingMemento.mementoVersion, pendingMemento.memento);
                }
            })
        );
    }

    public createMemento() {
        const zoom = this.getDefinedZoom();
        return {
            rangeX: this.getRangeDirection(zoom.x, ChartAxisDirection.X),
            rangeY: this.getRangeDirection(zoom.y, ChartAxisDirection.Y),
            ratioX: { start: zoom.x.min, end: zoom.x.max },
            ratioY: { start: zoom.y.min, end: zoom.y.max },
        };
    }

    public guardMemento(blob: unknown): blob is ZoomMemento | undefined {
        if (blob == null) return true;
        if (!isObject(blob)) return false;

        for (const key of Object.keys(blob)) {
            if (!includes(expectedMementoKeys, key)) {
                return false;
            }
        }

        return true;
    }

    public restoreMemento(_version: string, _mementoVersion: string, memento: ZoomMemento | undefined) {
        const { independentAxes } = this;

        if (!this.axes) {
            this.pendingMemento = { version: _version, mementoVersion: _mementoVersion, memento };
            return;
        }
        delete this.pendingMemento;

        // Migration from older versions can be implemented here.

        const zoom = this.getDefinedZoom();

        if (memento?.rangeX) {
            zoom.x = this.rangeToRatio(memento.rangeX, ChartAxisDirection.X) ?? { min: 0, max: 1 };
        } else if (memento?.ratioX) {
            zoom.x = {
                min: memento.ratioX.start ?? 0,
                max: memento.ratioX.end ?? 1,
            };
        } else {
            zoom.x = { min: 0, max: 1 };
        }

        // Do not adjust the y-axis zoom if the navigator module is enabled by itself
        if (!this.navigatorModule || this.zoomModule) {
            if (memento?.rangeY) {
                zoom.y = this.rangeToRatio(memento.rangeY, ChartAxisDirection.Y) ?? { min: 0, max: 1 };
            } else if (memento?.ratioY) {
                zoom.y = {
                    min: memento.ratioY.start ?? 0,
                    max: memento.ratioY.end ?? 1,
                };
            } else {
                zoom.y = { min: 0, max: 1 };
            }
        }

        this.lastRestoredState = zoom;

        if (independentAxes !== true) {
            this.updateZoom('zoom-manager', zoom);
            return;
        }

        const primaryX = this.getPrimaryAxis(ChartAxisDirection.X);
        const primaryY = this.getPrimaryAxis(ChartAxisDirection.Y);

        for (const axis of [primaryX, primaryY]) {
            if (!axis) continue;
            this.updateAxisZoom('zoom-manager', axis.id, zoom[axis.direction]);
        }
    }

    public updateAxes(axes: Array<ChartAxisLike>) {
        const zoomManagers = new Map(axes.map((axis) => [axis.id, this.axisZoomManagers.get(axis.id)]));

        this.axisZoomManagers.clear();

        for (const axis of axes) {
            this.axisZoomManagers.set(axis.id, zoomManagers.get(axis.id) ?? new AxisZoomManager(axis));
        }

        if (this.state.size > 0 && axes.length > 0) {
            this.updateZoom(this.state.stateId()!, this.state.stateValue());
        }
    }

    public setIndependentAxes(independent = true) {
        this.independentAxes = independent;
    }

    public setNavigatorEnabled(enabled = true) {
        this.navigatorModule = enabled;
    }

    public setZoomModuleEnabled(enabled = true) {
        this.zoomModule = enabled;
    }

    public updateZoom(callerId: string, newZoom?: AxisZoomState) {
        if (this.axisZoomManagers.size === 0) {
            const stateId = this.state.stateId()!;
            if (stateId === 'initial' || stateId === callerId) {
                this.state.set(callerId, newZoom);
            }
            return;
        }

        this.state.set(callerId, newZoom);

        this.axisZoomManagers.forEach((axis) => {
            axis.updateZoom(callerId, newZoom?.[axis.getDirection()]);
        });

        this.applyChanges(callerId);
    }

    public updateAxisZoom(callerId: string, axisId: string, newZoom?: ZoomState) {
        this.axisZoomManagers.get(axisId)?.updateZoom(callerId, newZoom);
        this.applyChanges(callerId);
    }

    public updatePrimaryAxisZoom(callerId: string, direction: ChartAxisDirection, newZoom?: ZoomState) {
        const primaryAxis = this.getPrimaryAxis(direction);
        if (!primaryAxis) return;
        this.updateAxisZoom(callerId, primaryAxis.id, newZoom);
    }

    public panToBBox(callerId: string, seriesRect: BBox, target: BBoxValues) {
        const zoom = this.getZoom();
        if (zoom === undefined || (!zoom.x && !zoom.y)) return;

        if (target.width > seriesRect.width || target.height > seriesRect.height) {
            Logger.errorOnce(`cannot pan to target BBox`);
            return;
        }

        const newZoom: AxisZoomState = calcPanToBBoxRatios(seriesRect, zoom, target);
        this.updateZoom(callerId, newZoom);
    }

    // Fire this event to signal to listeners that the view is changing through a zoom and/or pan change.
    public fireZoomPanStartEvent(callerId: string) {
        this.listeners.dispatch('zoom-pan-start', { type: 'zoom-pan-start', callerId });
    }

    public extendToEnd(callerId: string, direction: ChartAxisDirection, extent: number) {
        return this.extendWith(callerId, direction, (end) => Number(end) - extent);
    }

    public extendWith(callerId: string, direction: ChartAxisDirection, fn: (end: Date | number) => Date | number) {
        const axis = this.getPrimaryAxis(direction);
        if (!axis) return;

        const extents = this.getDomainExtents(axis);
        if (!extents) return;

        const [, end] = extents;
        const start = fn(end);

        const ratio = this.rangeToRatio({ start, end }, direction);
        if (!ratio) return;

        this.updateZoom(callerId, { [direction]: ratio });
    }

    public updateWith(
        callerId: string,
        direction: ChartAxisDirection,
        fn: (start: Date | number, end: Date | number) => [Date | number, Date | number]
    ) {
        const axis = this.getPrimaryAxis(direction);
        if (!axis) return;

        const extents = this.getDomainExtents(axis);
        if (!extents) return;

        let [start, end] = extents;
        [start, end] = fn(start, end);

        const ratio = this.rangeToRatio({ start, end }, direction);
        if (!ratio) return;

        this.updateZoom(callerId, { [direction]: ratio });
    }

    public getZoom(): AxisZoomState | undefined {
        let x: ZoomState | undefined;
        let y: ZoomState | undefined;

        // Use the zoom on the primary (first) axis in each direction
        this.axisZoomManagers.forEach((axis) => {
            if (axis.getDirection() === ChartAxisDirection.X) {
                x ??= axis.getZoom();
            } else if (axis.getDirection() === ChartAxisDirection.Y) {
                y ??= axis.getZoom();
            }
        });

        if (x || y) {
            return { x, y };
        }
    }

    public getAxisZoom(axisId: string): ZoomState {
        return this.axisZoomManagers.get(axisId)?.getZoom() ?? { min: 0, max: 1 };
    }

    public getAxisZooms(): Record<string, { direction: ChartAxisDirection; zoom: ZoomState | undefined }> {
        const axes: Record<string, { direction: ChartAxisDirection; zoom: ZoomState | undefined }> = {};
        for (const [axisId, axis] of this.axisZoomManagers.entries()) {
            axes[axisId] = {
                direction: axis.getDirection(),
                zoom: axis.getZoom(),
            };
        }
        return axes;
    }

    public getRestoredZoom(): AxisZoomState | undefined {
        return this.lastRestoredState;
    }

    private applyChanges(callerId: string) {
        const changed = Array.from(this.axisZoomManagers.values(), (axis) => axis.applyChanges()).some(Boolean);

        if (!changed) {
            return;
        }

        const axes: Record<string, ZoomState | undefined> = {};
        for (const [axisId, axis] of this.axisZoomManagers.entries()) {
            axes[axisId] = axis.getZoom();
        }

        this.listeners.dispatch('zoom-change', { type: 'zoom-change', ...this.getZoom(), axes, callerId });
    }

    private getRangeDirection(ratio: ZoomState, direction: ChartAxisDirection): AgZoomRange | undefined {
        const axis = this.getPrimaryAxis(direction);
        if (!axis || (!ContinuousScale.is(axis.scale) && !OrdinalTimeScale.is(axis.scale))) return;

        const extents = this.getDomainPixelExtents(axis);
        if (!extents) return;

        const [d0, d1] = extents;

        let start;
        let end;

        if (d0 <= d1) {
            start = axis.scale.invert?.(0); // 0 is the start of the visible axis
            end = axis.scale.invert?.(d0 + (d1 - d0) * ratio.max);
        } else {
            start = axis.scale.invert?.(d0 - (d0 - d1) * ratio.min);
            end = axis.scale.invert?.(0);
        }

        return { start, end };
    }

    private rangeToRatio(range: AgZoomRange, direction: ChartAxisDirection): ZoomState | undefined {
        const axis = this.getPrimaryAxis(direction);
        if (!axis) return;

        const extents = this.getDomainPixelExtents(axis);
        if (!extents) return;

        const [d0, d1] = extents;

        const r0 = range.start == null ? d0 : axis.scale.convert?.(range.start);
        const r1 = range.end == null ? d1 : axis.scale.convert?.(range.end);
        if (!isFiniteNumber(r0) || !isFiniteNumber(r1)) return;

        const diff = d1 - d0;
        const min = Math.abs((r0 - d0) / diff);
        const max = Math.abs((r1 - d0) / diff);

        return { min, max };
    }

    private getPrimaryAxis(direction: ChartAxisDirection) {
        return this.axes?.find((a) => a.direction === direction);
    }

    private getDomainExtents(axis: AxisLayout) {
        const domain = axis.scale.getDomain?.();
        const d0 = domain?.at(0);
        const d1 = domain?.at(-1);

        if (d0 == null || d1 == null) return;

        return [d0, d1];
    }

    private getDomainPixelExtents(axis: AxisLayout) {
        const domain = axis.scale.getDomain?.();
        const d0 = axis.scale.convert?.(domain?.at(0));
        const d1 = axis.scale.convert?.(domain?.at(-1));

        if (!isFiniteNumber(d0) || !isFiniteNumber(d1)) return;

        return [d0, d1];
    }

    private getDefinedZoom(): DefinedZoomState {
        const zoom = this.getZoom();
        return {
            x: { min: zoom?.x?.min ?? 0, max: zoom?.x?.max ?? 1 },
            y: { min: zoom?.y?.min ?? 0, max: zoom?.y?.max ?? 1 },
        };
    }
}

class AxisZoomManager {
    private readonly axis: ChartAxisLike;
    private currentZoom: ZoomState;
    private readonly state: StateTracker<ZoomState>;

    constructor(axis: ChartAxisLike) {
        this.axis = axis;

        const [min = 0, max = 1] = axis.visibleRange;
        this.state = new StateTracker({ min, max });
        this.currentZoom = this.state.stateValue()!;
    }

    getDirection(): ChartAxisDirection {
        return this.axis.direction;
    }

    public updateZoom(callerId: string, newZoom?: ZoomState) {
        this.state.set(callerId, newZoom);
    }

    public getZoom() {
        return deepClone(this.state.stateValue()!);
    }

    public applyChanges(): boolean {
        const prevZoom = this.currentZoom;
        this.currentZoom = this.state.stateValue()!;
        return prevZoom.min !== this.currentZoom.min || prevZoom.max !== this.currentZoom.max;
    }
}
