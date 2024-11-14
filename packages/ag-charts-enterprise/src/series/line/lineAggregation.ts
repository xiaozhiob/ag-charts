import { _ModuleSupport } from 'ag-charts-community';

import {
    SPAN,
    X_MAX,
    X_MIN,
    Y_MAX,
    Y_MIN,
    compactAggregationIndices,
    createAggregationIndices,
} from '../../utils/aggregation';

const { findMinMax } = _ModuleSupport;

const AGGREGATION_THRESHOLD = 1e3;
const MAX_POINTS = 10;

function xRatioForDatumIndex(xValue: any, d0: number, d1: number) {
    return (xValue.valueOf() - d0) / (d1 - d0);
}

function aggregationIndexForXRatio(xRatio: number, maxRange: number) {
    return (Math.min(Math.floor(xRatio * maxRange), maxRange - 1) * SPAN) | 0;
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
    const { indexData, valueData } = createAggregationIndices(xValues, yValues, yValues, d0, d1, maxRange);

    let indices: number[] = [];
    for (let datumIndex = 0; datumIndex < xValues.length; datumIndex += 1) {
        if (aggregationContainsIndex(xValues, d0, d1, indexData, maxRange, datumIndex)) {
            indices.push(datumIndex);
        }
    }

    const filters: _ModuleSupport.LineSeriesDataAggregationFilter[] = [{ maxRange, indices }];

    while (indices.length > MAX_POINTS && maxRange > 64) {
        ({ maxRange } = compactAggregationIndices(indexData, valueData, maxRange, { inPlace: true }));
        indices = indices.filter(aggregationContainsIndex.bind(null, xValues, d0, d1, indexData, maxRange));

        filters.push({ maxRange, indices });
    }

    filters.reverse();

    return filters;
}
