import { isFiniteNumber, isString, isValidDate } from './type-guards';
import type { PlainObject } from './types';

type StringObject = PlainObject & { toString: () => string };
type NumberObject = PlainObject & { valueOf: () => number };

export const isStringObject = (value: unknown): value is StringObject =>
    !!value && Object.hasOwn(value, 'toString') && isString(value.toString());

const isNumberObject = (value: unknown): value is NumberObject =>
    value != null && Object.hasOwn(value, 'valueOf') && isFiniteNumber(value.valueOf());

export const isContinuous = (value: unknown): value is number | Date | NumberObject =>
    isFiniteNumber(value) || isValidDate(value) || isNumberObject(value);

export function checkDatum<T>(value: T, isContinuousScale: boolean): boolean {
    return value != null && (!isContinuousScale || isContinuous(value));
}

/**
 * To enable duplicate categories, a category axis value on a datum from integrated charts is transformed into an
 * object with `getString()` and `id` properties. The string value can be non-unique so we must instead use the
 * unique id property.
 *
 * @see https://ag-grid.atlassian.net/browse/AG-10526
 */
export function transformIntegratedCategoryValue(value: unknown) {
    if (isStringObject(value) && Object.hasOwn(value, 'id')) {
        return value.id;
    }
    return value;
}
