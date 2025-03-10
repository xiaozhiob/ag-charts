import type {
    AgAnnotationLineStyleType,
    FontStyle,
    FontWeight,
    Formatter,
    PixelSize,
    TextAlign,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import type {
    AnnotationContext,
    AnnotationOptionsColorPickerType,
    ChannelTextPosition,
    Constructor,
    LineTextAlignment,
    LineTextPosition,
} from './annotationTypes';

const {
    BOOLEAN,
    COLOR_STRING,
    DATE,
    FONT_STYLE,
    FONT_WEIGHT,
    FUNCTION,
    LINE_DASH,
    LINE_STYLE,
    NUMBER,
    OBJECT,
    OR,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
    TEXT_ALIGN,
    UNION,
    BaseProperties,
    Validate,
    generateUUID,
} = _ModuleSupport;

/**************
 * Components *
 **************/
type XType = string | number | Date;
export class PointProperties extends BaseProperties {
    @Validate(OR(STRING, NUMBER, DATE))
    x?: XType;

    @Validate(NUMBER)
    y?: number;
}

export class ChannelAnnotationMiddleProperties extends Stroke(LineStyle(Visible(BaseProperties))) {}

export class AxisLabelProperties extends Stroke(LineStyle(Fill(Label(Font(BaseProperties))))) {
    @Validate(BOOLEAN)
    enabled?: boolean;

    @Validate(POSITIVE_NUMBER)
    cornerRadius: number = 2;
}

class BackgroundProperties extends Fill(BaseProperties) {}

class HandleProperties extends Stroke(LineStyle(Fill(BaseProperties))) {}

export class LineTextProperties extends Font(BaseProperties) {
    @Validate(STRING)
    label: string = '';

    @Validate(UNION(['top', 'center', 'bottom']), { optional: true })
    position?: LineTextPosition = 'top';

    @Validate(UNION(['left', 'center', 'right']), { optional: true })
    alignment?: LineTextAlignment = 'left';
}

export class ChannelTextProperties extends Font(BaseProperties) {
    @Validate(STRING)
    label: string = '';

    @Validate(UNION(['top', 'inside', 'bottom']), { optional: true })
    position?: ChannelTextPosition;

    @Validate(UNION(['left', 'center', 'right']), { optional: true })
    alignment?: LineTextAlignment;
}

export interface AxisLabelFormatterParams {
    readonly value: any;
}

/*******************************
 * Annotations specific mixins *
 *******************************/
export function Annotation<U extends Constructor<_ModuleSupport.BaseProperties>>(Parent: U) {
    abstract class AnnotationInternal extends Lockable(Visible(Parent)) {
        // A uuid is required, over the usual incrementing index, as annotations can be restored from external databases
        id = generateUUID();

        isValidWithContext(_context: AnnotationContext, warningPrefix?: string) {
            return super.isValid(warningPrefix);
        }

        abstract getDefaultColor(colorPickerType: AnnotationOptionsColorPickerType): string | undefined;
    }
    return AnnotationInternal;
}

export function Line<T extends Constructor>(Parent: T) {
    class LineInternal extends Parent {
        @Validate(OBJECT)
        start = new PointProperties();

        @Validate(OBJECT)
        end = new PointProperties();
    }
    return LineInternal;
}

export function Point<T extends Constructor>(Parent: T) {
    class PointInternal extends Parent {
        @Validate(OR(STRING, NUMBER, DATE))
        x?: XType;

        @Validate(NUMBER)
        y?: number;
    }
    return PointInternal;
}

export function Value<T extends Constructor>(Parent: T) {
    class ValueInternal extends Parent {
        @Validate(OR(STRING, NUMBER, DATE))
        value?: XType;
    }
    return ValueInternal;
}

export function Background<T extends Constructor>(Parent: T) {
    class BackgroundInternal extends Parent {
        @Validate(OBJECT, { optional: true })
        background = new BackgroundProperties();
    }
    return BackgroundInternal;
}

export function Handle<T extends Constructor>(Parent: T) {
    class HandleInternal extends Parent {
        @Validate(OBJECT, { optional: true })
        handle = new HandleProperties();
    }
    return HandleInternal;
}

export function AxisLabel<T extends Constructor>(Parent: T) {
    class AxisLabelInternal extends Parent {
        @Validate(OBJECT, { optional: true })
        axisLabel = new AxisLabelProperties();
    }
    return AxisLabelInternal;
}

export function Label<T extends Constructor>(Parent: T) {
    class LabelInternal extends Parent {
        @Validate(POSITIVE_NUMBER, { optional: true })
        padding?: number;

        @Validate(TEXT_ALIGN, { optional: true })
        textAlign: TextAlign = 'center';

        @Validate(FUNCTION, { optional: true })
        formatter?: Formatter<AxisLabelFormatterParams>; // TODO: making this generic causes issues with mixins sequence
    }
    return LabelInternal;
}

export function Cappable<T extends Constructor>(Parent: T) {
    class CappableInternal extends Parent {
        startCap?: 'arrow';
        endCap?: 'arrow';
    }
    return CappableInternal;
}

export function Extendable<T extends Constructor>(Parent: T) {
    class ExtendableInternal extends Parent {
        @Validate(BOOLEAN, { optional: true })
        extendStart?: boolean;

        @Validate(BOOLEAN, { optional: true })
        extendEnd?: boolean;
    }
    return ExtendableInternal;
}

function Lockable<T extends Constructor>(Parent: T) {
    class LockableInternal extends Parent {
        @Validate(BOOLEAN, { optional: true })
        locked?: boolean;
    }
    return LockableInternal;
}

export function Localisable<T extends Constructor>(Parent: T) {
    class LocalisableInternal extends Parent {
        localeManager?: _ModuleSupport.ModuleContext['localeManager'];

        setLocaleManager(localeManager: _ModuleSupport.ModuleContext['localeManager']) {
            this.localeManager ??= localeManager;
        }
    }
    return LocalisableInternal;
}

/******************
 * Generic mixins *
 ******************/
function Visible<T extends Constructor>(Parent: T) {
    class VisibleInternal extends Parent {
        @Validate(BOOLEAN, { optional: true })
        visible?: boolean;
    }
    return VisibleInternal;
}

export function Fill<T extends Constructor>(Parent: T) {
    class FillInternal extends Parent {
        @Validate(COLOR_STRING, { optional: true })
        fill?: string;

        @Validate(RATIO, { optional: true })
        fillOpacity?: number;
    }
    return FillInternal;
}

export function Stroke<T extends Constructor>(Parent: T) {
    class StrokeInternal extends Parent {
        @Validate(COLOR_STRING, { optional: true })
        stroke?: string;

        @Validate(RATIO, { optional: true })
        strokeOpacity?: number;

        @Validate(NUMBER, { optional: true })
        strokeWidth?: number;
    }
    return StrokeInternal;
}

export function LineStyle<T extends Constructor>(Parent: T) {
    class LineDashInternal extends Parent {
        lineCap?: _ModuleSupport.ShapeLineCap = undefined;
        computedLineDash?: PixelSize[] = undefined;

        @Validate(LINE_DASH, { optional: true })
        lineDash?: number[];

        @Validate(NUMBER, { optional: true })
        lineDashOffset?: number;

        @Validate(LINE_STYLE, { optional: true })
        lineStyle?: AgAnnotationLineStyleType;
    }
    return LineDashInternal;
}

export function Font<T extends Constructor>(Parent: T) {
    class FontInternal extends Parent {
        @Validate(FONT_STYLE, { optional: true })
        fontStyle?: FontStyle;

        @Validate(FONT_WEIGHT, { optional: true })
        fontWeight?: FontWeight;

        @Validate(POSITIVE_NUMBER)
        fontSize: number = 12;

        @Validate(STRING)
        fontFamily: string = 'Verdana, sans-serif';

        @Validate(COLOR_STRING, { optional: true })
        color?: string;
    }
    return FontInternal;
}
