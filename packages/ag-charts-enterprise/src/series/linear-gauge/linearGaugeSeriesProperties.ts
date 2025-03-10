import { _ModuleSupport } from 'ag-charts-community';
import type {
    AgChartLabelFormatterParams,
    AgGaugeFillMode,
    AgLinearGaugeItemStylerParams,
    AgLinearGaugeLabelFormatterParams,
    AgLinearGaugeLabelPlacement,
    AgLinearGaugeMarkerShape,
    AgLinearGaugeOptions,
    AgLinearGaugeStyle,
    AgLinearGaugeTargetPlacement,
    AgLinearGaugeTooltipRendererParams,
    FontStyle,
    FontWeight,
    Formatter,
    OverflowStrategy,
    Styler,
    TextWrap,
} from 'ag-charts-types';

import { CORNER_MODE, FILL_MODE, TARGET_MARKER_SHAPE } from '../gauge-util/properties';
import { GaugeSegmentationProperties } from '../gauge-util/segmentation';
import { GaugeStopProperties } from '../gauge-util/stops';
import { AutoSizedLabel } from '../util/autoSizedLabel';

const {
    BaseProperties,
    SeriesTooltip,
    SeriesProperties,
    PropertiesArray,
    Validate,
    BOOLEAN,
    COLOR_STRING,
    COLOR_STRING_ARRAY,
    FUNCTION,
    LINE_DASH,
    NUMBER,
    OBJECT_ARRAY,
    OBJECT,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
    UNION,
    Label,
} = _ModuleSupport;

const TARGET_PLACEMENT = UNION(['before', 'after', 'middle'], 'a placement');
const LABEL_PLACEMENT = UNION(
    [
        'inside-start',
        'outside-start',
        'inside-end',
        'outside-end',
        'inside-center',
        'bar-inside',
        'bar-inside-end',
        'bar-outside-end',
        'bar-end',
    ],
    'an placement'
);
const DIRECTION = UNION(['horizontal', 'vertical'], 'an orientation');

export enum NodeDataType {
    Node,
    Target,
}

export interface LinearGaugeNodeDatum extends _ModuleSupport.SeriesNodeDatum {
    type: NodeDataType.Node;
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    clipX0: number | undefined;
    clipY0: number | undefined;
    clipX1: number | undefined;
    clipY1: number | undefined;
    topLeftCornerRadius: number;
    topRightCornerRadius: number;
    bottomRightCornerRadius: number;
    bottomLeftCornerRadius: number;
    fill: string | _ModuleSupport.Gradient | undefined;
    horizontalInset: number;
    verticalInset: number;
}

export interface LinearGaugeTargetDatumLabel {
    offsetX: number;
    offsetY: number;
    fill: string | undefined;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    fontStyle: FontStyle | undefined;
    fontWeight: FontWeight | undefined;
    fontSize: number;
    fontFamily: string;
    lineHeight: number | undefined;
}

export interface LinearGaugeTargetDatum extends _ModuleSupport.SeriesNodeDatum {
    type: NodeDataType.Target;
    value: number;
    text: string | undefined;
    x: number;
    y: number;
    shape: AgLinearGaugeMarkerShape;
    size: number;
    rotation: number;
    fill: string;
    fillOpacity: number;
    stroke: string;
    strokeOpacity: number;
    strokeWidth: number;
    lineDash: number[];
    lineDashOffset: number;
    label: LinearGaugeTargetDatumLabel;
}
export type LinearGaugeLabelDatum = {
    placement: AgLinearGaugeLabelPlacement;
    avoidCollisions: boolean;
    spacing: number;
    text: string | undefined;
    value: number;
    fill: string | undefined;
    fontStyle: FontStyle | undefined;
    fontWeight: FontWeight | undefined;
    fontSize: number;
    minimumFontSize: number | undefined;
    fontFamily: string;
    lineHeight: number | undefined;
    wrapping: TextWrap;
    overflowStrategy: OverflowStrategy;
    formatter:
        | Formatter<
              AgChartLabelFormatterParams<any> & _ModuleSupport.RequireOptional<AgLinearGaugeLabelFormatterParams>
          >
        | undefined;
};

class LinearGaugeDefaultTargetLabelProperties extends Label<never> {
    @Validate(NUMBER, { optional: true })
    spacing: number | undefined;
}

export class LinearGaugeTargetProperties extends BaseProperties {
    @Validate(STRING, { optional: true })
    text: string | undefined;

    @Validate(NUMBER)
    value: number = 0;

    @Validate(TARGET_MARKER_SHAPE, { optional: true })
    shape: AgLinearGaugeMarkerShape | undefined;

    @Validate(TARGET_PLACEMENT, { optional: true })
    placement: AgLinearGaugeTargetPlacement | undefined;

    @Validate(NUMBER, { optional: true })
    spacing: number | undefined;

    @Validate(POSITIVE_NUMBER, { optional: true })
    size: number | undefined;

    @Validate(NUMBER, { optional: true })
    rotation: number | undefined;

    @Validate(COLOR_STRING, { optional: true })
    fill: string | undefined;

    @Validate(RATIO, { optional: true })
    fillOpacity: number | undefined;

    @Validate(COLOR_STRING, { optional: true })
    stroke: string | undefined;

    @Validate(POSITIVE_NUMBER, { optional: true })
    strokeWidth: number | undefined;

    @Validate(RATIO, { optional: true })
    strokeOpacity: number | undefined;

    @Validate(LINE_DASH, { optional: true })
    lineDash: number[] | undefined;

    @Validate(POSITIVE_NUMBER, { optional: true })
    lineDashOffset: number | undefined;

    @Validate(OBJECT)
    readonly label = new LinearGaugeDefaultTargetLabelProperties();
}

class LinearGaugeBarProperties extends BaseProperties {
    @Validate(BOOLEAN)
    enabled = true;

    @Validate(POSITIVE_NUMBER, { optional: true })
    thickness: number | undefined;

    @Validate(RATIO)
    thicknessRatio: number = 1;

    @Validate(OBJECT_ARRAY)
    fills = new PropertiesArray<GaugeStopProperties>(GaugeStopProperties);

    @Validate(FILL_MODE)
    fillMode: AgGaugeFillMode = 'continuous';

    @Validate(COLOR_STRING, { optional: true })
    fill: string | undefined;

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING)
    stroke: string = 'black';

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 0;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;
}

class LinearGaugeScaleProperties extends BaseProperties {
    @Validate(OBJECT_ARRAY)
    fills = new PropertiesArray<GaugeStopProperties>(GaugeStopProperties);

    @Validate(FILL_MODE)
    fillMode: AgGaugeFillMode = 'continuous';

    @Validate(COLOR_STRING, { optional: true })
    fill: string | undefined;

    @Validate(RATIO)
    fillOpacity: number = 1;

    @Validate(COLOR_STRING)
    stroke: string = 'black';

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 0;

    @Validate(RATIO)
    strokeOpacity: number = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;

    @Validate(COLOR_STRING)
    defaultFill: string = 'black';
}

export class LinearGaugeLabelProperties extends AutoSizedLabel<AgLinearGaugeLabelFormatterParams> {
    @Validate(STRING, { optional: true })
    text?: string;

    @Validate(LABEL_PLACEMENT)
    placement: AgLinearGaugeLabelPlacement = 'inside-center';

    @Validate(BOOLEAN)
    avoidCollisions: boolean = true;
}

export class LinearGaugeSeriesProperties extends SeriesProperties<AgLinearGaugeOptions> {
    @Validate(NUMBER)
    value: number = 0;

    @Validate(OBJECT)
    readonly segmentation = new GaugeSegmentationProperties();

    @Validate(COLOR_STRING_ARRAY)
    defaultColorRange: string[] = [];

    @Validate(OBJECT_ARRAY)
    targets = new PropertiesArray<LinearGaugeTargetProperties>(LinearGaugeTargetProperties);

    @Validate(OBJECT)
    defaultTarget = new LinearGaugeTargetProperties();

    @Validate(DIRECTION)
    direction: 'horizontal' | 'vertical' = 'vertical';

    @Validate(POSITIVE_NUMBER)
    thickness: number = 1;

    @Validate(POSITIVE_NUMBER)
    cornerRadius: number = 0;

    @Validate(CORNER_MODE)
    cornerMode: 'container' | 'item' = 'container';

    @Validate(NUMBER)
    margin: number = 0;

    @Validate(OBJECT)
    readonly scale = new LinearGaugeScaleProperties();

    @Validate(OBJECT)
    readonly bar = new LinearGaugeBarProperties();

    @Validate(FUNCTION, { optional: true })
    itemStyler?: Styler<AgLinearGaugeItemStylerParams, AgLinearGaugeStyle>;

    @Validate(OBJECT)
    readonly label = new LinearGaugeLabelProperties();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgLinearGaugeTooltipRendererParams>();
}
