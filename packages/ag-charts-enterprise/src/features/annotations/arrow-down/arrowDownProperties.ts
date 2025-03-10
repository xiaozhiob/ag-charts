import { _ModuleSupport } from 'ag-charts-community';

import { AnnotationType } from '../annotationTypes';
import { ShapePointProperties } from '../properties/shapePointProperties';

const { STRING, Validate, isObject } = _ModuleSupport;

export class ArrowDownProperties extends ShapePointProperties {
    static override is(this: void, value: unknown): value is ArrowDownProperties {
        return isObject(value) && value.type === AnnotationType.ArrowDown;
    }

    @Validate(STRING)
    type = AnnotationType.ArrowDown as const;
}
