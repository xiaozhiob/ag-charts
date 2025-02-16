import { _ModuleSupport } from 'ag-charts-community';

import type { AnnotationContext } from '../annotationTypes';
import { AnnotationScene } from '../scenes/annotationScene';
import { ChannelScene } from '../scenes/channelScene';
import { DivariantHandle, UnivariantHandle } from '../scenes/handle';
import { LineWithTextScene } from '../scenes/lineWithTextScene';
import { convertPoint, invertCoords } from '../utils/values';
import type { DisjointChannelProperties } from './disjointChannelProperties';

const { Vec2, Vec4 } = _ModuleSupport;

type ChannelHandle = keyof DisjointChannelScene['handles'];

export class DisjointChannelScene extends ChannelScene<DisjointChannelProperties> {
    static override is(value: unknown): value is DisjointChannelScene {
        return AnnotationScene.isCheck(value, 'disjoint-channel');
    }

    type = 'disjoint-channel';

    protected override ignoreYBounds: boolean = true;

    override activeHandle?: ChannelHandle;
    override handles = {
        topLeft: new DivariantHandle(),
        topRight: new DivariantHandle(),
        bottomLeft: new DivariantHandle(),
        bottomRight: new UnivariantHandle(),
    };

    constructor() {
        super();
        this.append([this.background, this.topLine, this.bottomLine, ...Object.values(this.handles)]);
    }

    override dragHandle(
        datum: DisjointChannelProperties,
        target: _ModuleSupport.Vec2,
        context: AnnotationContext,
        snapping: boolean
    ) {
        const { activeHandle, handles } = this;
        if (activeHandle == null) return;

        const { offset } = handles[activeHandle].drag(target);
        handles[activeHandle].toggleDragging(true);

        const invert = (coords: _ModuleSupport.Vec2) => invertCoords(coords, context);
        const prev = datum.toJson();
        const angle = datum.snapToAngle;

        switch (activeHandle) {
            case 'topLeft':
            case 'bottomLeft': {
                const direction = activeHandle === 'topLeft' ? 1 : -1;
                const start = snapping
                    ? this.snapToAngle(target, context, 'topLeft', 'topRight', angle, direction)
                    : invert({
                          x: handles.topLeft.handle.x + offset.x,
                          y: handles.topLeft.handle.y + offset.y * direction,
                      });

                const bottomStart = snapping
                    ? this.snapToAngle(target, context, 'bottomLeft', 'bottomRight', angle, -direction)
                    : invert({
                          x: handles.bottomLeft.handle.x + offset.x,
                          y: handles.bottomLeft.handle.y + offset.y * -direction,
                      });

                if (start?.y == null || bottomStart?.y == null || datum.start.y == null) return;

                const startHeight = datum.startHeight + (start.y - datum.start.y) * 2;

                datum.start.x = start.x;
                datum.start.y = start.y;
                datum.startHeight = startHeight;

                break;
            }

            case 'topRight': {
                const end = snapping
                    ? this.snapToAngle(target, context, 'topRight', 'topLeft', angle)
                    : invert({
                          x: handles.topRight.handle.x + offset.x,
                          y: handles.topRight.handle.y + offset.y,
                      });

                if (end?.y == null || datum.end.y == null) return;

                const endHeight = datum.endHeight + (end.y - datum.end.y) * 2;

                datum.end.x = end.x;
                datum.end.y = end.y;
                datum.endHeight = endHeight;

                break;
            }

            case 'bottomRight': {
                const bottomStart = invert({
                    x: handles.bottomLeft.handle.x + offset.x,
                    y: handles.bottomLeft.handle.y + offset.y,
                });
                const bottomEnd = invert({
                    x: handles.bottomRight.handle.x + offset.x,
                    y: handles.bottomRight.handle.y + offset.y,
                });

                if (!bottomStart || !bottomEnd || datum.start.y == null || datum.end.y == null) return;

                const endHeight = datum.end.y - bottomEnd.y;
                const startHeight = datum.startHeight - (datum.endHeight - endHeight);

                datum.startHeight = startHeight;
                datum.endHeight = endHeight;
            }
        }

        if (!datum.isValidWithContext(context)) {
            datum.set(prev);
        }
    }

    protected override getOtherCoords(
        datum: DisjointChannelProperties,
        topLeft: _ModuleSupport.Vec2,
        topRight: _ModuleSupport.Vec2,
        context: AnnotationContext
    ): _ModuleSupport.Vec2[] {
        const startHeight = convertPoint(datum.bottom.start, context).y - convertPoint(datum.start, context).y;
        const endHeight = convertPoint(datum.bottom.end, context).y - convertPoint(datum.end, context).y;

        const bottomLeft = Vec2.add(topLeft, Vec2.from(0, startHeight));
        const bottomRight = Vec2.add(topRight, Vec2.from(0, endHeight));

        return [bottomLeft, bottomRight];
    }

    override updateLines(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4) {
        const { topLine, bottomLine } = this;
        const { lineDashOffset, stroke, strokeOpacity, strokeWidth } = datum;

        const lineStyles = {
            lineCap: datum.getLineCap(),
            lineDash: datum.getLineDash(),
            lineDashOffset,
            stroke,
            strokeOpacity,
            strokeWidth,
        };

        topLine.setProperties({ ...top, ...lineStyles });
        bottomLine.setProperties({ ...bottom, ...lineStyles });
    }

    override updateHandles(datum: DisjointChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4) {
        const {
            handles: { topLeft, topRight, bottomLeft, bottomRight },
        } = this;

        const handleStyles = {
            fill: datum.handle.fill,
            stroke: datum.handle.stroke ?? datum.stroke,
            strokeOpacity: datum.handle.strokeOpacity ?? datum.strokeOpacity,
            strokeWidth: datum.handle.strokeWidth ?? datum.strokeWidth,
        };

        topLeft.update({ ...handleStyles, ...Vec4.start(top) });
        topRight.update({ ...handleStyles, ...Vec4.end(top) });
        bottomLeft.update({ ...handleStyles, ...Vec4.start(bottom) });
        bottomRight.update({
            ...handleStyles,
            ...Vec2.sub(Vec4.end(bottom), Vec2.from(bottomRight.handle.width / 2, bottomRight.handle.height / 2)),
        });
    }

    override updateText = LineWithTextScene.updateChannelText.bind(this, false);

    override getBackgroundPoints(
        datum: DisjointChannelProperties,
        top: _ModuleSupport.Vec4,
        bottom: _ModuleSupport.Vec4,
        bounds: _ModuleSupport.Vec4
    ) {
        const isFlippedX = top.x1 > top.x2;
        const isFlippedY = top.y1 > top.y2;
        const topY = isFlippedY ? bounds.y2 : bounds.y1;
        const bottomY = isFlippedY ? bounds.y1 : bounds.y2;

        const points = Vec2.from(top);

        if (datum.extendEnd && top.y2 === bottomY) {
            points.push(Vec2.from(isFlippedX ? bounds.x1 : bounds.x2, isFlippedY ? bounds.y1 : bounds.y2));
        }

        if (datum.extendEnd && bottom.y2 === topY) {
            points.push(Vec2.from(isFlippedX ? bounds.x1 : bounds.x2, isFlippedY ? bounds.y2 : bounds.y1));
        }

        points.push(...Vec2.from(bottom).reverse());

        if (datum.extendStart && bottom.y1 === bottomY) {
            points.push(Vec2.from(isFlippedX ? bounds.x2 : bounds.x1, isFlippedY ? bounds.y1 : bounds.y2));
        }

        if (datum.extendStart && top.y1 === topY) {
            points.push(Vec2.from(isFlippedX ? bounds.x2 : bounds.x1, isFlippedY ? bounds.y2 : bounds.y1));
        }

        return points;
    }
}
