import { transformIntegratedCategoryValue } from '../../../util/value';
import type { CartesianSeriesNodeDataContext } from './cartesianSeries';
import { type Span, clipSpanX, collapseSpanToPoint, rescaleSpan, spanRange } from './lineInterpolation';
import type { Scaling } from './scaling';

type AxisValue = string | number;

export interface SpanDatum {
    span: Span;
    xValue0: any;
    yValue0: any;
    xValue1: any;
    yValue1: any;
}

export interface SpanContext {
    scales: CartesianSeriesNodeDataContext['scales'];
    data: SpanDatum[];
    zeroData?: SpanDatum[];
}

interface AxisContext {
    axisValues: any[];
    oldDataAxisIndices: SpanIndices[];
    newDataAxisIndices: SpanIndices[];
}

export interface SpanInterpolation {
    from: Span;
    to: Span;
}

export interface SpanInterpolationResult {
    removed: SpanInterpolation[];
    moved: SpanInterpolation[];
    added: SpanInterpolation[];
}

interface SpanIndices {
    xValue0Index: number;
    xValue1Index: number;
    datumIndex: number;
}

export enum CollapseMode {
    Zero,
    Split,
}

function integratedCategoryMatch(a: unknown, b: unknown) {
    if (a == null || b == null) return false;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    if ('id' in a && 'id' in b) {
        return a.id === b.id;
    }

    return a.toString() === b.toString();
}

export function scale(val: number | string | Date, scaling?: Scaling) {
    if (!scaling) return NaN;

    if (val instanceof Date) {
        val = val.getTime();
    }
    if (scaling.type === 'continuous' && typeof val === 'number') {
        const domainRatio = (val - scaling.domain[0]) / (scaling.domain[1] - scaling.domain[0]);
        return domainRatio * (scaling.range[1] - scaling.range[0]) + scaling.range[0];
    }
    if (scaling.type === 'log' && typeof val === 'number') {
        return scaling.convert(val);
    }

    // Category axis case.
    const matchingIndex = scaling.domain.findIndex((d) => d === val);
    if (matchingIndex >= 0) {
        return scaling.range[matchingIndex];
    }

    // Integrated Charts category case.
    const matchingIntegratedIndex = scaling.domain.findIndex((d) => integratedCategoryMatch(val, d));
    if (matchingIntegratedIndex >= 0) {
        return scaling.range[matchingIntegratedIndex];
    }

    // We failed to convert using the scale.
    return NaN;
}

interface ValueEntry {
    axisValue: AxisValue;
    value: any;
}

function toAxisValue(value: any) {
    return transformIntegratedCategoryValue(value).valueOf();
}

function getAxisIndices({ data }: SpanContext, values: any[]): SpanIndices[] {
    return data.map((datum, datumIndex) => ({
        xValue0Index: values.indexOf(toAxisValue(datum.xValue0)),
        xValue1Index: values.indexOf(toAxisValue(datum.xValue1)),
        datumIndex,
    }));
}

function validateCategorySorting(newData: SpanContext, oldData: SpanContext) {
    const oldScale = oldData.scales.x;
    const newScale = newData.scales.x;

    if (oldScale?.type !== 'category' || newScale?.type !== 'category') return true;

    let x0 = -Infinity;
    for (const oldValue of oldScale.domain) {
        const x = scale(oldValue, newScale);
        if (!Number.isFinite(x)) {
            continue;
        } else if (x < x0) {
            // Unsorted
            return false;
        } else {
            x0 = x;
        }
    }

    return true;
}

function validateAxisEntriesOrder(axisValues: ValueEntry[], data: SpanContext) {
    let x0 = -Infinity;
    for (const axisValue of axisValues) {
        const x = scale(axisValue.value, data.scales.x);
        if (!Number.isFinite(x)) {
            continue;
        } else if (x < x0) {
            // Unsorted
            return false;
        } else {
            x0 = x;
        }
    }

    return true;
}

function spanAxisContext(newData: SpanContext, oldData: SpanContext): AxisContext | undefined {
    // Old and new axis values might not be directly comparable
    // Array.sort does not handle this case
    const allAxisEntries = new Map<AxisValue, any>();
    for (const { xValue0, xValue1 } of newData.data) {
        const xValue0Value = toAxisValue(xValue0);
        const xValue1Value = toAxisValue(xValue1);
        allAxisEntries.set(xValue0Value, xValue0).set(xValue1Value, xValue1);
    }

    const newAxisEntries = Array.from(allAxisEntries, ([axisValue, value]): ValueEntry => ({ axisValue, value }));
    newAxisEntries.sort((a, b) => {
        return scale(a.value, newData.scales.x) - scale(b.value, newData.scales.x);
    });

    const exclusivelyOldAxisEntries: ValueEntry[] = [];
    for (const { xValue0, xValue1 } of oldData.data) {
        const xValue0Value = toAxisValue(xValue0);
        const xValue1Value = toAxisValue(xValue1);
        if (!allAxisEntries.has(xValue0Value)) {
            allAxisEntries.set(xValue0Value, xValue0);
            exclusivelyOldAxisEntries.push({ axisValue: xValue0Value, value: xValue0 });
        }
        if (!allAxisEntries.has(xValue1Value)) {
            allAxisEntries.set(xValue1Value, xValue1);
            exclusivelyOldAxisEntries.push({ axisValue: xValue1Value, value: xValue1 });
        }
    }

    exclusivelyOldAxisEntries.sort((a, b) => {
        return scale(a.value, oldData.scales.x) - scale(b.value, oldData.scales.x);
    });

    const axisEntries = newAxisEntries;
    let insertionIndex = 0;
    for (const oldAxisEntries of exclusivelyOldAxisEntries) {
        for (let i = axisEntries.length - 1; i > insertionIndex; i -= 1) {
            const oldValueX = scale(oldAxisEntries.value, oldData.scales.x);
            const newValueX = scale(axisEntries[i].value, oldData.scales.x);
            if (oldValueX > newValueX) {
                insertionIndex = i + 1;
                break;
            }
        }

        axisEntries.splice(insertionIndex, 0, oldAxisEntries);
        insertionIndex += 1;
    }

    if (!validateAxisEntriesOrder(axisEntries, oldData)) return;

    const axisValues = axisEntries.map((axisEntry) => axisEntry.axisValue);
    const oldDataAxisIndices = getAxisIndices(oldData, axisValues);
    const newDataAxisIndices = getAxisIndices(newData, axisValues);

    return { axisValues, oldDataAxisIndices, newDataAxisIndices };
}

function clipSpan(span: Span, xValue0Index: number, xIndices: SpanIndices): Span {
    if (xIndices.xValue1Index === xIndices.xValue0Index + 1) return span;

    const range = spanRange(span);
    const step = (range[1].x - range[0].x) / (xIndices.xValue1Index - xIndices.xValue0Index);
    const start = range[0].x + (xValue0Index - xIndices.xValue0Index) * step;
    const end = start + step;
    return clipSpanX(span, start, end);
}

function axisZeroSpan(span: Span, data: SpanContext) {
    const [r0, r1] = spanRange(span);
    const y0 = scale(0, data.scales.y);
    return rescaleSpan(span, { x: r0.x, y: y0 }, { x: r1.x, y: y0 });
}

function collapseSpanToMidpoint(span: Span) {
    const [r0, r1] = spanRange(span);
    return collapseSpanToPoint(span, {
        x: (r0.x + r1.x) / 2,
        y: (r0.y + r1.y) / 2,
    });
}

function collapseSpan(
    span: Span,
    collapseMode: CollapseMode,
    data: SpanContext,
    axisIndices: SpanIndices[],
    indices: SpanIndices,
    range: Pick<SpanIndices, 'xValue0Index' | 'xValue1Index'>
) {
    let xValue: any;
    let yValue: any;

    if (indices.xValue0Index >= range.xValue1Index) {
        const datumIndex = axisIndices.findLast((i) => i.xValue1Index <= range.xValue1Index)?.datumIndex;
        const datum = datumIndex != null ? data.data[datumIndex] : undefined;
        xValue = datum?.xValue1;
        yValue = datum?.yValue1;
    } else if (indices.xValue0Index <= range.xValue0Index) {
        const datumIndex = axisIndices.find((i) => i.xValue0Index >= range.xValue0Index)?.datumIndex;
        const datum = datumIndex != null ? data.data[datumIndex] : undefined;
        xValue = datum?.xValue0;
        yValue = datum?.yValue0;
    }

    if (xValue == null || yValue == null) {
        switch (collapseMode) {
            case CollapseMode.Zero:
                return axisZeroSpan(span, data);
            case CollapseMode.Split:
                return collapseSpanToMidpoint(span);
        }
    }

    const x = scale(xValue, data.scales.x);
    const y = scale(yValue, data.scales.y);
    const point = { x, y };

    return rescaleSpan(span, point, point);
}

function zeroDataSpan(spanDatum: SpanDatum, zeroData: SpanDatum[] | undefined) {
    if (zeroData == null) return;

    const newSpanXValue0 = toAxisValue(spanDatum.xValue0);
    const newSpanXValue1 = toAxisValue(spanDatum.xValue1);
    return zeroData.find(
        (zeroSpanDatum) =>
            toAxisValue(zeroSpanDatum.xValue0) === newSpanXValue0 &&
            toAxisValue(zeroSpanDatum.xValue1) === newSpanXValue1
    )?.span;
}

function addSpan(
    newData: SpanContext,
    collapseMode: CollapseMode,
    newAxisIndices: SpanIndices[],
    newIndices: SpanIndices,
    oldZeroData: SpanDatum[] | undefined,
    range: Pick<SpanIndices, 'xValue0Index' | 'xValue1Index'>,
    out: SpanInterpolationResult
) {
    const newSpanDatum = newData.data[newIndices.datumIndex];
    const newSpan = newSpanDatum.span;
    const zeroSpan = zeroDataSpan(newSpanDatum, oldZeroData);

    if (zeroSpan != null) {
        out.removed.push({ from: zeroSpan, to: zeroSpan });
        out.moved.push({ from: zeroSpan, to: newSpan });
        out.added.push({ from: newSpan, to: newSpan });
    } else {
        const oldSpan = collapseSpan(newSpan, collapseMode, newData, newAxisIndices, newIndices, range);
        out.added.push({ from: oldSpan, to: newSpan });
    }
}

function removeSpan(
    oldData: SpanContext,
    collapseMode: CollapseMode,
    oldAxisIndices: SpanIndices[],
    oldIndices: SpanIndices,
    newZeroData: SpanDatum[] | undefined,
    range: Pick<SpanIndices, 'xValue0Index' | 'xValue1Index'>,
    out: SpanInterpolationResult
) {
    const oldSpanDatum = oldData.data[oldIndices.datumIndex];
    const oldSpan = oldSpanDatum.span;
    const zeroSpan = zeroDataSpan(oldSpanDatum, newZeroData);

    if (zeroSpan != null) {
        out.removed.push({ from: oldSpan, to: oldSpan });
        out.moved.push({ from: oldSpan, to: zeroSpan });
        out.added.push({ from: zeroSpan, to: zeroSpan });
    } else {
        const newSpan = collapseSpan(oldSpan, collapseMode, oldData, oldAxisIndices, oldIndices, range);
        out.removed.push({ from: oldSpan, to: newSpan });
    }
}

function alignSpanToContainingSpan(
    span: Span,
    axisValues: AxisValue[],
    preData: SpanContext,
    postData: SpanContext,
    postSpanIndices: SpanIndices
) {
    const startXValue0 = axisValues[postSpanIndices.xValue0Index];
    const startDatum = preData.data.find((spanDatum) => toAxisValue(spanDatum.xValue0) === startXValue0);
    const endXValue1 = axisValues[postSpanIndices.xValue1Index];
    const endDatum = preData.data.find((spanDatum) => toAxisValue(spanDatum.xValue1) === endXValue1);

    if (startDatum == null || endDatum == null) return;

    const [{ x: x0 }, { x: x1 }] = spanRange(span);

    const startX = scale(startDatum.xValue0, preData.scales.x);
    const startY = scale(startDatum.yValue0, preData.scales.y);
    const endX = scale(endDatum.xValue1, preData.scales.x);
    const endY = scale(endDatum.yValue1, preData.scales.y);

    let altSpan = postData.data[postSpanIndices.datumIndex].span;
    altSpan = rescaleSpan(altSpan, { x: startX, y: startY }, { x: endX, y: endY });
    altSpan = clipSpanX(altSpan, x0, x1);

    return altSpan;
}

function appendSpanPhases(
    newData: SpanContext,
    oldData: SpanContext,
    collapseMode: CollapseMode,
    axisValues: AxisValue[],
    xValue0Index: number,
    newAxisIndices: SpanIndices[],
    oldAxisIndices: SpanIndices[],
    range: Pick<SpanIndices, 'xValue0Index' | 'xValue1Index'>,
    out: SpanInterpolationResult
) {
    const xValue1Index = xValue0Index + 1;

    const oldIndices = oldAxisIndices.find((i) => i.xValue0Index <= xValue0Index && i.xValue1Index >= xValue1Index);
    const newIndices = newAxisIndices.find((i) => i.xValue0Index <= xValue0Index && i.xValue1Index >= xValue1Index);

    const oldZeroData = oldData.zeroData;
    const newZeroData = newData.zeroData;

    if (oldIndices == null && newIndices != null) {
        addSpan(newData, collapseMode, newAxisIndices, newIndices, oldZeroData, range, out);
        return;
    } else if (oldIndices != null && newIndices == null) {
        removeSpan(oldData, collapseMode, oldAxisIndices, oldIndices, newZeroData, range, out);
        return;
    } else if (oldIndices == null || newIndices == null) {
        return;
    }

    let ordering: 0 | 1 | -1;
    if (oldIndices.xValue0Index === newIndices.xValue0Index && oldIndices.xValue1Index === newIndices.xValue1Index) {
        // Ranges are equal
        ordering = 0;
    } else if (
        oldIndices.xValue0Index <= newIndices.xValue0Index &&
        oldIndices.xValue1Index >= newIndices.xValue1Index
    ) {
        // Old range contains new range
        ordering = -1;
    } else if (
        oldIndices.xValue0Index >= newIndices.xValue0Index &&
        oldIndices.xValue1Index <= newIndices.xValue1Index
    ) {
        // New range contains old range
        ordering = 1;
    } else {
        // Ranges overlap, but no ordering
        ordering = 0;
    }

    const oldSpanDatum = oldData.data[oldIndices.datumIndex];
    const clippedOldSpanOldScale = clipSpan(oldSpanDatum.span, xValue0Index, oldIndices);

    const newSpanDatum = newData.data[newIndices.datumIndex];
    const clippedNewSpanNewScale = clipSpan(newSpanDatum.span, xValue0Index, newIndices);

    if (ordering === 1) {
        // Removed
        const clippedPostRemoveOldSpanOldScale = alignSpanToContainingSpan(
            clippedOldSpanOldScale,
            axisValues,
            oldData,
            newData,
            newIndices
        );
        if (clippedPostRemoveOldSpanOldScale != null) {
            out.removed.push({ from: clippedOldSpanOldScale, to: clippedPostRemoveOldSpanOldScale });
            out.moved.push({ from: clippedPostRemoveOldSpanOldScale, to: clippedNewSpanNewScale });
            out.added.push({ from: clippedNewSpanNewScale, to: clippedNewSpanNewScale });
        } else {
            removeSpan(oldData, collapseMode, oldAxisIndices, oldIndices, newZeroData, range, out);
        }
    } else if (ordering === -1) {
        // Added
        const clippedPreAddedNewSpanNewScale = alignSpanToContainingSpan(
            clippedNewSpanNewScale,
            axisValues,
            newData,
            oldData,
            oldIndices
        );
        if (clippedPreAddedNewSpanNewScale != null) {
            out.removed.push({ from: clippedOldSpanOldScale, to: clippedOldSpanOldScale });
            out.moved.push({ from: clippedOldSpanOldScale, to: clippedPreAddedNewSpanNewScale });
            out.added.push({ from: clippedPreAddedNewSpanNewScale, to: clippedNewSpanNewScale });
        } else {
            addSpan(newData, collapseMode, newAxisIndices, newIndices, oldZeroData, range, out);
        }
    } else {
        // Updated
        out.removed.push({ from: clippedOldSpanOldScale, to: clippedOldSpanOldScale });
        out.moved.push({ from: clippedOldSpanOldScale, to: clippedNewSpanNewScale });
        out.added.push({ from: clippedNewSpanNewScale, to: clippedNewSpanNewScale });
    }
}

function phaseAnimation(
    axisContext: AxisContext,
    newData: SpanContext,
    oldData: SpanContext,
    collapseMode: CollapseMode
): SpanInterpolationResult {
    const out: SpanInterpolationResult = {
        removed: [],
        moved: [],
        added: [],
    };

    const { axisValues, oldDataAxisIndices, newDataAxisIndices } = axisContext;
    const range = {
        xValue0Index: Math.max(
            oldDataAxisIndices.at(0)?.xValue0Index ?? -Infinity,
            newDataAxisIndices.at(0)?.xValue0Index ?? -Infinity
        ),
        xValue1Index: Math.min(
            oldDataAxisIndices.at(-1)?.xValue1Index ?? Infinity,
            newDataAxisIndices.at(-1)?.xValue1Index ?? Infinity
        ),
    };
    for (let xValue0Index = 0; xValue0Index < axisValues.length - 1; xValue0Index += 1) {
        appendSpanPhases(
            newData,
            oldData,
            collapseMode,
            axisValues,
            xValue0Index,
            newDataAxisIndices,
            oldDataAxisIndices,
            range,
            out
        );
    }

    return out;
}

function resetSpan(data: SpanContext, spanDatum: SpanDatum, collapseMode: CollapseMode) {
    const { span } = spanDatum;
    switch (collapseMode) {
        case CollapseMode.Zero:
            return zeroDataSpan(spanDatum, data.zeroData) ?? axisZeroSpan(span, data);
        case CollapseMode.Split:
            return collapseSpanToMidpoint(span);
    }
}

function resetAnimation(
    newData: SpanContext,
    oldData: SpanContext,
    collapseMode: CollapseMode
): SpanInterpolationResult {
    const added: SpanInterpolationResult['added'] = [];
    const removed: SpanInterpolationResult['removed'] = [];

    for (const oldSpanDatum of oldData.data) {
        const oldSpan = oldSpanDatum.span;
        const collapsedSpan = resetSpan(oldData, oldSpanDatum, collapseMode);
        removed.push({ from: oldSpan, to: collapsedSpan });
    }

    for (const newSpanDatum of newData.data) {
        const newSpan = newSpanDatum.span;
        const collapsedSpan = resetSpan(newData, newSpanDatum, collapseMode);
        added.push({ from: collapsedSpan, to: newSpan });
    }

    return {
        removed,
        moved: [],
        added,
    };
}

export function pairUpSpans(
    newData: SpanContext,
    oldData: SpanContext,
    collapseMode: CollapseMode
): SpanInterpolationResult | undefined {
    if (!validateCategorySorting(newData, oldData)) return;

    const axisContext = spanAxisContext(newData, oldData);
    return axisContext == null
        ? resetAnimation(newData, oldData, collapseMode)
        : phaseAnimation(axisContext, newData, oldData, collapseMode);
}
