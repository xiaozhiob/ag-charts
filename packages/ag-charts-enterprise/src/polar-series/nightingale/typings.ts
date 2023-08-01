import type {
    AgBaseSeriesOptions,
    AgChartLabelOptions,
    AgSeriesListeners,
    AgSeriesTooltip,
    AgSeriesTooltipRendererParams,
    AgTooltipRendererResult,
    CssColor,
    Opacity,
    PixelSize,
} from 'ag-charts-community';

/** Configuration for Nightingale series. */
export interface AgNightingaleSeriesOptions<DatumType = any> extends AgBaseSeriesOptions<DatumType> {
    type?: 'nightingale';
    /** The key to use to retrieve angle values from the data. */
    angleKey?: string;
    /** A human-readable description of the angle values. If supplied, this will be passed to the tooltip renderer as one of the parameters. */
    angleName?: string;
    /** The key to use to retrieve radius values from the data. */
    radiusKey?: string;
    /** A human-readable description of the radius values. If supplied, this will be passed to the tooltip renderer as one of the parameters. */
    radiusName?: string;

    /** Whether to group together (adjacently) separate sectors. */
    grouped?: boolean;
    /** An option indicating if the sectors should be stacked. */
    stacked?: boolean;
    /** An ID to be used to group stacked items. */
    stackGroup?: string;

    /** The colour of the stroke for the lines. */
    stroke?: CssColor;
    /** The width in pixels of the stroke for the lines. */
    strokeWidth?: PixelSize;
    /** The opacity of the stroke for the lines. */
    strokeOpacity?: Opacity;
    /** Defines how the line stroke is rendered. Every number in the array specifies the length in pixels of alternating dashes and gaps. For example, `[6, 3]` means dashes with a length of `6` pixels with gaps between of `3` pixels. */
    lineDash?: PixelSize[];
    /** The initial offset of the dashed line in pixels. */
    lineDashOffset?: PixelSize;
    /** Configuration for the labels shown on top of data points. */
    label?: AgNightingaleSeriesLabelOptions;
    /** Series-specific tooltip configuration. */
    tooltip?: AgNightingaleSeriesTooltip;
    /** A map of event names to event listeners. */
    listeners?: AgSeriesListeners<DatumType>;
    /** A formatter function for adjusting the styling of the nightingale sectors. */
    formatter?: (params: AgNightingaleSeriesFormatterParams<DatumType>) => AgNightingaleSeriesFormat;
}

export interface AgNightingaleSeriesTooltipRendererParams extends AgSeriesTooltipRendererParams {
    /** xKey as specified on series options. */
    readonly angleKey: string;
    /** xValue as read from series data via the xKey property. */
    readonly angleValue?: any;
    /** xName as specified on series options. */
    readonly angleName?: string;

    /** yKey as specified on series options. */
    readonly radiusKey: string;
    /** yValue as read from series data via the yKey property. */
    readonly radiusValue?: any;
    /** yName as specified on series options. */
    readonly radiusName?: string;
}

export interface AgNightingaleSeriesLabelFormatterParams {
    /** The ID of the series. */
    readonly seriesId: string;
    /** The value of radiusKey as specified on series options. */
    readonly value: number;
}

export interface AgNightingaleSeriesLabelOptions extends AgChartLabelOptions {
    /** Function used to turn 'yKey' values into text to be displayed by a label. By default the values are simply stringified. */
    formatter?: (params: AgNightingaleSeriesLabelFormatterParams) => string;
}

export interface AgNightingaleSeriesTooltip extends AgSeriesTooltip {
    /** Function used to create the content for tooltips. */
    renderer?: (params: AgNightingaleSeriesTooltipRendererParams) => string | AgTooltipRendererResult;
    format?: string;
}

export interface AgNightingaleSeriesFormatterParams<DatumType> {
    readonly datum: DatumType;
    readonly fill?: CssColor;
    readonly stroke?: CssColor;
    readonly strokeWidth: PixelSize;
    readonly highlighted: boolean;
    readonly angleKey: string;
    readonly radiusKey?: string;
    readonly sectorLabelKey?: string;
    readonly seriesId: string;
}

export interface AgNightingaleSeriesFormat {
    fill?: CssColor;
    fillOpacity?: Opacity;
    stroke?: CssColor;
    strokeWidth?: PixelSize;
}

/**
 * Internal Use Only: Used to ensure this file is treated as a module until we can use moduleDetection flag in Ts v4.7
 */
export const __FORCE_MODULE_DETECTION = 0;
