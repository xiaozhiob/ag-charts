import type { Point } from '../../../scene/point';
import { solveBezier, splitBezier } from '../../../scene/util/bezier';

export type LinearSpan = {
    type: 'linear';
    moveTo: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
};

export type CubicSpan = {
    type: 'cubic';
    moveTo: boolean;
    cp0x: number;
    cp0y: number;
    cp1x: number;
    cp1y: number;
    cp2x: number;
    cp2y: number;
    cp3x: number;
    cp3y: number;
};

export type StepSpan = {
    type: 'step';
    moveTo: boolean;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    stepX: number;
};

export type Span = LinearSpan | CubicSpan | StepSpan;

export function spanRange(span: Span): [Point, Point] {
    switch (span.type) {
        case 'linear':
        case 'step':
            return [
                { x: span.x0, y: span.y0 },
                { x: span.x1, y: span.y1 },
            ];
        case 'cubic':
            return [
                { x: span.cp0x, y: span.cp0y },
                { x: span.cp3x, y: span.cp3y },
            ];
    }
}

function spanRangeNormalized(span: Span): [Point, Point] {
    const range = spanRange(span);
    if (range[0].x > range[1].x) {
        range.reverse();
    }
    return range;
}

export function collapseSpanToPoint(span: Span, point: Point): Span {
    const { x, y } = point;
    switch (span.type) {
        case 'linear':
            return {
                type: 'linear',
                moveTo: span.moveTo,
                x0: x,
                y0: y,
                x1: x,
                y1: y,
            };
        case 'step':
            return {
                type: 'step',
                moveTo: span.moveTo,
                x0: x,
                y0: y,
                x1: x,
                y1: y,
                stepX: x,
            };
        case 'cubic':
            return {
                type: 'cubic',
                moveTo: span.moveTo,
                cp0x: x,
                cp0y: y,
                cp1x: x,
                cp1y: y,
                cp2x: x,
                cp2y: y,
                cp3x: x,
                cp3y: y,
            };
    }
}

export function rescaleSpan(span: Span, nextStart: Point, nextEnd: Point): Span {
    const [prevStart, prevEnd] = spanRange(span);
    const widthScale = prevEnd.x !== prevStart.x ? (nextEnd.x - nextStart.x) / (prevEnd.x - prevStart.x) : 0;
    const heightScale = prevEnd.y !== prevStart.y ? (nextEnd.y - nextStart.y) / (prevEnd.y - prevStart.y) : 0;

    switch (span.type) {
        case 'linear':
            return {
                type: 'linear',
                moveTo: span.moveTo,
                x0: nextStart.x,
                y0: nextStart.y,
                x1: nextEnd.x,
                y1: nextEnd.y,
            };
        case 'cubic':
            return {
                type: 'cubic',
                moveTo: span.moveTo,
                cp0x: nextStart.x,
                cp0y: nextStart.y,
                cp1x: nextEnd.x - (span.cp2x - prevStart.x) * widthScale,
                cp1y: nextEnd.y - (span.cp2y - prevStart.y) * heightScale,
                cp2x: nextEnd.x - (span.cp1x - prevStart.x) * widthScale,
                cp2y: nextEnd.y - (span.cp1y - prevStart.y) * heightScale,
                cp3x: nextEnd.x,
                cp3y: nextEnd.y,
            };
        case 'step':
            return {
                type: 'step',
                moveTo: span.moveTo,
                x0: nextStart.x,
                y0: nextStart.y,
                x1: nextEnd.x,
                y1: nextEnd.y,
                stepX: nextEnd.x - (span.stepX - prevStart.x) * widthScale,
            };
    }
}

export function clipSpanX(span: Span, x0: number, x1: number): Span {
    const { moveTo } = span;
    const [start, end] = spanRangeNormalized(span);
    const { x: spanX0, y: spanY0 } = start;
    const { x: spanX1, y: spanY1 } = end;

    if (x1 < spanX0) {
        return rescaleSpan(span, start, start);
    } else if (x0 > spanX1) {
        return rescaleSpan(span, end, end);
    }

    switch (span.type) {
        case 'linear': {
            const m = spanY0 === spanY1 ? undefined : (spanY1 - spanY0) / (spanX1 - spanX0);
            const y0 = m == null ? spanY0 : m * (x0 - spanX0) + spanY0;
            const y1 = m == null ? spanY0 : m * (x1 - spanX0) + spanY0;
            return { type: 'linear', moveTo, x0, y0, x1, y1 };
        }
        case 'step':
            if (x1 <= span.stepX) {
                const y = span.y0;
                return { type: 'step', moveTo, x0, y0: y, x1, y1: y, stepX: x1 };
            } else if (x0 >= span.stepX) {
                const y = span.y1;
                return { type: 'step', moveTo, x0, y0: y, x1, y1: y, stepX: x0 };
            } else {
                const { y0, y1, stepX } = span;
                return { type: 'step', moveTo, x0, y0, x1, y1, stepX };
            }
        case 'cubic': {
            const t0 = solveBezier(span.cp0x, span.cp1x, span.cp2x, span.cp3x, x0);
            let [_unused, bezier] = splitBezier(
                span.cp0x,
                span.cp0y,
                span.cp1x,
                span.cp1y,
                span.cp2x,
                span.cp2y,
                span.cp3x,
                span.cp3y,
                t0
            );
            const t1 = solveBezier(bezier[0].x, bezier[1].x, bezier[2].x, bezier[3].x, x1);
            [bezier, _unused] = splitBezier(
                bezier[0].x,
                bezier[0].y,
                bezier[1].x,
                bezier[1].y,
                bezier[2].x,
                bezier[2].y,
                bezier[3].x,
                bezier[3].y,
                t1
            );
            return {
                type: 'cubic',
                moveTo,
                cp0x: bezier[0].x,
                cp0y: bezier[0].y,
                cp1x: bezier[1].x,
                cp1y: bezier[1].y,
                cp2x: bezier[2].x,
                cp2y: bezier[2].y,
                cp3x: bezier[3].x,
                cp3y: bezier[3].y,
            };
        }
    }
}

export enum SpanJoin {
    MoveTo,
    LineTo,
}

export function linearPoints(points: Iterable<Point>): Span[] {
    const spans: Span[] = [];
    let i = 0;
    let x0 = NaN;
    let y0 = NaN;
    for (const { x: x1, y: y1 } of points) {
        if (i > 0) {
            const moveTo = i === 1;
            spans.push({ type: 'linear', moveTo, x0, y0, x1, y1 });
        }
        i += 1;
        x0 = x1;
        y0 = y1;
    }
    return spans;
}

const lineSteps = {
    start: 0,
    middle: 0.5,
    end: 1,
};

export function stepPoints(points: Iterable<Point>, position: number | keyof typeof lineSteps): Span[] {
    const spans: Span[] = [];
    let i = 0;
    let x0 = NaN;
    let y0 = NaN;
    const p0 = typeof position === 'number' ? position : lineSteps[position];
    for (const { x: x1, y: y1 } of points) {
        if (i > 0) {
            const moveTo = i === 1;
            const stepX = x0 + (x1 - x0) * p0;
            spans.push({ type: 'step', moveTo, x0, y0, x1, y1, stepX });
        }
        i += 1;
        x0 = x1;
        y0 = y1;
    }
    return spans;
}

const flatnessRatio = 0.05;
export function smoothPoints(iPoints: Iterable<Point>, tension: number): Span[] {
    const points = Array.isArray(iPoints) ? iPoints : Array.from(iPoints);
    if (points.length <= 1) return [];

    const gradients = points.map((c, i) => {
        const p = i === 0 ? c : points[i - 1];
        const n = i === points.length - 1 ? c : points[i + 1];
        const isTerminalPoint = i === 0 || i === points.length - 1;

        if (Math.sign(p.y - c.y) === Math.sign(n.y - c.y)) {
            // Local maxima/minima
            return 0;
        }

        if (!isTerminalPoint) {
            // Point is very close to either the previous point or next point
            const range = Math.abs(p.y - n.y);
            const prevRatio = Math.abs(c.y - p.y) / range;
            const nextRatio = Math.abs(c.y - n.y) / range;

            if (
                prevRatio <= flatnessRatio ||
                1 - prevRatio <= flatnessRatio ||
                nextRatio <= flatnessRatio ||
                1 - nextRatio <= flatnessRatio
            ) {
                return 0;
            }
        }

        return (n.y - p.y) / (n.x - p.x);
    });

    // If the start/end point are adjacent to a flat point,
    // Increase the gradient so the line is convex
    if (gradients[1] === 0) {
        gradients[0] *= 2;
    }
    if (gradients[gradients.length - 2] === 0) {
        gradients[gradients.length - 1] *= 2;
    }

    const spans: Span[] = [];
    for (let i = 1; i < points.length; i += 1) {
        const prev = points[i - 1];
        const prevM = gradients[i - 1];
        const cur = points[i];
        const curM = gradients[i];

        const dx = cur.x - prev.x;
        const dy = cur.y - prev.y;

        let dcp1x = (dx * tension) / 3;
        let dcp1y = (dx * prevM * tension) / 3;
        let dcp2x = (dx * tension) / 3;
        let dcp2y = (dx * curM * tension) / 3;

        // Ensure the control points do not exceed the y value of a flat point
        if (curM === 0 && Math.abs(dcp1y) > Math.abs(dy)) {
            dcp1x *= Math.abs(dy / dcp1y);
            dcp1y = Math.sign(dcp1y) * Math.abs(dy);
        }
        if (prevM === 0 && Math.abs(dcp2y) > Math.abs(dy)) {
            dcp2x *= Math.abs(dy / dcp2y);
            dcp2y = Math.sign(dcp2y) * Math.abs(dy);
        }

        spans.push({
            type: 'cubic',
            moveTo: i === 1,
            cp0x: prev.x,
            cp0y: prev.y,
            cp1x: prev.x + dcp1x,
            cp1y: prev.y + dcp1y,
            cp2x: cur.x - dcp2x,
            cp2y: cur.y - dcp2y,
            cp3x: cur.x,
            cp3y: cur.y,
        });
    }

    return spans;
}
