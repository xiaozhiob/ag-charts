/* eslint-disable sonarjs/no-duplicate-string */
import type { ScaleType } from '../../scale/scale';
import { arraysEqual } from '../../util/array';
import { memo } from '../../util/memo';
import { clamp, isNegative } from '../../util/number';
import { isArray, isFiniteNumber } from '../../util/type-guards';
import { isContinuous, transformIntegratedCategoryValue } from '../../util/value';
import { accumulatedValue, range, trailingAccumulatedValue } from './aggregateFunctions';
import type {
    DatumPropertyDefinition,
    GroupValueProcessorDefinition,
    ProcessedData,
    ProcessedOutputDiff,
    ProcessorOutputPropertyDefinition,
    PropertyValueProcessorDefinition,
    ReducerOutputPropertyDefinition,
} from './dataModel';

function basicContinuousCheckDatumValidation(value: any) {
    return value != null && isContinuous(value);
}

function basicDiscreteCheckDatumValidation(value: any) {
    return value != null;
}

function getValidationFn(scaleType?: ScaleType) {
    switch (scaleType) {
        case 'number':
        case 'log':
        case 'ordinal-time':
        case 'time':
        case 'color':
            return basicContinuousCheckDatumValidation;
        default:
            return basicDiscreteCheckDatumValidation;
    }
}

function getValueType(scaleType?: ScaleType) {
    switch (scaleType) {
        case 'number':
        case 'log':
        case 'time':
        case 'color':
            return 'range';
        default:
            return 'category';
    }
}
export function keyProperty<K>(propName: K, scaleType?: ScaleType, opts: Partial<DatumPropertyDefinition<K>> = {}) {
    const result: DatumPropertyDefinition<K> = {
        property: propName,
        type: 'key',
        valueType: getValueType(scaleType),
        validation: getValidationFn(scaleType),
        ...opts,
    };
    return result;
}

export function valueProperty<K>(propName: K, scaleType?: ScaleType, opts: Partial<DatumPropertyDefinition<K>> = {}) {
    const result: DatumPropertyDefinition<K> = {
        property: propName,
        type: 'value',
        valueType: getValueType(scaleType),
        validation: getValidationFn(scaleType),
        ...opts,
    };
    return result;
}

export function rangedValueProperty<K>(
    propName: K,
    opts: Partial<DatumPropertyDefinition<K>> & { min?: number; max?: number } = {}
): DatumPropertyDefinition<K> {
    const { min = -Infinity, max = Infinity, ...defOpts } = opts;
    return {
        type: 'value',
        property: propName,
        valueType: 'range',
        validation: basicContinuousCheckDatumValidation,
        processor: () => (datum) => (isFiniteNumber(datum) ? clamp(min, datum, max) : datum),
        ...defOpts,
    };
}

export function accumulativeValueProperty<K>(
    propName: K,
    scaleType?: ScaleType,
    opts: Partial<DatumPropertyDefinition<K>> & { onlyPositive?: boolean } = {}
) {
    const { onlyPositive, ...defOpts } = opts;
    const result: DatumPropertyDefinition<K> = {
        ...valueProperty(propName, scaleType, defOpts),
        processor: accumulatedValue(onlyPositive),
    };
    return result;
}

export function trailingAccumulatedValueProperty<K>(
    propName: K,
    scaleType?: ScaleType,
    opts: Partial<DatumPropertyDefinition<K>> = {}
) {
    const result: DatumPropertyDefinition<K> = {
        ...valueProperty(propName, scaleType, opts),
        processor: trailingAccumulatedValue(),
    };
    return result;
}

export function groupAccumulativeValueProperty<K>(
    propName: K,
    mode: 'normal' | 'trailing' | 'window' | 'window-trailing',
    sum: 'current' | 'last',
    opts: Partial<DatumPropertyDefinition<K>> & { rangeId?: string; groupId: string },
    scaleType?: ScaleType
) {
    return [
        valueProperty(propName, scaleType, opts),
        accumulateGroup(opts.groupId, mode, sum, opts.separateNegative),
        ...(opts.rangeId != null ? [range(opts.rangeId, opts.groupId)] : []),
    ];
}

export function groupStackValueProperty<K>(
    propName: K,
    scaleType: ScaleType | undefined,
    opts: Partial<DatumPropertyDefinition<K>> & { rangeId?: string; groupId: string }
) {
    return [valueProperty(propName, scaleType, opts), accumulateStack(opts.groupId)];
}

export const SMALLEST_KEY_INTERVAL: ReducerOutputPropertyDefinition<'smallestKeyInterval'> = {
    type: 'reducer',
    property: 'smallestKeyInterval',
    initialValue: Infinity,
    reducer: () => {
        let prevX = NaN;
        return (smallestSoFar = Infinity, next) => {
            const nextX = next.keys[0];
            const interval = Math.abs(nextX - prevX);
            prevX = nextX;
            if (!isNaN(interval) && interval > 0 && interval < smallestSoFar) {
                return interval;
            }
            return smallestSoFar;
        };
    },
};

export const LARGEST_KEY_INTERVAL: ReducerOutputPropertyDefinition<'largestKeyInterval'> = {
    type: 'reducer',
    property: 'largestKeyInterval',
    initialValue: -Infinity,
    reducer: () => {
        let prevX = NaN;
        return (largestSoFar = -Infinity, next) => {
            const nextX = next.keys[0];
            const interval = Math.abs(nextX - prevX);
            prevX = nextX;
            if (!isNaN(interval) && interval > 0 && interval > largestSoFar) {
                return interval;
            }
            return largestSoFar;
        };
    },
};

export const SORT_DOMAIN_GROUPS: ProcessorOutputPropertyDefinition<'sortedGroupDomain'> = {
    type: 'processor',
    property: 'sortedGroupDomain',
    calculate: ({ domain: { groups } }) =>
        groups?.slice().sort((a, b) => {
            for (let i = 0; i < a.length; i++) {
                const result = a[i] - b[i];
                if (result !== 0) {
                    return result;
                }
            }
            return 0;
        }),
};

function normaliseFnBuilder({ normaliseTo, mode }: { normaliseTo: number; mode: 'sum' | 'range' }) {
    const normalise = (val: number, extent: number) => {
        const result = (val * normaliseTo) / extent;
        if (result >= 0) {
            return Math.min(normaliseTo, result);
        }
        return Math.max(-normaliseTo, result);
    };

    return () => () => (values: any[], valueIndexes: number[], datumIndex: number, columns?: any[][]) => {
        const valuesExtent = [0, 0];
        for (const valueIdx of valueIndexes) {
            const column = columns?.[valueIdx];
            const value: number | number[] = column != null ? column[datumIndex] : values[valueIdx];
            // Note - Array.isArray(new Float64Array) is false, and this type is used for stack accumulators
            const valueExtent = typeof value === 'number' ? value : Math.max(...value);
            const valIdx = valueExtent < 0 ? 0 : 1;
            if (mode === 'sum') {
                valuesExtent[valIdx] += valueExtent;
            } else if (valIdx === 0) {
                valuesExtent[valIdx] = Math.min(valuesExtent[valIdx], valueExtent);
            } else {
                valuesExtent[valIdx] = Math.max(valuesExtent[valIdx], valueExtent);
            }
        }

        const extent = Math.max(Math.abs(valuesExtent[0]), valuesExtent[1]);
        for (const valueIdx of valueIndexes) {
            const column = columns?.[valueIdx];
            if (column != null) {
                const value: number | number[] = column[datumIndex];
                column[datumIndex] =
                    typeof value === 'number' ? normalise(value, extent) : value.map((v) => normalise(v, extent));
            } else {
                const value: number | number[] = values[valueIdx];
                values[valueIdx] =
                    typeof value === 'number' ? normalise(value, extent) : value.map((v) => normalise(v, extent));
            }
        }
    };
}

export function normaliseGroupTo(
    matchGroupIds: string[],
    normaliseTo: number,
    mode: 'sum' | 'range' = 'sum'
): GroupValueProcessorDefinition<any, any> {
    return {
        type: 'group-value-processor',
        matchGroupIds,
        adjust: memo({ normaliseTo, mode }, normaliseFnBuilder),
    };
}

function normalisePropertyFnBuilder({
    normaliseTo,
    zeroDomain,
    rangeMin,
    rangeMax,
}: {
    normaliseTo: [number, number];
    zeroDomain: number;
    rangeMin?: number;
    rangeMax?: number;
}) {
    const normaliseSpan = normaliseTo[1] - normaliseTo[0];
    const normalise = (val: number, start: number, span: number) => {
        const result = normaliseTo[0] + ((val - start) / span) * normaliseSpan;

        if (span === 0) {
            return zeroDomain;
        } else if (result >= normaliseTo[1]) {
            return normaliseTo[1];
        } else if (result < normaliseTo[0]) {
            return normaliseTo[0];
        }
        return result;
    };

    return () => (pData: ProcessedData<any>, pIdx: number) => {
        let [start, end] = pData.domain.values[pIdx];
        if (rangeMin != null) start = rangeMin;
        if (rangeMax != null) end = rangeMax;
        const span = end - start;

        pData.domain.values[pIdx] = [normaliseTo[0], normaliseTo[1]];

        for (const group of pData.data) {
            let groupValues = group.values;
            if (pData.type === 'ungrouped') {
                groupValues = [groupValues];
            }
            for (const values of groupValues) {
                values[pIdx] = normalise(values[pIdx], start, span);
            }
        }
    };
}

export function normalisePropertyTo(
    property: string,
    normaliseTo: [number, number],
    zeroDomain: number,
    rangeMin?: number,
    rangeMax?: number
): PropertyValueProcessorDefinition<any> {
    return {
        type: 'property-value-processor',
        property,
        adjust: memo({ normaliseTo, rangeMin, rangeMax, zeroDomain }, normalisePropertyFnBuilder),
    };
}

export function animationValidation(valueKeyIds?: string[]): ProcessorOutputPropertyDefinition {
    return {
        type: 'processor',
        property: 'animationValidation',
        calculate(result: ProcessedData<any>) {
            const { keys, values } = result.defs;
            const { input, rawData, data, columns } = result;
            let uniqueKeys = true;
            let orderedKeys = true;

            if (rawData.length === 0) {
                return { uniqueKeys, orderedKeys };
            }

            const valueKeys: [number, DatumPropertyDefinition<unknown>][] = [];
            for (let k = 0; k < values.length; k++) {
                if (!valueKeyIds?.includes(values[k].id as string)) continue;

                valueKeys.push([k, values[k]]);
            }

            const processKey = (idx: number, def: DatumPropertyDefinition<unknown>, type: 'keys' | 'values') => {
                if (def.valueType === 'category') {
                    const keyValues = result.domain[type][idx];
                    uniqueKeys &&= keyValues.length === input.count;
                    return;
                }

                let lastValue = columns != null ? columns[idx][0] : data[0]?.[type][idx];
                for (let d = 1; (uniqueKeys || orderedKeys) && d < rawData.length; d++) {
                    const keyValue = columns != null ? columns[idx][d] : data[d][type][idx];
                    orderedKeys &&= lastValue <= keyValue;
                    uniqueKeys &&= lastValue !== keyValue;
                    lastValue = keyValue;
                }
            };
            for (let k = 0; (uniqueKeys || orderedKeys) && k < keys.length; k++) {
                processKey(k, keys[k], 'keys');
            }

            for (let k = 0; (uniqueKeys || orderedKeys) && k < valueKeys.length; k++) {
                const [idx, key] = valueKeys[k];
                processKey(idx, key, 'values');
            }

            return { uniqueKeys, orderedKeys };
        },
    };
}

function buildGroupAccFn({ mode, separateNegative }: { mode: 'normal' | 'trailing'; separateNegative?: boolean }) {
    return () => () => (values: any[], valueIndexes: number[], datumIndex: number, columns?: any[][]) => {
        // Datum scope.
        const acc = [0, 0];
        for (const valueIdx of valueIndexes) {
            const column = columns?.[valueIdx];
            const currentVal = column != null ? column[datumIndex] : values[valueIdx];
            const accIndex = isNegative(currentVal) && separateNegative ? 0 : 1;
            if (!isFiniteNumber(currentVal)) continue;

            if (mode === 'normal') acc[accIndex] += currentVal;
            if (column != null) {
                column[datumIndex] = acc[accIndex];
            } else {
                values[valueIdx] = acc[accIndex];
            }
            if (mode === 'trailing') acc[accIndex] += currentVal;
        }
    };
}

function buildGroupWindowAccFn({ mode, sum }: { mode: 'normal' | 'trailing'; sum: 'current' | 'last' }) {
    return () => {
        // Entire data-set scope.
        const lastValues: any[] = [];
        let firstRow = true;
        return () => {
            // Group scope.
            return (values: any[], valueIndexes: number[]) => {
                // Datum scope.
                let acc = 0;
                for (const valueIdx of valueIndexes) {
                    const currentVal = values[valueIdx];
                    const lastValue = firstRow && sum === 'current' ? 0 : lastValues[valueIdx];
                    lastValues[valueIdx] = currentVal;

                    const sumValue = sum === 'current' ? currentVal : lastValue;
                    if (!isFiniteNumber(currentVal) || !isFiniteNumber(lastValue)) {
                        values[valueIdx] = acc;
                        continue;
                    }

                    if (mode === 'normal') {
                        acc += sumValue;
                    }
                    values[valueIdx] = acc;
                    if (mode === 'trailing') {
                        acc += sumValue;
                    }
                }

                firstRow = false;
            };
        };
    };
}

export function accumulateGroup(
    matchGroupId: string,
    mode: 'normal' | 'trailing' | 'window' | 'window-trailing',
    sum: 'current' | 'last',
    separateNegative = false
): GroupValueProcessorDefinition<any, any> {
    let adjust;
    if (mode.startsWith('window')) {
        const modeParam = mode.endsWith('-trailing') ? 'trailing' : 'normal';
        adjust = memo({ mode: modeParam, sum }, buildGroupWindowAccFn);
    } else {
        adjust = memo({ mode: mode as 'normal' | 'trailing', separateNegative }, buildGroupAccFn);
    }

    return {
        type: 'group-value-processor',
        matchGroupIds: [matchGroupId],
        adjust,
    };
}

function groupStackAccFn() {
    return () => (values: any[], valueIndexes: number[]) => {
        // Datum scope.
        const acc = new Float64Array(32);
        let stackCount = 0;
        for (const valueIdx of valueIndexes) {
            const currentValue = values[valueIdx];
            acc[stackCount] = Number.isFinite(currentValue) ? currentValue : NaN;
            stackCount += 1;
            values[valueIdx] = acc.subarray(0, stackCount);
        }
    };
}

export function accumulateStack(matchGroupId: string): GroupValueProcessorDefinition<any, any> {
    return {
        type: 'group-value-processor',
        matchGroupIds: [matchGroupId],
        adjust: groupStackAccFn,
    };
}

function valueIndices(id: string, previousData: ProcessedData<any>, processedData: ProcessedData<any>) {
    const prevIndices = [];
    const previousValues = previousData.defs.values;
    for (let i = 0; i < previousValues.length; i += 1) {
        const value = previousValues[i];
        if (value.scopes?.includes(id) !== true) continue;

        prevIndices.push(i);
    }

    const nextIndices = [];
    let previousIndicesIndex = 0;
    const nextValues = processedData.defs.values;
    for (let i = 0; i < previousValues.length; i += 1) {
        const value = nextValues[i];
        if (value.scopes?.includes(id) !== true) continue;

        const previousIndex = prevIndices[previousIndicesIndex];
        const previousValue = previousValues[previousIndex];

        // Incompatible
        if (value.property !== previousValue.property) return;

        nextIndices.push(i);
        previousIndicesIndex += 1;
    }

    // Incompatible
    if (prevIndices.length !== nextIndices.length) return;

    return { prevIndices, nextIndices };
}

function valuesEqual(
    previousValues: any[],
    nextValues: any[],
    previousIndices: number[] | undefined,
    nextIndices: number[] | undefined
) {
    if (previousIndices == null || nextIndices == null) {
        return arraysEqual(previousValues, nextValues);
    }

    for (let i = 0; i < previousIndices.length; i += 1) {
        const previousIndex = previousIndices[i];
        const nextIndex = nextIndices[i];

        const previousValue = previousValues[previousIndex];
        const nextValue = nextValues[nextIndex];

        if (previousValue !== nextValue) {
            return false;
        }
    }

    return true;
}

function columnsEqual(
    previousColumns: any[][],
    nextColumns: any[][],
    previousIndices: number[] | undefined,
    nextIndices: number[] | undefined,
    previousDatumIndex: number,
    nextDatumIndex: number
) {
    if (previousIndices == null || nextIndices == null) {
        return false;
    }

    for (let indicesIndex = 0; indicesIndex < previousIndices.length; indicesIndex += 1) {
        const previousIndex = previousIndices[indicesIndex];
        const nextIndex = nextIndices[indicesIndex];

        const previousColumn = previousColumns[previousIndex];
        const nextColumn = nextColumns[nextIndex];

        const previousValue = previousColumn[previousDatumIndex];
        const nextValue = nextColumn[nextDatumIndex];

        if (previousValue !== nextValue) {
            return false;
        }
    }

    return true;
}

export function diff(
    id: string,
    previousData: ProcessedData<any>,
    updateMovedData: boolean = true
): ProcessorOutputPropertyDefinition<'diff'> {
    return {
        type: 'processor',
        property: 'diff',
        calculate(processedData): ProcessedOutputDiff | undefined {
            const moved = new Map<string, number>();
            const added = new Map<string, number>();
            const updated = new Map<string, number>();
            const removed = new Map<string, number>();

            const previousKeys = previousData.keys;
            const keys = processedData.keys;

            const previousColumns = previousData.columns;
            const columns = processedData.columns;

            const indices = valueIndices(id, previousData, processedData);
            if (indices == null) return;

            const { prevIndices, nextIndices } = indices;

            const length =
                columns != null
                    ? Math.max(previousData.rawData.length, processedData.rawData.length)
                    : Math.max(previousData.data.length, processedData.data.length);

            for (let i = 0; i < length; i++) {
                const prev = previousData.data?.[i];
                const datum = processedData.data?.[i];
                const hasPreviousDatum = previousColumns != null ? i < previousData.rawData.length : prev != null;
                const hasDatum = columns != null ? i < processedData.rawData.length : datum != null;

                let prevId: string;
                if (previousKeys != null) {
                    prevId = createDatumId(previousKeys[i]);
                } else {
                    prevId = prev ? createDatumId(prev.keys) : '';
                }
                let datumId: string;
                if (keys != null) {
                    datumId = createDatumId(keys[i]);
                } else {
                    datumId = datum ? createDatumId(datum.keys) : '';
                }

                if (hasDatum && hasPreviousDatum && prevId === datumId) {
                    const eq =
                        previousColumns != null && columns != null
                            ? columnsEqual(previousColumns, columns, prevIndices, nextIndices, i, i)
                            : valuesEqual(prev.values, datum.values, prevIndices, nextIndices);
                    if (!eq) {
                        updated.set(datumId, i);
                    }
                    continue;
                }

                const removedIndex = removed.get(datumId);
                if (removedIndex != null) {
                    // @todo(AG-XXXX) tidy up after removing .values
                    const eq =
                        previousColumns != null && columns != null
                            ? columnsEqual(previousColumns, columns, prevIndices, nextIndices, removedIndex, i)
                            : valuesEqual(
                                  previousData.data[removedIndex].values,
                                  datum.values,
                                  prevIndices,
                                  nextIndices
                              );
                    if (updateMovedData || !eq) {
                        updated.set(datumId, i);
                        moved.set(datumId, i);
                    }
                    removed.delete(datumId);
                } else if (hasDatum) {
                    added.set(datumId, i);
                }

                const addedIndex = added.get(prevId);
                if (addedIndex != null) {
                    // @todo(AG-XXXX) tidy up after removing .values
                    const eq =
                        previousColumns != null && columns != null
                            ? columnsEqual(previousColumns, columns, prevIndices, nextIndices, addedIndex, i)
                            : valuesEqual(previousData.data[addedIndex].values, prev.values, prevIndices, nextIndices);
                    if (updateMovedData || !eq) {
                        updated.set(prevId, i);
                        moved.set(prevId, i);
                    }
                    added.delete(prevId);
                } else if (hasPreviousDatum) {
                    updated.delete(prevId);
                    removed.set(prevId, i);
                }
            }

            const changed = added.size > 0 || updated.size > 0 || removed.size > 0;
            return {
                changed,
                added: new Set(added.keys()),
                updated: new Set(updated.keys()),
                removed: new Set(removed.keys()),
                moved: new Set(moved.keys()),
            };
        },
    };
}

type KeyType = string | number | boolean | object;
export function createDatumId(keys: KeyType | KeyType[], ...extraKeys: (string | number | boolean)[]) {
    let result;
    if (isArray(keys)) {
        result = keys.map((key) => transformIntegratedCategoryValue(key)).join('___');
    } else {
        result = transformIntegratedCategoryValue(keys);
    }

    const primitiveType =
        typeof result === 'string' ||
        typeof result === 'number' ||
        typeof result === 'boolean' ||
        result instanceof Date;
    if (primitiveType && extraKeys.length > 0) {
        result += `___${extraKeys.join('___')}`;
    }

    return result;
}
