import { isDecoratedObject, listDecoratedProperties } from './decorator';
import { isArray, isObject, isPlainObject } from './type-guards';
import type { Intersection, PlainObject } from './types';

type FalsyType = false | null | undefined;

export function objectsEqual(a: unknown, b: unknown): boolean {
    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false;
        if (a.length !== b.length) return false;

        return a.every((av, i) => objectsEqual(av, b[i]));
    } else if (isPlainObject(a)) {
        if (!isPlainObject(b)) return false;

        return objectsEqualWith(a, b, objectsEqual);
    }

    return a === b;
}

export function objectsEqualWith<T extends PlainObject>(a: T, b: T, cmp: (a: T, b: T) => boolean): boolean {
    for (const key of Object.keys(b)) {
        if (!(key in a)) return false;
    }
    for (const key of Object.keys(a)) {
        if (!(key in b)) return false;
        if (!cmp(a[key], b[key])) return false;
    }
    return true;
}

export function deepMerge<TSource extends PlainObject, TArgs extends (TSource | FalsyType)[]>(...sources: TArgs) {
    return mergeDefaults(...sources.reverse());
}

export function mergeDefaults<TSource extends PlainObject, TArgs extends (TSource | FalsyType)[]>(...sources: TArgs) {
    const target: PlainObject = {};

    for (const source of sources) {
        if (!isObject(source)) continue;

        const keys = isDecoratedObject(source) ? listDecoratedProperties(source) : Object.keys(source);

        for (const key of keys) {
            if (isPlainObject(target[key]) && isPlainObject(source[key])) {
                target[key] = mergeDefaults(target[key], source[key]);
            } else {
                target[key] ??= source[key];
            }
        }
    }

    return target as Intersection<Exclude<TArgs[number], FalsyType>>;
}

export function mergeArrayDefaults<T extends PlainObject>(dataArray: T[], ...itemDefaults: T[]) {
    if (itemDefaults && isArray(dataArray)) {
        return dataArray.map((item) => mergeDefaults(item, ...itemDefaults));
    }
    return dataArray;
}

export function mapValues<T extends PlainObject, R>(
    object: T,
    mapper: (value: T[keyof T], key: keyof T, object: T) => R
) {
    return Object.entries(object).reduce(
        (result, [key, value]) => {
            result[key as keyof T] = mapper(value, key, object);
            return result;
        },
        {} as Record<keyof T, R>
    );
}

export function without(object: object | undefined, keys: string[]) {
    const clone = { ...object };
    for (const key of keys) {
        delete clone[key as keyof object];
    }
    return clone;
}

export function getPath(object: object, path: string | string[]) {
    const pathArray = isArray(path) ? path : path.split('.');
    return pathArray.reduce<any>((value, pathKey) => value[pathKey], object);
}

export const SKIP_JS_BUILTINS = new Set(['__proto__', 'constructor', 'prototype']);

export function setPath(object: object, path: string | string[], newValue: unknown) {
    const pathArray = isArray(path) ? path.slice() : path.split('.');
    const lastKey = pathArray.pop()!;
    if (pathArray.some((p) => SKIP_JS_BUILTINS.has(p))) return;

    const lastObject = pathArray.reduce<any>((value, pathKey) => value[pathKey], object);
    lastObject[lastKey] = newValue;
    return lastObject[lastKey];
}

// Similar to Object.assign, but only copy an explicit set of keys.
export function partialAssign<T>(keysToCopy: (keyof T)[], target: T, source?: Partial<T>): T {
    if (source === undefined) {
        return target;
    }

    for (const key of keysToCopy) {
        const value: T[keyof T] | undefined = source[key];
        if (value !== undefined) {
            target[key] = value;
        }
    }

    return target;
}

export function deepFreeze<T>(obj: T): T {
    // Freeze the current object
    Object.freeze(obj);

    // Get all properties of the object
    Object.getOwnPropertyNames(obj).forEach((prop) => {
        const value = (obj as any)[prop];

        // If the value is an object, and not null, and hasn't already been frozen, recursively freeze it
        if (value !== null && (typeof value === 'object' || typeof value === 'function') && !Object.isFrozen(value)) {
            deepFreeze(value);
        }
    });

    return obj;
}
