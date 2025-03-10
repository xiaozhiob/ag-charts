import { _ModuleSupport } from 'ag-charts-community';

import { AnnotationType } from '../annotationTypes';
import { ShapePointProperties } from '../properties/shapePointProperties';

const { STRING, Validate, isObject } = _ModuleSupport;

export class ArrowUpProperties extends ShapePointProperties {
    static override is(this: void, value: unknown): value is ArrowUpProperties {
        return isObject(value) && value.type === AnnotationType.ArrowUp;
    }

    @Validate(STRING)
    type = AnnotationType.ArrowUp as const;
}
