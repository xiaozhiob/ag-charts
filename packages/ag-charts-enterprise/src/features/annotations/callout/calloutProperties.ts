import { _ModuleSupport, _Scene, _Util } from 'ag-charts-community';

import { Fill, Stroke } from '../annotationProperties';
import { type AnnotationOptionsColorPickerType, AnnotationType } from '../annotationTypes';
import { TextualStartEndProperties } from '../properties/textualStartEndProperties';

const { STRING, Validate, isObject } = _ModuleSupport;
const { Color } = _Util;

export class CalloutProperties extends Fill(Stroke(TextualStartEndProperties)) {
    static is(value: unknown): value is CalloutProperties {
        return isObject(value) && value.type === AnnotationType.Callout;
    }

    @Validate(STRING)
    type = AnnotationType.Callout as const;

    override position = 'center' as const;
    override alignment = 'left' as const;

    override getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType) {
        switch (colorPickerType) {
            case `fill-color`:
                return this.fill;
            case `line-color`:
                return this.stroke;
            case `text-color`:
            default:
                return this.color;
        }
    }

    override getPlaceholderColor() {
        const { r, g, b } = Color.fromString(this.color ?? '#888888');
        return new Color(r, g, b, 0.66).toString();
    }
}
