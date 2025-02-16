import { _ModuleSupport } from 'ag-charts-community';

import type { AnnotationContext } from '../annotationTypes';
import { AnnotationScene } from '../scenes/annotationScene';
import { ChannelScene } from '../scenes/channelScene';
import { CollidableLine } from '../scenes/collidableLineScene';
import { DivariantHandle, UnivariantHandle } from '../scenes/handle';
import { LineWithTextScene } from '../scenes/lineWithTextScene';
import { isPoint, validateDatumPoint } from '../utils/validation';
import { convertPoint, invertCoords } from '../utils/values';
import type { ParallelChannelProperties } from './parallelChannelProperties';

const { Vec2, Vec4 } = _ModuleSupport;

type ChannelHandle = keyof ParallelChannelScene['handles'];

export class ParallelChannelScene extends ChannelScene<ParallelChannelProperties> {
    static override is(value: unknown): value is ParallelChannelScene {
        return AnnotationScene.isCheck(value, 'parallel-channel');
    }

    type = 'parallel-channel';

    protected override ignoreYBounds: boolean = true;

    override activeHandle?: ChannelHandle;
    override handles = {
        topLeft: new DivariantHandle(),
        topMiddle: new UnivariantHandle(),
        topRight: new DivariantHandle(),
        bottomLeft: new DivariantHandle(),
        bottomMiddle: new UnivariantHandle(),
        bottomRight: new DivariantHandle(),
    };

    private readonly middleLine = new CollidableLine();

    constructor() {
        super();
        this.append([this.background, this.topLine, this.middleLine, this.bottomLine, ...Object.values(this.handles)]);
    }

    override dragHandle(
        datum: ParallelChannelProperties,
        target: _ModuleSupport.Vec2,
        context: AnnotationContext,
        snapping: boolean
    ) {
        const { activeHandle, handles } = this;
        if (activeHandle == null) return;

        const { offset } = handles[activeHandle].drag(target);
        handles[activeHandle].toggleDragging(true);

        const prev = datum.toJson();
        let moves: Array<ChannelHandle> = [];
        let origins: Array<ChannelHandle> = [];

        switch (activeHandle) {
            case 'topLeft':
            case 'bottomLeft':
                moves = ['topLeft', 'bottomLeft'];
                origins = ['topRight', 'bottomRight'];
                break;
            case 'topMiddle':
                moves = ['topLeft', 'topRight'];
                offset.y -= UnivariantHandle.HANDLE_SIZE / 2;
                break;
            case 'topRight':
            case 'bottomRight':
                moves = ['topRight', 'bottomRight'];
                origins = ['topLeft', 'bottomLeft'];
                break;
            case 'bottomMiddle':
                moves = ['bottomLeft', 'bottomRight'];
                offset.y -= UnivariantHandle.HANDLE_SIZE / 2;
                break;
        }

        const angle = datum.snapToAngle;
        const invertedMoves = moves
            .map((handle, index) =>
                snapping && origins[index]
                    ? this.snapToAngle(target, context, handle, origins[index], angle)
                    : invertCoords(Vec2.add(handles[handle].handle, offset), context)
            )
            .filter(isPoint);

        // Do not move any handles if some of them are trying to move to invalid points
        if (invertedMoves.some((invertedMove) => !validateDatumPoint(context, invertedMove))) {
            return;
        }

        // Adjust the height if dragging a middle handle
        if ((activeHandle === 'topMiddle' || activeHandle === 'bottomMiddle') && datum.start.y != null) {
            const topLeft = invertCoords(Vec2.add(handles.topLeft.handle, offset), context);

            if (validateDatumPoint(context, topLeft)) {
                if (activeHandle === 'topMiddle') {
                    datum.height += topLeft.y - datum.start.y;
                } else {
                    datum.height -= topLeft.y - datum.start.y;
                }
            }
        }

        // Move the start and end points if required
        for (const [index, invertedMove] of invertedMoves.entries()) {
            switch (moves[index]) {
                case 'topLeft':
                    datum.start.x = invertedMove.x;
                    datum.start.y = invertedMove.y;
                    break;

                case 'topRight':
                    datum.end.x = invertedMove.x;
                    datum.end.y = invertedMove.y;
                    break;
            }
        }

        if (!datum.isValidWithContext(context)) {
            datum.set(prev);
        }
    }

    protected override getOtherCoords(
        datum: ParallelChannelProperties,
        topLeft: _ModuleSupport.Vec2,
        topRight: _ModuleSupport.Vec2,
        context: AnnotationContext
    ): _ModuleSupport.Vec2[] {
        const height = convertPoint(datum.bottom.start, context).y - convertPoint(datum.start, context).y;

        const bottomLeft = Vec2.add(topLeft, Vec2.from(0, height));
        const bottomRight = Vec2.add(topRight, Vec2.from(0, height));

        return [bottomLeft, bottomRight];
    }

    override containsPoint(x: number, y: number) {
        return (
            super.containsPoint(x, y) ||
            (this.middleLine.visible && this.middleLine.strokeWidth > 0 && this.middleLine.containsPoint(x, y))
        );
    }

    public override getNodeAtCoords(x: number, y: number): string | undefined {
        if (this.middleLine.visible && this.middleLine.strokeWidth > 0 && this.middleLine.containsPoint(x, y))
            return 'line';

        return super.getNodeAtCoords(x, y);
    }

    override updateLines(
        datum: ParallelChannelProperties,
        top: _ModuleSupport.Vec4,
        bottom: _ModuleSupport.Vec4,
        context: AnnotationContext,
        naturalTop: _ModuleSupport.Vec4,
        naturalBottom: _ModuleSupport.Vec4
    ) {
        const { topLine, middleLine, bottomLine } = this;
        const { lineDashOffset, stroke, strokeOpacity, strokeWidth } = datum;

        const lineDash = datum.getLineDash();

        const lineStyles = {
            lineCap: datum.getLineCap(),
            lineDash,
            lineDashOffset,
            stroke,
            strokeOpacity,
            strokeWidth,
        };

        topLine.setProperties({ ...top, ...lineStyles });
        bottomLine.setProperties({ ...bottom, ...lineStyles });

        const middlePoints = this.extendLine(
            {
                x1: naturalTop.x1,
                y1: naturalBottom.y1 + (naturalTop.y1 - naturalBottom.y1) / 2,
                x2: naturalTop.x2,
                y2: naturalBottom.y2 + (naturalTop.y2 - naturalBottom.y2) / 2,
            },
            datum,
            context
        );

        middleLine.setProperties({
            ...middlePoints,
            lineDash: datum.middle.lineDash ?? lineDash,
            lineDashOffset: datum.middle.lineDashOffset ?? lineDashOffset,
            stroke: datum.middle.stroke ?? stroke,
            strokeOpacity: datum.middle.strokeOpacity ?? strokeOpacity,
            strokeWidth: datum.middle.strokeWidth ?? strokeWidth,
            visible: datum.middle.visible ?? true,
        });
    }

    override updateHandles(datum: ParallelChannelProperties, top: _ModuleSupport.Vec4, bottom: _ModuleSupport.Vec4) {
        const {
            handles: { topLeft, topMiddle, topRight, bottomLeft, bottomMiddle, bottomRight },
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
        bottomRight.update({ ...handleStyles, ...Vec4.end(bottom) });
        topMiddle.update({
            ...handleStyles,
            ...Vec2.sub(Vec4.center(top), Vec2.from(topMiddle.handle.width / 2, topMiddle.handle.height / 2)),
        });
        bottomMiddle.update({
            ...handleStyles,
            ...Vec2.sub(Vec4.center(bottom), Vec2.from(bottomMiddle.handle.width / 2, bottomMiddle.handle.height / 2)),
        });
    }

    override updateText = LineWithTextScene.updateChannelText.bind(this, true);

    override getBackgroundPoints(
        datum: ParallelChannelProperties,
        top: _ModuleSupport.Vec4,
        bottom: _ModuleSupport.Vec4,
        bounds: _ModuleSupport.Vec4
    ) {
        const isFlippedX = top.x1 > top.x2;
        const isFlippedY = top.y1 > top.y2;
        const outOfBoundsStart = top.x1 !== bottom.x1 && top.y1 !== bottom.y1;
        const outOfBoundsEnd = top.x2 !== bottom.x2 && top.y2 !== bottom.y2;

        const points = Vec2.from(top);

        if (datum.extendEnd && outOfBoundsEnd) {
            points.push(Vec2.from(isFlippedX ? bounds.x1 : bounds.x2, isFlippedY ? bounds.y1 : bounds.y2));
        }

        points.push(...Vec2.from(bottom).reverse());

        if (datum.extendStart && outOfBoundsStart) {
            points.push(Vec2.from(isFlippedX ? bounds.x2 : bounds.x1, isFlippedY ? bounds.y2 : bounds.y1));
        }

        return points;
    }
}
