import type { AgZoomAnchorPoint } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import type { DefinedZoomState, ZoomCoords } from './zoomTypes';
import { constrainZoom, definedZoomState, dx, dy, pointToRatio, scaleZoomAxisWithAnchor } from './zoomUtils';

export class ZoomAxisDragger {
    private coords?: ZoomCoords;
    private oldZoom?: DefinedZoomState;

    update(
        event: _ModuleSupport.PointerOffsets,
        direction: _ModuleSupport.ChartAxisDirection,
        anchor: AgZoomAnchorPoint,
        bbox: _ModuleSupport.BBox,
        zoom?: _ModuleSupport.AxisZoomState,
        axisZoom?: _ModuleSupport.ZoomState
    ): _ModuleSupport.ZoomState {
        // Store the initial zoom state, merged with the state for this axis
        this.oldZoom ??= definedZoomState(
            direction === _ModuleSupport.ChartAxisDirection.X ? { ...zoom, x: axisZoom } : { ...zoom, y: axisZoom }
        );

        this.updateCoords(event.offsetX, event.offsetY);
        return this.updateZoom(direction, anchor, bbox);
    }

    stop() {
        this.coords = undefined;
        this.oldZoom = undefined;
    }

    private updateCoords(x: number, y: number): void {
        if (this.coords) {
            this.coords.x2 = x;
            this.coords.y2 = y;
        } else {
            this.coords = { x1: x, y1: y, x2: x, y2: y };
        }
    }

    private updateZoom(
        direction: _ModuleSupport.ChartAxisDirection,
        anchor: AgZoomAnchorPoint,
        bbox: _ModuleSupport.BBox
    ): _ModuleSupport.ZoomState {
        const { coords, oldZoom } = this;

        let newZoom = definedZoomState(oldZoom);

        if (!coords || !oldZoom) {
            if (direction === _ModuleSupport.ChartAxisDirection.X) return newZoom.x;
            return newZoom.y;
        }

        // Scale the zoom along the given axis, anchoring on the end of the axis
        const origin = pointToRatio(bbox, coords.x1, coords.y1);
        const target = pointToRatio(bbox, coords.x2, coords.y2);

        if (direction === _ModuleSupport.ChartAxisDirection.X) {
            const scaleX = (target.x - origin.x) * dx(oldZoom);

            newZoom.x.max += scaleX;
            newZoom.x = scaleZoomAxisWithAnchor(newZoom.x, oldZoom.x, anchor, origin.x);
            newZoom = constrainZoom(newZoom);

            return newZoom.x;
        }

        const scaleY = (target.y - origin.y) * dy(oldZoom);

        newZoom.y.max -= scaleY;
        newZoom.y = scaleZoomAxisWithAnchor(newZoom.y, oldZoom.y, anchor, origin.y);
        newZoom = constrainZoom(newZoom);

        return newZoom.y;
    }
}
