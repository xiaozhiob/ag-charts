import type {
    AgBaseRadarSeriesOptions,
    AgRadarSeriesLabelFormatterParams,
    AgRadarSeriesTooltipRendererParams,
    AgRadialSeriesOptionsKeys,
} from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

export interface RadarNodeDatum extends _ModuleSupport.SeriesNodeDatum {
    readonly index: number;
    readonly label?: {
        text: string;
        x: number;
        y: number;
        textAlign: CanvasTextAlign;
        textBaseline: CanvasTextBaseline;
    };
    readonly point: Readonly<_ModuleSupport.SizedPoint>;
    readonly angleValue: any;
    readonly radiusValue: any;
}

const {
    Label,
    SeriesMarker,
    SeriesProperties,
    SeriesTooltip,
    Validate,
    BOOLEAN,
    COLOR_STRING,
    DEGREE,
    LINE_DASH,
    OBJECT,
    POSITIVE_NUMBER,
    RATIO,
    STRING,
} = _ModuleSupport;

export class RadarSeriesProperties<T extends AgBaseRadarSeriesOptions> extends SeriesProperties<T> {
    @Validate(STRING)
    angleKey!: string;

    @Validate(STRING)
    radiusKey!: string;

    @Validate(STRING, { optional: true })
    angleName?: string;

    @Validate(STRING, { optional: true })
    radiusName?: string;

    @Validate(COLOR_STRING)
    stroke: string = 'black';

    @Validate(POSITIVE_NUMBER)
    strokeWidth: number = 1;

    @Validate(RATIO)
    strokeOpacity = 1;

    @Validate(LINE_DASH)
    lineDash: number[] = [0];

    @Validate(POSITIVE_NUMBER)
    lineDashOffset: number = 0;

    @Validate(DEGREE)
    rotation: number = 0;

    @Validate(OBJECT)
    readonly marker = new SeriesMarker<AgRadialSeriesOptionsKeys>();

    @Validate(OBJECT)
    readonly label = new Label<AgRadarSeriesLabelFormatterParams>();

    @Validate(OBJECT)
    readonly tooltip = new SeriesTooltip<AgRadarSeriesTooltipRendererParams<any>>();

    @Validate(BOOLEAN)
    connectMissingData: boolean = false;
}
