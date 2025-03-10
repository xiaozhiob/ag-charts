import type {
    AgFunnelSeriesItemStylerParams,
    AgFunnelSeriesLabelFormatterParams,
    AgFunnelSeriesOptions,
    AgFunnelSeriesStyle,
    AgFunnelSeriesTooltipRendererParams,
    Styler,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import type { BaseFunnelProperties } from './baseFunnelSeriesProperties';

const {
    Label,
    DropShadow,
    AbstractBarSeriesProperties,
    BaseProperties,
    SeriesTooltip,
    AxisLabel,
    Validate,
    UNION,
    BOOLEAN,
    COLOR_STRING_ARRAY,
    COLOR_STRING,
    FUNCTION,
    LINE_DASH,
    OBJECT,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
} = _ModuleSupport;

class FunnelSeriesLabel extends Label<AgFunnelSeriesLabelFormatterParams> {}

class FunnelSeriesStageLabel extends AxisLabel {
    @Validate(UNION(['before', 'after'], 'a placement'))
    placement?: string;
}

class FunnelDropOff extends BaseProperties {
    @Validate(BOOLEAN)
    enabled: boolean = true;

    @Validate(COLOR_STRING, { optional: true })
    fill: string | undefined;

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING, { optional: true })
    stroke: string | undefined;

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;
}

export class FunnelProperties
    extends AbstractBarSeriesProperties<AgFunnelSeriesOptions>
    implements BaseFunnelProperties<AgFunnelSeriesOptions>
{
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

    @Validate(RATIO)
    spacingRatio: number = 0;

    @Validate(FUNCTION, { optional: true })
    itemStyler?: Styler<AgFunnelSeriesItemStylerParams<unknown>, AgFunnelSeriesStyle>;

    @Validate(OBJECT)
    readonly dropOff = new FunnelDropOff();

    @Validate(OBJECT)
    readonly shadow = new DropShadow().set({ enabled: false });

    @Validate(OBJECT)
    readonly label = new FunnelSeriesLabel();

    @Validate(OBJECT)
    readonly stageLabel = new FunnelSeriesStageLabel();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgFunnelSeriesTooltipRendererParams<unknown>>();
}
