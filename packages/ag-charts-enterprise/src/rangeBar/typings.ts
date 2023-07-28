import type {
    AgBaseSeriesOptions,
    AgSeriesListeners,
    AgSeriesHighlightStyle,
    AgSeriesTooltip,
    AgCartesianSeriesTooltipRendererParams,
    AgTooltipRendererResult,
    AgCartesianSeriesLabelOptions,
    CssColor,
    PixelSize,
    Opacity,
    AgDropShadowOptions,
} from 'ag-charts-community';

export interface AgRangeBarSeriesFormatterParams<DatumType> {
    readonly datum: DatumType;
    readonly minValue: number;
    readonly maxValue: number;
    readonly fill?: CssColor;
    readonly stroke?: CssColor;
    readonly strokeWidth: PixelSize;
    readonly highlighted: boolean;
    readonly xKey: string;
    readonly yMinKey: string;
    readonly yMaxKey: string;
    readonly labelKey?: string;
    readonly seriesId: string;
    readonly itemId: string;
}

export interface AgRangeBarSeriesFormat {
    fill?: CssColor;
    stroke?: CssColor;
    strokeWidth?: PixelSize;
}

export interface AgRangeBarSeriesTooltipRendererParams
    extends Omit<AgCartesianSeriesTooltipRendererParams, 'yKey' | 'yValue' | 'yName'> {
    /** The Id to distinguish the type of datum. This can be `positive`, `negative`, `total` or `subtotal`. */
    itemId: string;

    /** yKey as specified on series options. */
    readonly yMinKey: string;
    /** yValue as read from series data via the yKey property. */
    readonly yMinValue?: any;
    /** yName as specified on series options. */
    readonly yMinName?: string;

    /** yKey as specified on series options. */
    readonly yMaxKey: string;
    /** yValue as read from series data via the yKey property. */
    readonly yMaxValue?: any;
    /** yName as specified on series options. */
    readonly yMaxName?: string;
}

export interface AgRangeBarSeriesTooltip extends AgSeriesTooltip {
    /** Function used to create the content for tooltips. */
    renderer?: (params: AgRangeBarSeriesTooltipRendererParams) => string | AgTooltipRendererResult;
}

export interface AgRangeBarSeriesLabelOptions extends AgCartesianSeriesLabelOptions {
    /** Padding in pixels between the label and the edge of the bar. */
    padding?: PixelSize;
}

/** Configuration for RangeBar series. */
export interface AgRangeBarSeriesOptions<DatumType = any> extends AgBaseSeriesOptions<DatumType> {
    /** Configuration for the RangeBar series. */
    type?: 'range-bar' | 'range-column';
    /** The key to use to retrieve x-values from the data. */
    xKey?: string;
    /** The key to use to retrieve y-min-values from the data. */
    yMinKey?: string;
    /** The key to use to retrieve y-max-values from the data. */
    yMaxKey?: string;
    /** A human-readable description of the x-values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    xName?: string;
    /** A human-readable description of the y-min-values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    yMinName?: string;
    /** A human-readable description of the y-max-values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    yMaxName?: string;
    /** The title to use for the series. Defaults to `yName` if it exists, or `yKey` if not. */
    title?: string;
    /** Series-specific tooltip configuration. */
    tooltip?: AgRangeBarSeriesTooltip;
    /** A map of event names to event listeners. */
    listeners?: AgSeriesListeners<DatumType>;
    /** Configuration for the range series items when they are hovered over. */
    highlightStyle?: AgSeriesHighlightStyle;
    /** Configuration for the labels shown on top of data points. */
    label?: AgRangeBarSeriesLabelOptions;
    /** The fill colour to use for the bars. */
    fill?: CssColor;
    /** Opacity of the bars. */
    fillOpacity?: Opacity;
    /** The colour to use for the bars. */
    stroke?: CssColor;
    /** The width in pixels of the bars. */
    strokeWidth?: PixelSize;
    /** Opacity of the bars. */
    strokeOpacity?: Opacity;
    /** Defines how the strokes are rendered. Every number in the array specifies the length in pixels of alternating dashes and gaps. For example, `[6, 3]` means dashes with a length of `6` pixels with gaps between of `3` pixels. */
    lineDash?: PixelSize[];
    /** The initial offset of the dashed line in pixels. */
    lineDashOffset?: PixelSize;
    /** Configuration for the shadow used behind the series items. */
    shadow?: AgDropShadowOptions;
    /** Function used to return formatting for individual RangeBar series item cells, based on the given parameters. If the current cell is highlighted, the `highlighted` property will be set to `true`; make sure to check this if you want to differentiate between the highlighted and un-highlighted states. */
    formatter?: (params: AgRangeBarSeriesFormatterParams<DatumType>) => AgRangeBarSeriesFormat;
}

/**
 * Internal Use Only: Used to ensure this file is treated as a module until we can use moduleDetection flag in Ts v4.7
 */
export const __FORCE_MODULE_DETECTION = 0;
