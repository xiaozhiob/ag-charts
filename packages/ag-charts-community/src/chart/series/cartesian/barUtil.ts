import type { AgBarSeriesItemStylerParams, AgBarSeriesStyle, Styler } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import type { FromToMotionPropFn, NodeUpdateState } from '../../../motion/fromToMotion';
import { NODE_UPDATE_STATE_TO_PHASE_MAPPING } from '../../../motion/fromToMotion';
import { ContinuousScale } from '../../../scale/continuousScale';
import type { Scale } from '../../../scale/scale';
import { BBox } from '../../../scene/bbox';
import type { DropShadow } from '../../../scene/dropShadow';
import type { Group } from '../../../scene/group';
import type { Rect } from '../../../scene/shape/rect';
import { Transformable } from '../../../scene/transformable';
import { isNegative } from '../../../util/number';
import { mergeDefaults } from '../../../util/object';
import type { ChartAxis } from '../../chartAxis';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { createDatumId } from '../../data/processors';
import type { Series } from '../series';
import type { SeriesItemHighlightStyle } from '../seriesProperties';
import type { CartesianSeriesNodeDatum } from './cartesianSeries';

export type RectConfig = {
    fill: string;
    stroke: string;
    strokeWidth: number;
    fillOpacity: number;
    strokeOpacity: number;
    lineDashOffset: number;
    lineDash?: number[];
    fillShadow?: DropShadow;
    cornerRadius?: number;
    topLeftCornerRadius?: boolean;
    topRightCornerRadius?: boolean;
    bottomRightCornerRadius?: boolean;
    bottomLeftCornerRadius?: boolean;
    crisp?: boolean;
    visible?: boolean;
};

export function updateRect(rect: Rect, config: RectConfig) {
    rect.crisp = config.crisp ?? true;
    rect.fill = config.fill;
    rect.stroke = config.stroke;
    rect.strokeWidth = config.strokeWidth;
    rect.fillOpacity = config.fillOpacity;
    rect.strokeOpacity = config.strokeOpacity;
    rect.lineDash = config.lineDash;
    rect.lineDashOffset = config.lineDashOffset;
    rect.fillShadow = config.fillShadow;
    rect.topLeftCornerRadius = config.topLeftCornerRadius !== false ? config.cornerRadius ?? 0 : 0;
    rect.topRightCornerRadius = config.topRightCornerRadius !== false ? config.cornerRadius ?? 0 : 0;
    rect.bottomRightCornerRadius = config.bottomRightCornerRadius !== false ? config.cornerRadius ?? 0 : 0;
    rect.bottomLeftCornerRadius = config.bottomLeftCornerRadius !== false ? config.cornerRadius ?? 0 : 0;
    rect.visible = config.visible ?? true;
}

interface NodeDatum extends Omit<CartesianSeriesNodeDatum, 'yKey' | 'yValue'> {}

export function getRectConfig<
    Params extends Omit<AgBarSeriesItemStylerParams<any>, 'yKey'>,
    ExtraParams extends object,
>(
    series: Series<any, any, any>,
    id: string,
    {
        datum,
        isHighlighted,
        style,
        highlightStyle,
        itemStyler,
        seriesId,
        ...opts
    }: {
        datum: NodeDatum;
        isHighlighted: boolean;
        style: RectConfig;
        highlightStyle: SeriesItemHighlightStyle;
        itemStyler?: Styler<Params & ExtraParams, AgBarSeriesStyle>;
        seriesId: string;
        ctx: ModuleContext;
    } & ExtraParams
): RectConfig {
    const {
        fill,
        fillOpacity,
        stroke,
        strokeWidth,
        strokeOpacity,
        lineDash,
        lineDashOffset,
        cornerRadius = 0,
    } = mergeDefaults(isHighlighted && highlightStyle, style);

    let format: AgBarSeriesStyle | undefined;
    if (itemStyler) {
        format = series.cachedDatumCallback(createDatumId(id, isHighlighted ? 'highlight' : 'node'), () =>
            (itemStyler as any)({
                datum: datum.datum,
                xKey: datum.xKey,
                fill,
                fillOpacity,
                stroke,
                strokeWidth,
                strokeOpacity,
                lineDash,
                lineDashOffset,
                cornerRadius,
                highlighted: isHighlighted,
                seriesId,
                ...opts,
            })
        );
    }

    return {
        fill: format?.fill ?? fill,
        fillOpacity: format?.fillOpacity ?? fillOpacity,
        stroke: format?.stroke ?? stroke,
        strokeWidth: format?.strokeWidth ?? strokeWidth,
        strokeOpacity: format?.strokeOpacity ?? strokeOpacity,
        lineDash: format?.lineDash ?? lineDash,
        lineDashOffset: format?.lineDashOffset ?? lineDashOffset,
        cornerRadius: format?.cornerRadius ?? cornerRadius,
        topLeftCornerRadius: style.topLeftCornerRadius,
        topRightCornerRadius: style.topRightCornerRadius,
        bottomRightCornerRadius: style.bottomRightCornerRadius,
        bottomLeftCornerRadius: style.bottomLeftCornerRadius,
        fillShadow: style.fillShadow,
    };
}

export function checkCrisp(
    scale: Scale<any, any> | undefined,
    visibleRange: number[] | undefined,
    smallestDataInterval: number | undefined,
    largestDataInterval: number | undefined
): boolean {
    if (visibleRange != null) {
        const [visibleMin, visibleMax] = visibleRange;
        const isZoomed = visibleMin !== 0 || visibleMax !== 1;
        if (isZoomed) return false;
    }

    if (ContinuousScale.is(scale)) {
        const spacing = scale.calcBandwidth(largestDataInterval) - scale.calcBandwidth(smallestDataInterval);
        if (spacing > 0 && spacing < 1) return false;
    }

    return true;
}

const isDatumNegative = (datum: AnimatableBarDatum) => {
    return isNegative((datum as any).yValue ?? 0);
};

export type InitialPosition<T> = {
    isVertical: boolean;
    mode: 'normal' | 'fade';
    calculate: (datum: T, prevDatum?: T) => T;
};
export function collapsedStartingBarPosition(
    isVertical: boolean,
    axes: Record<ChartAxisDirection, ChartAxis | undefined>,
    mode: 'normal' | 'fade'
): InitialPosition<AnimatableBarDatum> {
    const { startingX, startingY } = getStartingValues(isVertical, axes);

    const calculate = (datum: AnimatableBarDatum, prevDatum?: AnimatableBarDatum) => {
        let x = isVertical ? datum.x : startingX;
        let y = isVertical ? startingY : datum.y;
        let width = isVertical ? datum.width : 0;
        let height = isVertical ? 0 : datum.height;
        const { opacity } = datum;

        if (prevDatum && (isNaN(x) || isNaN(y))) {
            // Fallback
            ({ x, y } = prevDatum);
            width = isVertical ? prevDatum.width : 0;
            height = isVertical ? 0 : prevDatum.height;
            if (isVertical && !isDatumNegative(prevDatum)) {
                y += prevDatum.height;
            } else if (!isVertical && isDatumNegative(prevDatum)) {
                x += prevDatum.width;
            }
        }

        let clipBBox: BBox | undefined;
        if (datum.clipBBox == null) {
            clipBBox = undefined;
        } else if (isDatumNegative(datum)) {
            clipBBox = isVertical ? new BBox(x, y - height, width, height) : new BBox(x - width, y, width, height);
        } else {
            clipBBox = new BBox(x, y, width, height);
        }

        return { x, y, width, height, clipBBox, opacity };
    };

    return { isVertical, calculate, mode };
}

export function midpointStartingBarPosition(
    isVertical: boolean,
    mode: 'normal' | 'fade'
): InitialPosition<AnimatableBarDatum> {
    return {
        isVertical,
        calculate: (datum) => {
            return {
                x: isVertical ? datum.x : datum.x + datum.width / 2,
                y: isVertical ? datum.y + datum.height / 2 : datum.y,
                width: isVertical ? datum.width : 0,
                height: isVertical ? 0 : datum.height,
                clipBBox: datum.clipBBox,
                opacity: datum.opacity,
            };
        },
        mode,
    };
}

type AnimatableBarDatum = {
    x: number;
    y: number;
    height: number;
    width: number;
    clipBBox?: BBox;
    opacity?: number;
};
export function prepareBarAnimationFunctions<T extends AnimatableBarDatum>(initPos: InitialPosition<T>) {
    const isRemoved = (datum?: T) => datum == null || isNaN(datum.x) || isNaN(datum.y);

    const fromFn: FromToMotionPropFn<Rect, AnimatableBarDatum, T> = (rect: Rect, datum: T, status: NodeUpdateState) => {
        if (status === 'updated' && isRemoved(datum)) {
            status = 'removed';
        } else if (status === 'updated' && isRemoved(rect.previousDatum)) {
            status = 'added';
        }

        // Continue from current rendering location.
        let source: AnimatableBarDatum;
        if (status === 'added' && rect.previousDatum == null && initPos.mode === 'fade') {
            // Handle series add case, after initial load. This is distinct from legend toggle on.
            source = { ...resetBarSelectionsFn(rect, datum), opacity: 0 };
        } else if (status === 'unknown' || status === 'added') {
            source = initPos.calculate(datum, rect.previousDatum);
        } else {
            source = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                clipBBox: rect.clipBBox,
                opacity: rect.opacity,
            };
        }

        const phase = NODE_UPDATE_STATE_TO_PHASE_MAPPING[status];
        return { ...source, phase };
    };
    const toFn: FromToMotionPropFn<Rect, AnimatableBarDatum, T> = (rect: Rect, datum: T, status: NodeUpdateState) => {
        let source: AnimatableBarDatum;
        if (status === 'removed' && rect.datum == null && initPos.mode === 'fade') {
            // Handle series remove case, after initial load. This is distinct from legend toggle off.
            source = { ...resetBarSelectionsFn(rect, datum), opacity: 0 };
        } else if (status === 'removed' || isRemoved(datum)) {
            source = initPos.calculate(datum, rect.previousDatum);
        } else {
            source = {
                x: datum.x,
                y: datum.y,
                width: datum.width,
                height: datum.height,
                clipBBox: datum.clipBBox,
                opacity: datum.opacity,
            };
        }

        return source;
    };

    return { toFn, fromFn };
}

function getStartingValues(isVertical: boolean, axes: Record<ChartAxisDirection, ChartAxis | undefined>) {
    const axis = axes[isVertical ? ChartAxisDirection.Y : ChartAxisDirection.X];

    let startingX = Infinity;
    let startingY = 0;

    if (!axis) {
        return { startingX, startingY };
    }

    if (isVertical) {
        startingY = axis.scale.convert(ContinuousScale.is(axis.scale) ? 0 : Math.max(...axis.range));
    } else {
        startingX = axis.scale.convert(ContinuousScale.is(axis.scale) ? 0 : Math.min(...axis.range));
    }

    return { startingX, startingY };
}

export function resetBarSelectionsFn(_node: Rect, { x, y, width, height, clipBBox, opacity }: AnimatableBarDatum) {
    return { x, y, width, height, clipBBox, opacity };
}

export function computeBarFocusBounds(
    datum: { x: number; y: number; width: number; height: number } | undefined,
    barGroup: Group,
    seriesRect: BBox | undefined
): BBox | undefined {
    if (datum === undefined) return undefined;

    const { x, y, width, height } = datum;
    return Transformable.toCanvas(barGroup, new BBox(x, y, width, height)).clip(seriesRect);
}
