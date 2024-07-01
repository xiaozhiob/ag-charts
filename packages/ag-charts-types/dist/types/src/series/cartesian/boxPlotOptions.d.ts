import type { DatumCallbackParams, Styler } from '../../chart/callbackOptions';
import type { AgSeriesTooltip, AgSeriesTooltipRendererParams } from '../../chart/tooltipOptions';
import type { CssColor, PixelSize, Ratio } from '../../chart/types';
import type { AgBaseCartesianThemeableOptions, AgBaseSeriesOptions } from '../seriesOptions';
import type { FillOptions, LineDashOptions, StrokeOptions } from './commonOptions';
interface BoxPlotOptionsKeys {
    /** The key used to retrieve x-values (categories) from the data. */
    xKey: string;
    /** The key to use to retrieve minimum values from the data. */
    minKey: string;
    /** The key to use to retrieve lower quartile values from the data. */
    q1Key: string;
    /** The key to use to retrieve median values from the data. */
    medianKey: string;
    /** The key to use to retrieve upper quartile values from the data. */
    q3Key: string;
    /** The key to use to retrieve maximum values from the data. */
    maxKey: string;
}
interface BoxPlotOptionsNames {
    /** A descriptive label for x-values. */
    xName?: string;
    /** A descriptive label for y-values. */
    yName?: string;
    /** A human-readable description of minimum values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    minName?: string;
    /** A human-readable description of lower quartile values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    q1Name?: string;
    /** A human-readable description of median values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    medianName?: string;
    /** A human-readable description of upper quartile values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    q3Name?: string;
    /** A human-readable description of maximum values. If supplied, this will be shown in the default tooltip and passed to the tooltip renderer as one of the parameters. */
    maxName?: string;
}
export interface AgBoxPlotCapOptions {
    lengthRatio?: Ratio;
}
export type AgBoxPlotWhiskerOptions = StrokeOptions & LineDashOptions;
export type AgBoxPlotSeriesItemStylerParams<TDatum> = DatumCallbackParams<TDatum> & BoxPlotOptionsKeys & Required<AgBoxPlotSeriesStyle>;
export interface AgBoxPlotSeriesTooltipRendererParams<TDatum> extends BoxPlotOptionsKeys, BoxPlotOptionsNames, AgSeriesTooltipRendererParams<TDatum> {
    fill?: CssColor;
}
export interface AgBoxPlotSeriesStyle extends FillOptions, StrokeOptions, LineDashOptions {
    /** Apply rounded corners to each bar. */
    cornerRadius?: PixelSize;
    /** Options to style chart's caps */
    cap?: AgBoxPlotCapOptions;
    /** Options to style chart's whiskers */
    whisker?: AgBoxPlotWhiskerOptions;
}
export interface AgBoxPlotSeriesThemeableOptions<TDatum = any> extends AgBaseCartesianThemeableOptions<TDatum>, AgBoxPlotSeriesStyle {
    /**
     * Bar rendering direction.
     * __Note:__ This option affects the layout direction of X and Y data values.
     */
    direction?: 'horizontal' | 'vertical';
    /** Series-specific tooltip configuration. */
    tooltip?: AgSeriesTooltip<AgBoxPlotSeriesTooltipRendererParams<TDatum>>;
    /** Function used to return formatting for individual columns, based on the given parameters. If the current column is highlighted, the `highlighted` property will be set to `true`; make sure to check this if you want to differentiate between the highlighted and un-highlighted states. */
    itemStyler?: Styler<AgBoxPlotSeriesItemStylerParams<TDatum>, AgBoxPlotSeriesStyle>;
}
export interface AgBoxPlotSeriesOptions<TDatum = any> extends AgBoxPlotSeriesThemeableOptions<TDatum>, AgBaseSeriesOptions<TDatum>, BoxPlotOptionsKeys, BoxPlotOptionsNames {
    /** Configuration for the Box Plot Series. */
    type: 'box-plot';
    /** Whether to group together (adjacently) separate columns. */
    grouped?: boolean;
    /** Human-readable description of the y-values. If supplied, matching items with the same value will be toggled together. */
    legendItemName?: string;
}
export {};
