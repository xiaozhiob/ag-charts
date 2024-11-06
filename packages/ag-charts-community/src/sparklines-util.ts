export type { PlacedLabel, PointLabelDatum } from './scene/util/labelPlacement';
export {
    angleBetween,
    isBetweenAngles,
    normalizeAngle360,
    normalizeAngle360Inclusive,
    toDegrees,
    toRadians,
} from './util/angle';
export { extent, normalisedExtentWithMetadata } from './util/array';
export { setAttribute, setAttributes, setElementStyle } from './util/attributeUtil';
export { BBoxValues } from './util/bboxinterface';
export { Debug } from './util/debug';
export { lineDistanceSquared } from './util/distance';
export { createId, generateUUID } from './util/id';
export { deepClone } from './util/json';
export { Logger } from './util/logger';
export { clamp, findMinMax, isNumberEqual } from './util/number';
export { Padding } from './util/padding';
export { sanitizeHtml } from './util/sanitize';
export { isDenseInterval, range } from './util/ticks';
export { isContinuous } from './util/value';

// Used by ag-grid:
export { Color } from './util/color';
export { interpolateColor } from './util/interpolate';
