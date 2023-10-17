import { ChangeDetectable, RedrawType, SceneChangeDetection } from '../../scene/changeDetectable';
import { BOOLEAN, NUMBER, OPT_COLOR_STRING, OPT_NUMBER, Validate, predicateWithMessage } from '../../util/validation';
import { Circle } from '../marker/circle';
import { Marker } from '../marker/marker';
import type { MarkerShape } from '../marker/util';
import { isMarkerShape } from '../marker/util';

const MARKER_SHAPE = predicateWithMessage(
    (v: any) => isMarkerShape(v) || Object.getPrototypeOf(v) === Marker,
    `expecting a marker shape keyword such as 'circle', 'diamond' or 'square' or an object extending the Marker class`
);

export class SeriesMarker extends ChangeDetectable {
    @Validate(BOOLEAN)
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    enabled = true;

    /** One of the predefined marker names, or a marker constructor function (for user-defined markers). */
    @Validate(MARKER_SHAPE)
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    shape: MarkerShape = Circle;

    @Validate(NUMBER(0))
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    size: number = 6;

    @Validate(OPT_COLOR_STRING)
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    fill?: string;

    @Validate(OPT_NUMBER(0, 1))
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    fillOpacity: number = 1;

    @Validate(OPT_COLOR_STRING)
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    stroke?: string;

    @Validate(OPT_NUMBER(0))
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    strokeWidth: number = 1;

    @Validate(OPT_NUMBER(0, 1))
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    strokeOpacity: number = 1;
}
