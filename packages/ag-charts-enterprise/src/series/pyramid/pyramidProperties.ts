import type {
    AgPyramidSeriesItemStylerParams,
    AgPyramidSeriesLabelFormatterParams,
    AgPyramidSeriesOptions,
    AgPyramidSeriesStyle,
    AgPyramidSeriesTooltipRendererParams,
    Direction,
    Styler,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

const {
    SeriesProperties,
    SeriesTooltip,
    Validate,
    UNION,
    COLOR_STRING_ARRAY,
    FUNCTION,
    DIRECTION,
    BOOLEAN,
    LINE_DASH,
    OBJECT,
    NUMBER,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
    Label,
    DropShadow,
} = _ModuleSupport;

class PyramidSeriesLabel extends Label<AgPyramidSeriesLabelFormatterParams> {}

class PyramidSeriesStageLabel extends Label<AgPyramidSeriesLabelFormatterParams> {
    @Validate(NUMBER)
    spacing: number = 0;

    @Validate(UNION(['before', 'after'], 'a placement'))
    placement?: string;
}

export class PyramidProperties extends SeriesProperties<AgPyramidSeriesOptions> {
    @Validate(STRING)
    stageKey!: string;

    @Validate(STRING)
    valueKey!: string;

    @Validate(COLOR_STRING_ARRAY)
    fills: string[] = [];

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING_ARRAY)
    strokes: string[] = [];

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;

    @Validate(DIRECTION)
    direction: Direction = 'vertical';

    @Validate(BOOLEAN, { optional: true })
    reverse?: boolean = undefined;

    @Validate(POSITIVE_NUMBER)
    spacing: number = 0;

    @Validate(POSITIVE_NUMBER, { optional: true })
    aspectRatio?: number = undefined;

    @Validate(FUNCTION, { optional: true })
    itemStyler?: Styler<AgPyramidSeriesItemStylerParams<unknown>, AgPyramidSeriesStyle>;

    @Validate(OBJECT)
    readonly shadow = new DropShadow().set({ enabled: false });

    @Validate(OBJECT)
    readonly label = new PyramidSeriesLabel();

    @Validate(OBJECT)
    readonly stageLabel = new PyramidSeriesStageLabel();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgPyramidSeriesTooltipRendererParams<unknown>>();
}
