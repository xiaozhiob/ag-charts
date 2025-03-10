import type {
    AgBaseRadialColumnSeriesOptions,
    AgRadialSeriesItemStylerParams,
    AgRadialSeriesLabelFormatterParams,
    AgRadialSeriesStyle,
    AgRadialSeriesTooltipRendererParams,
    Styler,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

const {
    SeriesProperties,
    SeriesTooltip,
    Validate,
    COLOR_STRING,
    DEGREE,
    FUNCTION,
    LINE_DASH,
    NUMBER,
    OBJECT,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
    Label,
} = _ModuleSupport;

export class RadialColumnSeriesBaseProperties<T extends AgBaseRadialColumnSeriesOptions> extends SeriesProperties<T> {
    @Validate(STRING)
    angleKey!: string;

    @Validate(STRING, { optional: true })
    angleName?: string;

    @Validate(STRING)
    radiusKey!: string;

    @Validate(STRING, { optional: true })
    radiusName?: string;

    @Validate(COLOR_STRING)
    fill: string = 'black';

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING)
    stroke: string = 'black';

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;

    @Validate(POSITIVE_NUMBER)
    cornerRadius: number = 0;

    @Validate(FUNCTION, { optional: true })
    itemStyler?: Styler<AgRadialSeriesItemStylerParams<unknown>, AgRadialSeriesStyle>;

    @Validate(DEGREE)
    rotation: number = 0;

    @Validate(STRING, { optional: true })
    stackGroup?: string;

    @Validate(NUMBER, { optional: true })
    normalizedTo?: number;

    @Validate(OBJECT)
    readonly label = new Label<AgRadialSeriesLabelFormatterParams>();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgRadialSeriesTooltipRendererParams<any>>();
}
