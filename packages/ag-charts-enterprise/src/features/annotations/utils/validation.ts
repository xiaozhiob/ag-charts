import { type Direction, _ModuleSupport } from 'ag-charts-community';

import type { AnnotationAxisContext, AnnotationContext, Point } from '../annotationTypes';

const { Logger, OrdinalTimeScale } = _ModuleSupport;

export function validateDatumLine(
    context: AnnotationContext,
    datum: { start: Point; end: Point },
    warningPrefix?: string
) {
    let valid = true;

    valid &&= validateDatumPoint(context, datum.start, warningPrefix && `${warningPrefix}[start] `);
    valid &&= validateDatumPoint(context, datum.end, warningPrefix && `${warningPrefix}[end] `);

    return valid;
}

export function validateDatumValue(
    context: AnnotationContext,
    datum: { value?: string | number | Date; direction?: Direction },
    warningPrefix: string
) {
    const axis = datum.direction === 'horizontal' ? context.yAxis : context.xAxis;
    const valid = validateDatumPointDirection(datum.value, axis);

    if (!valid && warningPrefix) {
        Logger.warnOnce(`${warningPrefix}is outside the axis domain, ignoring. - value: [${datum.value}]]`);
    }

    return valid;
}

export function validateDatumPoint(context: AnnotationContext, point: Point, warningPrefix?: string) {
    if (point.x == null || point.y == null) {
        if (warningPrefix) {
            Logger.warnOnce(`${warningPrefix}requires both an [x] and [y] property, ignoring.`);
        }
        return false;
    }

    const validX = validateDatumPointDirection(point.x, context.xAxis);
    const validY = validateDatumPointDirection(point.y, context.yAxis);

    if (!validX || !validY) {
        let text = 'x & y domains';
        if (validX) text = 'y domain';
        if (validY) text = 'x domain';
        if (warningPrefix) {
            Logger.warnOnce(`${warningPrefix}is outside the ${text}, ignoring. - x: [${point.x}], y: ${point.y}]`);
        }
        return false;
    }

    return true;
}

function validateDatumPointDirection(value: any, context: AnnotationAxisContext) {
    const domain = context.scale.getDomain?.();
    if (domain && OrdinalTimeScale.is(context.scale)) {
        return value >= domain[0] && value <= domain.at(-1);
    }
    return true; // domain.includes(value); // TODO: does not work with dates
}

export function isPoint(point: Point | undefined): point is Point {
    return point?.x != null && point?.y != null;
}
