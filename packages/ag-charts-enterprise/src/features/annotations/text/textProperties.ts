import { _ModuleSupport } from 'ag-charts-community';

import { AnnotationType } from '../annotationTypes';
import { TextualPointProperties } from '../properties/textualPointProperties';

const { STRING, Validate, isObject } = _ModuleSupport;

export class TextProperties extends TextualPointProperties {
    static is(this: void, value: unknown): value is TextProperties {
        return isObject(value) && value.type === AnnotationType.Text;
    }

    @Validate(STRING)
    type = AnnotationType.Text as const;

    override position = 'bottom' as const;
}
