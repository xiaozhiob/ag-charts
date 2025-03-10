import { _ModuleSupport } from 'ag-charts-community';

import { type AnnotationContext, AnnotationType, type Bounds } from '../annotationTypes';
import { AnnotationScene } from '../scenes/annotationScene';
import { TextualStartEndScene } from '../scenes/textualStartEndScene';
import type { CalloutProperties } from './calloutProperties';

const { drawCorner, Path } = _ModuleSupport;

interface CalloutDimensions {
    tailPoint: {
        x: number;
        y: number;
    };
    bodyBounds: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
}

type PathType = 'corner' | 'side' | 'calloutCorner' | 'calloutSide';

export class CalloutScene extends TextualStartEndScene<CalloutProperties> {
    static override is(value: unknown): value is CalloutScene {
        return AnnotationScene.isCheck(value, AnnotationType.Callout);
    }

    type = AnnotationType.Callout;

    private readonly shape = new Path();

    constructor() {
        super();
        this.append([this.shape, this.label, this.start, this.end]);
    }

    override drag(
        datum: CalloutProperties,
        target: _ModuleSupport.Vec2,
        context: AnnotationContext,
        snapping: boolean
    ) {
        if (datum.locked) return;

        if (this.activeHandle === 'end') {
            this.dragHandle(datum, target, context, snapping);
        } else {
            this.dragAll(datum, target, context);
        }
    }

    protected override getLabelCoords(
        datum: CalloutProperties,
        bbox: _ModuleSupport.BBox,
        coords: _ModuleSupport.Vec4
    ): _ModuleSupport.Vec2 {
        const padding = datum.getPadding();
        const {
            bodyBounds = {
                x: 0,
                y: 0,
                width: 0,
                height: 0,
            },
        } = this.getDimensions(datum, bbox, coords) ?? {};

        return {
            x: bodyBounds.x + padding.left,
            y: bodyBounds.y - padding.bottom,
        };
    }

    protected override getHandleStyles(datum: CalloutProperties, handle: 'start' | 'end') {
        return handle === 'start'
            ? {
                  fill: datum.handle.fill,
                  stroke: datum.handle.stroke ?? datum.stroke,
                  strokeOpacity: datum.handle.strokeOpacity,
                  strokeWidth: datum.handle.strokeWidth,
              }
            : { fill: undefined, strokeWidth: 0 };
    }

    protected override updateAnchor(
        datum: CalloutProperties,
        coords: _ModuleSupport.Vec4,
        context: AnnotationContext,
        bbox: _ModuleSupport.BBox
    ) {
        const { bodyBounds } = this.getDimensions(datum, bbox, coords) ?? {};
        const bounds = bodyBounds ?? bbox;
        this.anchor = {
            x: bounds.x + context.seriesRect.x,
            y: bounds.y + context.seriesRect.y - bounds.height,
            position: this.anchor.position,
        };
    }

    protected override updateShape(
        datum: CalloutProperties,
        textBBox: _ModuleSupport.BBox,
        coords: _ModuleSupport.Vec4
    ) {
        const { shape } = this;

        // update shape styles
        shape.fill = datum.fill;
        shape.fillOpacity = datum.fillOpacity ?? 1;
        shape.stroke = datum.stroke;
        shape.strokeWidth = datum.strokeWidth ?? 1;
        shape.strokeOpacity = datum.strokeOpacity ?? 1;

        // update shape path

        const { tailPoint, bodyBounds } = this.getDimensions(datum, textBBox, coords) ?? {};
        if (!tailPoint || !bodyBounds) {
            return;
        }

        this.updatePath(tailPoint, bodyBounds);
    }

    private updatePath(tailPoint: _ModuleSupport.Vec2, bodyBounds: Bounds) {
        const { x: tailX, y: tailY } = tailPoint;
        const { x, y, width, height } = bodyBounds;

        const top = y - height;
        const right = x + width;

        const placement = this.calculateCalloutPlacement({ x: tailX, y: tailY }, bodyBounds);
        const cornerRadius = 8;

        const pathParams: { coordinates: _ModuleSupport.Corner; type: PathType }[] = [
            {
                coordinates: {
                    x0: x,
                    x1: x + cornerRadius,
                    y0: top + cornerRadius,
                    y1: top,
                    cx: placement === `topLeft` ? tailX : x + cornerRadius,
                    cy: placement === `topLeft` ? tailY : top + cornerRadius,
                },
                type: placement === `topLeft` ? 'calloutCorner' : 'corner',
            },
            {
                coordinates: {
                    x0: x + cornerRadius,
                    x1: right - cornerRadius,
                    y0: top,
                    y1: top,
                    cx: tailX,
                    cy: tailY,
                },
                type: placement === `top` ? 'calloutSide' : 'side',
            },
            {
                coordinates: {
                    x0: right - cornerRadius,
                    x1: right,
                    y0: top,
                    y1: top + cornerRadius,
                    cx: placement === `topRight` ? tailX : right - cornerRadius,
                    cy: placement === `topRight` ? tailY : top + cornerRadius,
                },
                type: placement === `topRight` ? 'calloutCorner' : 'corner',
            },
            {
                coordinates: {
                    x0: right,
                    x1: right,
                    y0: top + cornerRadius,
                    y1: y - cornerRadius,
                    cx: tailX,
                    cy: tailY,
                },
                type: placement === `right` ? 'calloutSide' : 'side',
            },
            {
                coordinates: {
                    x0: right,
                    x1: right - cornerRadius,
                    y0: y - cornerRadius,
                    y1: y,
                    cx: placement === `bottomRight` ? tailX : right - cornerRadius,
                    cy: placement === `bottomRight` ? tailY : y - cornerRadius,
                },
                type: placement === `bottomRight` ? 'calloutCorner' : 'corner',
            },
            {
                coordinates: {
                    x0: right - cornerRadius,
                    x1: x + cornerRadius,
                    y0: y,
                    y1: y,
                    cx: tailX,
                    cy: tailY,
                },
                type: placement === `bottom` ? 'calloutSide' : 'side',
            },
            {
                coordinates: {
                    x0: x + cornerRadius,
                    x1: x,
                    y0: y,
                    y1: y - cornerRadius,
                    cx: placement === `bottomLeft` ? tailX : x + cornerRadius,
                    cy: placement === `bottomLeft` ? tailY : y - cornerRadius,
                },
                type: placement === `bottomLeft` ? 'calloutCorner' : 'corner',
            },
            {
                coordinates: {
                    x0: x,
                    x1: x,
                    y0: y - cornerRadius,
                    y1: top + cornerRadius,
                    cx: tailX,
                    cy: tailY,
                },
                type: placement === `left` ? 'calloutSide' : 'side',
            },
        ];

        const { path } = this.shape;
        path.clear();
        path.moveTo(x, top + cornerRadius);

        pathParams.forEach(({ coordinates, type }) => {
            this.drawPath(path, coordinates, cornerRadius, type);
        });

        path.closePath();
    }

    drawPath(
        path: _ModuleSupport.ExtendedPath2D,
        { x0, y0, x1, y1, cx, cy }: _ModuleSupport.Corner,
        cornerRadius: number,
        type: PathType
    ) {
        const sideTailRadius = 6;

        switch (type) {
            case 'calloutCorner': {
                path.lineTo(cx, cy);
                path.lineTo(x1, y1);
                break;
            }
            case 'corner': {
                drawCorner(
                    path,
                    {
                        x0,
                        x1,
                        y0,
                        y1,
                        cx,
                        cy,
                    },
                    cornerRadius,
                    false
                );
                break;
            }
            case 'calloutSide': {
                if (x0 !== x1) {
                    const direction = x0 > x1 ? -1 : 1;
                    const midX = Math.min(x0, x1) + Math.abs(x1 - x0) / 2;

                    path.lineTo(midX - sideTailRadius * direction, y0);
                    path.lineTo(cx, cy);
                    path.lineTo(midX + sideTailRadius * direction, y0);
                    path.lineTo(x1, y1);
                } else {
                    const direction = y0 > y1 ? -1 : 1;
                    const midY = Math.min(y0, y1) + Math.abs(y0 - y1) / 2;

                    path.lineTo(x0, midY - sideTailRadius * direction);
                    path.lineTo(cx, cy);
                    path.lineTo(x0, midY + sideTailRadius * direction);
                    path.lineTo(x1, y1);
                }
                break;
            }
            case 'side':
            default: {
                path.lineTo(x1, y1);
                break;
            }
        }
    }

    private calculateCalloutPlacement(
        anchorPoint: _ModuleSupport.Vec2,
        bounds: { x: number; y: number; width: number; height: number }
    ) {
        // bounds x and y are bottom left corner
        const right = bounds.x + bounds.width;
        const top = bounds.y - bounds.height;

        let xPlacement;
        let yPlacement;

        if (anchorPoint.x > right) {
            xPlacement = 'right';
        } else if (anchorPoint.x < bounds.x) {
            xPlacement = 'left';
        }

        if (anchorPoint.y > bounds.y) {
            yPlacement = 'bottom';
        } else if (anchorPoint.y < top) {
            yPlacement = 'top';
        }

        if (xPlacement && yPlacement) {
            return `${yPlacement}${xPlacement[0].toUpperCase()}${xPlacement.substring(1)}`;
        } else {
            return yPlacement ?? xPlacement;
        }
    }

    public getDimensions(
        datum: CalloutProperties,
        textBBox: _ModuleSupport.BBox,
        coords: _ModuleSupport.Vec4
    ): CalloutDimensions | undefined {
        const { fontSize } = datum;
        const padding = datum.getPadding();

        const horizontalPadding = padding.left + padding.right;
        const verticalPadding = padding.top + padding.bottom;

        const width = textBBox.width + horizontalPadding;
        const height = Math.max(textBBox.height + verticalPadding, fontSize + verticalPadding);

        return {
            tailPoint: {
                x: coords.x1,
                y: coords.y1,
            },
            bodyBounds: {
                x: textBBox.x,
                y: textBBox.y,
                width,
                height,
            },
        };
    }

    override containsPoint(x: number, y: number) {
        const { start, end, shape } = this;

        this.activeHandle = undefined;

        if (start.containsPoint(x, y)) {
            this.activeHandle = 'start';
            return true;
        }

        const bodyContainsPoint = end.containsPoint(x, y) || shape.containsPoint(x, y);
        if (bodyContainsPoint) {
            this.activeHandle = 'end';
        }

        return bodyContainsPoint;
    }
}
