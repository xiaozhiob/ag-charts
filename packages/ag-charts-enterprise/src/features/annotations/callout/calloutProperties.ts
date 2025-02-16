import { _ModuleSupport } from 'ag-charts-community';

import { Fill, Stroke } from '../annotationProperties';
import {
    type AnnotationContext,
    type AnnotationOptionsColorPickerType,
    AnnotationType,
    type Padding,
} from '../annotationTypes';
import { TextualStartEndProperties } from '../properties/textualStartEndProperties';

const { STRING, Validate, isObject, Color } = _ModuleSupport;

const DEFAULT_CALLOUT_PADDING = {
    top: 6,
    right: 12,
    bottom: 9,
    left: 12,
};

export class CalloutProperties extends Fill(Stroke(TextualStartEndProperties)) {
    static is(this: void, value: unknown): value is CalloutProperties {
        return isObject(value) && value.type === AnnotationType.Callout;
    }

    @Validate(STRING)
    type = AnnotationType.Callout as const;

    override position = 'bottom' as const;
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

    override getDefaultOpacity(colorPickerType: AnnotationOptionsColorPickerType) {
        switch (colorPickerType) {
            case `fill-color`:
                return this.fillOpacity;
            case `line-color`:
                return this.strokeOpacity;
            case `text-color`:
            default:
                return undefined;
        }
    }

    override getPlaceholderColor() {
        const { r, g, b } = Color.fromString(this.color ?? '#888888');
        return new Color(r, g, b, 0.66).toString();
    }

    override getPadding(): Padding {
        const { padding } = this;
        if (padding == null) {
            return { ...DEFAULT_CALLOUT_PADDING };
        }

        return {
            top: padding,
            right: padding,
            bottom: padding,
            left: padding,
        };
    }

    override getTextInputCoords(context: AnnotationContext, height: number) {
        const coords = super.getTextInputCoords(context, height);
        const padding = this.getPadding();

        const paddingLeft = typeof padding === 'number' ? padding : padding?.left ?? 0;
        const paddingBottom = typeof padding === 'number' ? padding : padding?.bottom ?? 0;

        return {
            x: coords.x + paddingLeft,
            y: coords.y - paddingBottom,
        };
    }
}
