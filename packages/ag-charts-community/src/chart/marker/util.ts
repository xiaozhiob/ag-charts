import { Circle } from './circle';
import { Cross } from './cross';
import { Diamond } from './diamond';
import { Heart } from './heart';
import { Marker } from './marker';
import { Pin } from './pin';
import { Plus } from './plus';
import { Square } from './square';
import { Star } from './star';
import { Triangle } from './triangle';

export interface Path {
    readonly moveTo: (x: number, y: number) => void;
    readonly lineTo: (x: number, y: number) => void;
    readonly rect: (x: number, y: number, width: number, height: number) => void;
    readonly roundRect: (x: number, y: number, width: number, height: number, radii: number) => void;
    readonly arc: (x: number, y: number, r: number, sAngle: number, eAngle: number, counterClockwise?: boolean) => void;
    readonly cubicCurveTo: (cx1: number, cy1: number, cx2: number, cy2: number, x: number, y: number) => void;
    readonly closePath: () => void;
    readonly clear: (trackChanges?: boolean) => void;
}

export type MarkerShapeFnParams = {
    path: Path;
    x: number;
    y: number;
    size: number;
};

export type MarkerShapeFn = (params: MarkerShapeFnParams) => void;
type MarkerSupportedShapes = 'circle' | 'cross' | 'diamond' | 'heart' | 'plus' | 'pin' | 'square' | 'star' | 'triangle';
export type MarkerShape = MarkerShapeFn | MarkerSupportedShapes;
export type MarkerConstructor = typeof Marker;

const MARKER_SHAPES: { [K in MarkerSupportedShapes]: MarkerConstructor } = {
    circle: Circle,
    cross: Cross,
    diamond: Diamond,
    heart: Heart,
    pin: Pin,
    plus: Plus,
    square: Square,
    star: Star,
    triangle: Triangle,
};

const MARKER_SUPPORTED_SHAPES = Object.keys(MARKER_SHAPES);

export function isMarkerShape(shape: unknown): shape is MarkerSupportedShapes {
    return typeof shape === 'string' && MARKER_SUPPORTED_SHAPES.includes(shape);
}

function markerFactory(pathFn: MarkerShapeFn) {
    return class CustomMarker extends Marker {
        override updatePath() {
            const { path, x, y, size } = this;
            pathFn({ path, x, y, size });
        }
    };
}

// This function is in its own file because putting it into SeriesMarker makes the Legend
// suddenly aware of the series (it's an agnostic component), and putting it into Marker
// introduces circular dependencies.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
export function getMarker(shape: MarkerShape | MarkerShapeFn = 'square'): MarkerConstructor {
    if (isMarkerShape(shape)) {
        return MARKER_SHAPES[shape];
    }
    if (typeof shape === 'function') {
        return markerFactory(shape);
    }
    return Square;
}
