import type { AgInitialStateThemeableOptions } from '../api/initialStateOptions';
import type { AgLinearGaugeTarget, AgLinearGaugeThemeableOptions } from '../presets/gauge/linearGaugeOptions';
import type { AgRadialGaugeTarget, AgRadialGaugeThemeableOptions } from '../presets/gauge/radialGaugeOptions';
import type { AgAreaSeriesThemeableOptions } from '../series/cartesian/areaOptions';
import type { AgBarSeriesThemeableOptions } from '../series/cartesian/barOptions';
import type { AgBoxPlotSeriesThemeableOptions } from '../series/cartesian/boxPlotOptions';
import type { AgBubbleSeriesThemeableOptions } from '../series/cartesian/bubbleOptions';
import type { AgCandlestickSeriesThemeableOptions } from '../series/cartesian/candlestickOptions';
import type { AgBaseCartesianThemeOptions, AgCartesianAxesTheme } from '../series/cartesian/cartesianOptions';
import type { AgCartesianSeriesOptions } from '../series/cartesian/cartesianSeriesTypes';
import type { AgConeFunnelSeriesThemeableOptions } from '../series/cartesian/coneFunnelOptions';
import type { AgFunnelSeriesThemeableOptions } from '../series/cartesian/funnelOptions';
import type { AgHeatmapSeriesThemeableOptions } from '../series/cartesian/heatmapOptions';
import type { AgHistogramSeriesThemeableOptions } from '../series/cartesian/histogramOptions';
import type { AgLineSeriesThemeableOptions } from '../series/cartesian/lineOptions';
import type { AgOhlcSeriesThemeableOptions } from '../series/cartesian/ohlcOptions';
import type { AgRangeAreaSeriesThemeableOptions } from '../series/cartesian/rangeAreaOptions';
import type { AgRangeBarSeriesThemeableOptions } from '../series/cartesian/rangeBarOptions';
import type { AgScatterSeriesThemeableOptions } from '../series/cartesian/scatterOptions';
import type { AgWaterfallSeriesThemeableOptions } from '../series/cartesian/waterfallOptions';
import type { AgChordSeriesThemeableOptions } from '../series/flow-proportion/chordOptions';
import type { AgBaseFlowProportionThemeOptions } from '../series/flow-proportion/flowProportionOptions';
import type { AgSankeySeriesOptions, AgSankeySeriesThemeableOptions } from '../series/flow-proportion/sankeyOptions';
import type { AgBaseHierarchyThemeOptions, AgHierarchySeriesOptions } from '../series/hierarchy/hierarchyOptions';
import type { AgSunburstSeriesThemeableOptions } from '../series/hierarchy/sunburstOptions';
import type { AgTreemapSeriesThemeableOptions } from '../series/hierarchy/treemapOptions';
import type { AgDonutSeriesThemeableOptions } from '../series/polar/donutOptions';
import type { AgNightingaleSeriesThemeableOptions } from '../series/polar/nightingaleOptions';
import type { AgPieSeriesThemeableOptions } from '../series/polar/pieOptions';
import type { AgBasePolarThemeOptions, AgPolarAxesTheme, AgPolarSeriesOptions } from '../series/polar/polarOptions';
import type { AgRadarAreaSeriesThemeableOptions } from '../series/polar/radarAreaOptions';
import type { AgRadarSeriesThemeableOptions } from '../series/polar/radarOptions';
import type { AgRadialBarSeriesThemeableOptions } from '../series/polar/radialBarOptions';
import type { AgRadialColumnSeriesThemeableOptions } from '../series/polar/radialColumnOptions';
import type { AgPyramidSeriesThemeableOptions } from '../series/standalone/pyramidOptions';
import type { AgBaseStandaloneThemeOptions } from '../series/standalone/standaloneOptions';
import type { AgMapLineBackgroundThemeableOptions } from '../series/topology/mapLineBackgroundOptions';
import type { AgMapLineSeriesThemeableOptions } from '../series/topology/mapLineOptions';
import type { AgMapMarkerSeriesThemeableOptions } from '../series/topology/mapMarkerOptions';
import type { AgMapShapeBackgroundThemeableOptions } from '../series/topology/mapShapeBackgroundOptions';
import type { AgMapShapeSeriesThemeableOptions } from '../series/topology/mapShapeOptions';
import type { AgBaseTopologyThemeOptions } from '../series/topology/topologyOptions';
import type { AgAnnotationsThemeableOptions } from './annotationsOptions';
import type { AgBaseChartOptions, AgBaseThemeableChartOptions } from './chartOptions';
import type { AgLocaleThemeableOptions } from './localeOptions';
import type { CssColor } from './types';

export type AgChartThemeName =
    | 'ag-default'
    | 'ag-default-dark'
    | 'ag-sheets'
    | 'ag-sheets-dark'
    | 'ag-polychroma'
    | 'ag-polychroma-dark'
    | 'ag-vivid'
    | 'ag-vivid-dark'
    | 'ag-material'
    | 'ag-material-dark'
    | 'ag-financial'
    | 'ag-financial-dark';

export interface AgPaletteColors {
    fill?: CssColor;
    stroke?: CssColor;
}

/**
 * Palette used by the chart instance.
 */
export interface AgChartThemePalette {
    /** The array of fills to be used. */
    fills?: CssColor[];
    /** The array of strokes to be used. */
    strokes?: CssColor[];
    up?: AgPaletteColors;
    down?: AgPaletteColors;
    neutral?: AgPaletteColors;
}

export interface AgBaseChartThemeOptions {
    /** The palette to use. If specified, this replaces the palette from the base theme. */
    palette?: AgChartThemePalette;
    /** Configuration from this object is merged over the defaults specified in the base theme. */
    overrides?: AgThemeOverrides;
}

/** This object is used to define the configuration for a custom chart theme. */
export interface AgChartTheme extends AgBaseChartThemeOptions {
    /** The name of the theme to base your theme on. Your custom theme will inherit all the configuration from the base theme, allowing you to override just the settings you wish to change using the `overrides` config (see below). */
    baseTheme?: AgChartThemeName;
}

export interface AgLineSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgLineSeriesThemeableOptions;
}

export interface AgScatterSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgScatterSeriesThemeableOptions;
}
export interface AgBubbleSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgBubbleSeriesThemeableOptions;
}
export interface AgAreaSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgAreaSeriesThemeableOptions;
}
export interface AgBarSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgBarSeriesThemeableOptions;
}
export interface AgBoxPlotSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgBoxPlotSeriesThemeableOptions;
}
export interface AgCandlestickSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgCandlestickSeriesThemeableOptions;
}
export interface AgConeFunnelSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgConeFunnelSeriesThemeableOptions;
}
export interface AgFunnelSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgFunnelSeriesThemeableOptions;
}
export interface AgOhlcSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgOhlcSeriesThemeableOptions;
}
export interface AgHistogramSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgHistogramSeriesThemeableOptions;
}
export interface AgHeatmapSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgHeatmapSeriesThemeableOptions;
}
export interface AgWaterfallSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgWaterfallSeriesThemeableOptions;
}
export interface AgRangeBarSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgRangeBarSeriesThemeableOptions;
}
export interface AgRangeAreaSeriesThemeOverrides extends AgBaseCartesianThemeOptions {
    series?: AgRangeAreaSeriesThemeableOptions;
}
export interface AgDonutSeriesThemeOverrides extends AgBaseThemeableChartOptions {
    series?: AgDonutSeriesThemeableOptions;
}
export interface AgPieSeriesThemeOverrides extends AgBaseThemeableChartOptions {
    series?: AgPieSeriesThemeableOptions;
}
export interface AgRadarLineSeriesThemeOverrides extends AgBasePolarThemeOptions {
    series?: AgRadarSeriesThemeableOptions;
}
export interface AgRadarAreaSeriesThemeOverrides extends AgBasePolarThemeOptions {
    series?: AgRadarAreaSeriesThemeableOptions;
}
export interface AgRadialBarSeriesThemeOverrides extends AgBasePolarThemeOptions {
    series?: AgRadialBarSeriesThemeableOptions;
}
export interface AgRadialColumnSeriesThemeOverrides extends AgBasePolarThemeOptions {
    series?: AgRadialColumnSeriesThemeableOptions;
}
export interface AgNightingaleSeriesThemeOverrides extends AgBasePolarThemeOptions {
    series?: AgNightingaleSeriesThemeableOptions;
}
export interface AgSunburstSeriesThemeOverrides extends AgBaseHierarchyThemeOptions {
    series?: AgSunburstSeriesThemeableOptions;
}
export interface AgTreemapSeriesThemeOverrides extends AgBaseHierarchyThemeOptions {
    series?: AgTreemapSeriesThemeableOptions;
}
export interface AgMapShapeSeriesThemeOverrides extends AgBaseTopologyThemeOptions {
    series?: AgMapShapeSeriesThemeableOptions;
}
export interface AgMapLineSeriesThemeOverrides extends AgBaseTopologyThemeOptions {
    series?: AgMapLineSeriesThemeableOptions;
}
export interface AgMapMarkerSeriesThemeOverrides extends AgBaseTopologyThemeOptions {
    series?: AgMapMarkerSeriesThemeableOptions;
}
export interface AgMapShapeBackgroundThemeOverrides extends AgBaseTopologyThemeOptions {
    series?: AgMapShapeBackgroundThemeableOptions;
}
export interface AgMapLineBackgroundThemeOverrides extends AgBaseTopologyThemeOptions {
    series?: AgMapLineBackgroundThemeableOptions;
}
export interface AgSankeyThemeOverrides extends AgBaseFlowProportionThemeOptions {
    series?: AgSankeySeriesThemeableOptions;
}
export interface AgChordThemeOverrides extends AgBaseFlowProportionThemeOptions {
    series?: AgChordSeriesThemeableOptions;
}
export interface AgPyramidThemeOverrides extends AgBaseStandaloneThemeOptions {
    series?: AgPyramidSeriesThemeableOptions;
}

export type AgBaseGaugePresetThemeOptions = Pick<
    AgBaseChartOptions<any>,
    | 'animation'
    | 'background'
    | 'container'
    | 'contextMenu'
    | 'footnote'
    | 'height'
    | 'listeners'
    | 'locale'
    | 'minHeight'
    | 'minWidth'
    | 'padding'
    | 'subtitle'
    | 'title'
    | 'width'
>;

// Interface needed for docs generation, but listeners conflicts using the extends clause
type AgRadialGaugeTheme = AgBaseGaugePresetThemeOptions & AgRadialGaugeThemeableOptions;
export interface AgRadialGaugeTargetTheme extends Omit<AgRadialGaugeTarget, 'value' | 'text'> {}
export interface AgRadialGaugeThemeOverrides extends AgRadialGaugeTheme {
    targets?: AgRadialGaugeTargetTheme;
}

type AgLinearGaugeTheme = AgBaseGaugePresetThemeOptions & AgLinearGaugeThemeableOptions;
export interface AgLinearGaugeTargetTheme extends Omit<AgLinearGaugeTarget, 'value' | 'text'> {}
export interface AgLinearGaugeThemeOverrides extends AgLinearGaugeTheme {
    targets?: AgLinearGaugeTargetTheme;
}

export interface AgCommonThemeableAxisOptions extends AgCartesianAxesTheme, AgPolarAxesTheme {}

export interface AgCommonThemeableChartOptions extends AgBaseThemeableChartOptions {
    axes?: AgCommonThemeableAxisOptions;
    annotations?: AgAnnotationsThemeableOptions;
    initialState?: AgInitialStateThemeableOptions;
    locale?: AgLocaleThemeableOptions;
}

export type AgGaugeThemeOverrides = AgRadialGaugeThemeOverrides | AgLinearGaugeThemeOverrides;

export interface AgChartThemeOverrides {
    /** Common theme overrides for series. */
    common?: AgCommonThemeableChartOptions;

    /** Line series theme overrides. */
    line?: AgLineSeriesThemeOverrides;
    /** Scatter series theme overrides. */
    scatter?: AgScatterSeriesThemeOverrides;
    /** Bubble series theme overrides. */
    bubble?: AgBubbleSeriesThemeOverrides;
    /** Area series theme overrides. */
    area?: AgAreaSeriesThemeOverrides;
    /** Bar series theme overrides. */
    bar?: AgBarSeriesThemeOverrides;
    /** Box-plot series theme overrides. */
    'box-plot'?: AgBoxPlotSeriesThemeOverrides;
    /** Candlestick series theme overrides. */
    candlestick?: AgCandlestickSeriesThemeOverrides;
    /** Cone Funnel series theme overrides. */
    'cone-funnel'?: AgConeFunnelSeriesThemeOverrides;
    /** Funnel series theme overrides. */
    funnel?: AgFunnelSeriesThemeOverrides;
    /** ohlc series theme overrides. */
    ohlc?: AgOhlcSeriesThemeOverrides;
    /** Histogram series theme overrides. */
    histogram?: AgHistogramSeriesThemeOverrides;
    /** Heatmap series theme overrides. */
    heatmap?: AgHeatmapSeriesThemeOverrides;
    /** Waterfall series theme overrides. */
    waterfall?: AgWaterfallSeriesThemeOverrides;
    /** Range-bar series theme overrides. */
    'range-bar'?: AgRangeBarSeriesThemeOverrides;
    /** Range-area series theme overrides. */
    'range-area'?: AgRangeAreaSeriesThemeOverrides;
    /** Donut series theme overrides. */
    donut?: AgDonutSeriesThemeOverrides;
    /** Pie series theme overrides. */
    pie?: AgPieSeriesThemeOverrides;
    /** Radar-line series theme overrides. */
    'radar-line'?: AgRadarLineSeriesThemeOverrides;
    /** Radar-area series theme overrides. */
    'radar-area'?: AgRadarAreaSeriesThemeOverrides;
    /** Radial-bar series theme overrides. */
    'radial-bar'?: AgRadialBarSeriesThemeOverrides;
    /** Radial-column series theme overrides. */
    'radial-column'?: AgRadialColumnSeriesThemeOverrides;
    /** Nightingale series theme overrides. */
    nightingale?: AgNightingaleSeriesThemeOverrides;
    /** Sunburst series theme overrides. */
    sunburst?: AgSunburstSeriesThemeOverrides;
    /** Treemap series theme overrides. */
    treemap?: AgTreemapSeriesThemeOverrides;
    /** Map shape series theme overrides. */
    'map-shape'?: AgMapShapeSeriesThemeOverrides;
    /** Map line series theme overrides. */
    'map-line'?: AgMapLineSeriesThemeOverrides;
    /** Map marker series theme overrides. */
    'map-marker'?: AgMapMarkerSeriesThemeOverrides;
    /** Map shape background series theme overrides. */
    'map-shape-background'?: AgMapShapeBackgroundThemeOverrides;
    /** Map line background series theme overrides. */
    'map-line-background'?: AgMapLineBackgroundThemeOverrides;
    /** Sankey series theme overrides. */
    sankey?: AgSankeyThemeOverrides;
    /** Chord series theme overrides. */
    chord?: AgChordThemeOverrides;
    /** Pyramid series theme overrides. */
    pyramid?: AgPyramidThemeOverrides;
}

export interface AgPresetOverrides {
    /** Radial gauge theme overrides. */
    'radial-gauge'?: AgRadialGaugeThemeOverrides;
    /** Linear Gauge theme overrides. */
    'linear-gauge'?: AgLinearGaugeThemeOverrides;
}

export interface AgThemeOverrides extends AgChartThemeOverrides, AgPresetOverrides {}

// Use Typescript function types to verify that all series types are present in the manually
// maintained AgBaseChartThemeOverrides type.
type VerifyAgBaseChartThemeOverrides<T = AgBaseChartOptions> = {
    [K in NonNullable<AgCartesianSeriesOptions['type']>]?: T;
} & {
    [K in NonNullable<AgPolarSeriesOptions['type']>]?: T;
} & {
    [K in NonNullable<AgHierarchySeriesOptions['type']>]?: T;
} & {
    [K in NonNullable<AgSankeySeriesOptions['type']>]?: T;
} & {
    common?: Partial<T>;
};

// Verification checks for completeness/correctness.
const __THEME_OVERRIDES = undefined as any as Required<AgChartThemeOverrides>;
// @ts-expect-error TS6133 - this is used to validate completeness by the compiler, but is deliberately unused.
let __VERIFY_THEME_OVERRIDES: Required<VerifyAgBaseChartThemeOverrides> = undefined as any;
__VERIFY_THEME_OVERRIDES = __THEME_OVERRIDES;
