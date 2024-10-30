import { _ModuleSupport, _Scale } from 'ag-charts-community';

const { findMinMax } = _ModuleSupport;

const AGGREGATION_THRESHOLD = 1e3;
const MAX_POINTS = 10;

const X_MIN = 0;
const X_MAX = 1;
const Y_MIN = 2;
const Y_MAX = 3;
const AGG_SPAN = 4;

function xRatioForDatumIndex(xValue: any, d0: number, d1: number) {
    return (xValue.valueOf() - d0) / (d1 - d0);
}

function aggregationIndexForXRatio(xRatio: number, maxRange: number) {
    return (Math.min(Math.floor(xRatio * maxRange), maxRange - 1) * AGG_SPAN) | 0;
}

function createAggregationIndices(
    xValues: any[],
    yValues: any[],
    d0: number,
    d1: number,
    maxRange: number
): {
    indexData: Int32Array;
    valueData: Float64Array;
} {
    const indexData = new Int32Array(maxRange * AGG_SPAN).fill(-1);
    const valueData = new Float64Array(maxRange * AGG_SPAN).fill(NaN);

    for (let datumIndex = 0; datumIndex < xValues.length; datumIndex += 1) {
        const xValue = xValues[datumIndex];
        const yValue = yValues[datumIndex];
        if (xValue == null || yValue == null) continue;

        const xRatio = xRatioForDatumIndex(xValue, d0, d1);
        const y: number = yValue.valueOf();
        const aggIndex = aggregationIndexForXRatio(xRatio, maxRange);

        if (Number.isNaN(valueData[aggIndex + X_MIN]) || xRatio < valueData[aggIndex + X_MIN]) {
            valueData[aggIndex + X_MIN] = xRatio;
            indexData[aggIndex + X_MIN] = datumIndex;
        }
        if (Number.isNaN(valueData[aggIndex + X_MAX]) || xRatio > valueData[aggIndex + X_MAX]) {
            valueData[aggIndex + X_MAX] = xRatio;
            indexData[aggIndex + X_MAX] = datumIndex;
        }
        if (Number.isNaN(valueData[aggIndex + Y_MIN]) || y < valueData[aggIndex + Y_MIN]) {
            valueData[aggIndex + Y_MIN] = y;
            indexData[aggIndex + Y_MIN] = datumIndex;
        }
        if (Number.isNaN(valueData[aggIndex + Y_MAX]) || y > valueData[aggIndex + Y_MAX]) {
            valueData[aggIndex + Y_MAX] = y;
            indexData[aggIndex + Y_MAX] = datumIndex;
        }
    }

    return { indexData, valueData };
}

function compactAggregationIndices(indexData: Int32Array, valueData: Float64Array, maxRange: number) {
    const nextMaxRange = (maxRange / 2) | 0;

    for (let i = 0; i < nextMaxRange; i += 1) {
        const aggIndex = (i * AGG_SPAN) | 0;
        const index0 = (aggIndex * 2) | 0;
        const index1 = (index0 + AGG_SPAN) | 0;

        const xMinAggIndex = valueData[index0 + X_MIN] < valueData[index1 + X_MIN] ? index0 : index1;
        valueData[aggIndex + X_MIN] = valueData[xMinAggIndex + X_MIN];
        indexData[aggIndex + X_MIN] = indexData[xMinAggIndex + X_MIN];

        const xMaxAggIndex = valueData[index0 + X_MAX] > valueData[index1 + X_MAX] ? index0 : index1;
        valueData[aggIndex + X_MAX] = valueData[xMaxAggIndex + X_MAX];
        indexData[aggIndex + X_MAX] = indexData[xMaxAggIndex + X_MAX];

        const yMinAggIndex = valueData[index0 + Y_MIN] < valueData[index1 + Y_MIN] ? index0 : index1;
        valueData[aggIndex + Y_MIN] = valueData[yMinAggIndex + Y_MIN];
        indexData[aggIndex + Y_MIN] = indexData[yMinAggIndex + Y_MIN];

        const yMaxAggIndex = valueData[index0 + Y_MAX] > valueData[index1 + Y_MAX] ? index0 : index1;
        valueData[aggIndex + Y_MAX] = valueData[yMaxAggIndex + Y_MAX];
        indexData[aggIndex + Y_MAX] = indexData[yMaxAggIndex + Y_MAX];
    }

    return nextMaxRange;
}

function aggregationContainsIndex(
    xValues: any[],
    d0: number,
    d1: number,
    indexData: Int32Array,
    maxRange: number,
    datumIndex: number
) {
    const xValue = xValues[datumIndex];
    if (xValue == null) return false;

    const xRatio = xRatioForDatumIndex(xValue, d0, d1);
    const aggIndex = aggregationIndexForXRatio(xRatio, maxRange);

    return (
        datumIndex === indexData[aggIndex + X_MIN] ||
        datumIndex === indexData[aggIndex + X_MAX] ||
        datumIndex === indexData[aggIndex + Y_MIN] ||
        datumIndex === indexData[aggIndex + Y_MAX]
    );
}

export function aggregateData(
    xValues: any[],
    yValues: any[],
    domain: number[]
): _ModuleSupport.LineSeriesDataAggregationFilter[] | undefined {
    if (xValues.length < AGGREGATION_THRESHOLD) return;

    const [d0, d1] = findMinMax(domain);

    let maxRange = (2 ** Math.ceil(Math.log2(xValues.length / MAX_POINTS))) | 0;
    const { indexData, valueData } = createAggregationIndices(xValues, yValues, d0, d1, maxRange);

    let indices: number[] = [];
    for (let datumIndex = 0; datumIndex < xValues.length; datumIndex += 1) {
        if (aggregationContainsIndex(xValues, d0, d1, indexData, maxRange, datumIndex)) {
            indices.push(datumIndex);
        }
    }

    const filters: _ModuleSupport.LineSeriesDataAggregationFilter[] = [{ maxRange, indices }];

    while (indices.length > MAX_POINTS && maxRange > 64) {
        maxRange = compactAggregationIndices(indexData, valueData, maxRange);
        indices = indices.filter(aggregationContainsIndex.bind(null, xValues, d0, d1, indexData, maxRange));

        filters.push({ maxRange, indices });
    }

    filters.reverse();

    return filters;
}
