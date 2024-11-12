import { arraysEqual } from '../../util/array';
import type { DataModel, DataModelOptions, PropertyDefinition, UngroupedData } from './dataModel';

export interface CachedDataItem<D extends object, K extends keyof D & string = keyof D & string> {
    ids: string[];
    opts: DataModelOptions<K, any>;
    data: D[];
    dataModel: DataModel<any, any, any>;
    processedData: UngroupedData<any> | undefined;
}

export type CachedData = CachedDataItem<any, any>[];

function setsEqual<T>(a: Set<T>, b: Set<T>) {
    if (a.size !== b.size) return false;

    for (const value of a) {
        if (!b.has(value)) return false;
    }

    return true;
}

function idsMapEqual(a: Map<string, Set<string>> | undefined, b: Map<string, Set<string>> | undefined) {
    if (a == null || b == null) return a === b;
    if (a.size !== b.size) return false;

    for (const [key, aValue] of a) {
        const bValue = b.get(key);
        if (bValue == null) return false;
        if (!setsEqual(aValue, bValue)) return false;
    }

    return true;
}

function scopesEqual(a: string[] | undefined, b: string[] | undefined) {
    if (a != null) {
        return b != null ? arraysEqual(a, b) : false;
    }
    return b == null;
}

function propsEqual(a: PropertyDefinition<any>[], b: PropertyDefinition<any>[]) {
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i += 1) {
        const propA = a[i];
        const propB = b[i];
        if (propA.type !== propB.type) return false;
        if (propA.id !== propB.id) return false;
        if (propA.groupId !== propB.groupId) return false;
    }

    for (let i = 0; i < a.length; i += 1) {
        const propA = a[i];
        const propB = b[i];
        if (!scopesEqual(propA.scopes, propB.scopes)) return false;
        if (!idsMapEqual(propA.idsMap, propB.idsMap)) return false;
    }

    return true;
}

function optsEqual(a: DataModelOptions<any, any>, b: DataModelOptions<any, any>) {
    return (
        a.groupByData === b.groupByData &&
        a.groupByFn === b.groupByFn &&
        a.groupByKeys === b.groupByKeys &&
        scopesEqual(a.scopes, b.scopes) &&
        propsEqual(a.props, b.props)
    );
}

export function canReuseCachedData<D extends object, K extends keyof D & string = keyof D & string>(
    cachedDataItem: CachedDataItem<any, any>,
    data: D[],
    ids: string[],
    opts: DataModelOptions<K, any>
) {
    return data === cachedDataItem.data && arraysEqual(ids, cachedDataItem.ids) && optsEqual(opts, cachedDataItem.opts);
}
