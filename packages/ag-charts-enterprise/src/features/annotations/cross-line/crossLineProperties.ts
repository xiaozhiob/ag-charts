import { type PixelSize, _ModuleSupport } from 'ag-charts-community';

import { Annotation, AxisLabel, Handle, LineStyle, LineTextProperties, Stroke, Value } from '../annotationProperties';
import { type AnnotationContext, AnnotationType } from '../annotationTypes';
import { getLineCap, getLineDash } from '../utils/line';
import { validateDatumValue } from '../utils/validation';

const { OBJECT, STRING, BaseProperties, Validate, isObject } = _ModuleSupport;

export class HorizontalLineProperties extends Annotation(Value(Handle(AxisLabel(Stroke(LineStyle(BaseProperties)))))) {
    readonly direction = 'horizontal';

    static is(this: void, value: unknown): value is HorizontalLineProperties {
        return isObject(value) && value.type === AnnotationType.HorizontalLine;
    }

    @Validate(STRING)
    type = AnnotationType.HorizontalLine as const;

    @Validate(OBJECT, { optional: true })
    text = new LineTextProperties();

    override isValidWithContext(context: AnnotationContext, warningPrefix: string) {
        return super.isValid(warningPrefix) && validateDatumValue(context, this, warningPrefix);
    }

    getDefaultColor() {
        return this.stroke;
    }

    getDefaultOpacity() {
        return this.strokeOpacity;
    }

    getLineDash(): PixelSize[] | undefined {
        return getLineDash(this.lineDash, this.computedLineDash, this.lineStyle, this.strokeWidth);
    }

    getLineCap(): _ModuleSupport.ShapeLineCap | undefined {
        return getLineCap(this.lineCap, this.lineDash, this.lineStyle);
    }
}

export class VerticalLineProperties extends Annotation(Value(Handle(AxisLabel(Stroke(LineStyle(BaseProperties)))))) {
    readonly direction = 'vertical';

    static is(this: void, value: unknown): value is VerticalLineProperties {
        return isObject(value) && value.type === AnnotationType.VerticalLine;
    }

    @Validate(STRING)
    type = AnnotationType.VerticalLine as const;

    @Validate(OBJECT, { optional: true })
    text = new LineTextProperties();

    override isValidWithContext(context: AnnotationContext, warningPrefix: string) {
        return super.isValid(warningPrefix) && validateDatumValue(context, this, warningPrefix);
    }

    getDefaultColor() {
        return this.stroke;
    }

    getDefaultOpacity() {
        return this.strokeOpacity;
    }

    getLineDash(): PixelSize[] | undefined {
        return getLineDash(this.lineDash, this.computedLineDash, this.lineStyle, this.strokeWidth);
    }

    getLineCap(): _ModuleSupport.ShapeLineCap | undefined {
        return getLineCap(this.lineCap, this.lineDash, this.lineStyle);
    }
}

export type CrossLineProperties = HorizontalLineProperties | VerticalLineProperties;
