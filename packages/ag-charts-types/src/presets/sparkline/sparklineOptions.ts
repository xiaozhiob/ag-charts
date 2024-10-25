import type { AgAreaSeriesOptions } from '../../series/cartesian/areaOptions';
import type { AgBarSeriesOptions } from '../../series/cartesian/barOptions';
import type { AgLineSeriesOptions } from '../../series/cartesian/lineOptions';
import type { AgSparklineAxisOptions } from './sparklineAxisOptions';

export interface AgSparklineBaseThemeableOptions {
    /** x-axis configurations. */
    xAxis?: AgSparklineAxisOptions;
    /** y-axis configurations. */
    yAxis?: AgSparklineAxisOptions;
}

export interface AgBarSparklinePreset
    extends AgSparklineBaseThemeableOptions,
        Omit<
            AgBarSeriesOptions,
            'showInLegend' | 'showInMiniChart' | 'grouped' | 'stacked' | 'stackGroup' | 'errorBar'
        > {}
export interface AgLineSparklinePreset
    extends AgSparklineBaseThemeableOptions,
        Omit<AgLineSeriesOptions, 'showInLegend' | 'showInMiniChart' | 'stacked' | 'stackGroup' | 'errorBar'> {}
export interface AgAreaSparklinePreset
    extends AgSparklineBaseThemeableOptions,
        Omit<AgAreaSeriesOptions, 'showInLegend' | 'showInMiniChart' | 'stacked' | 'stackGroup'> {}

export type AgSparklinePresets = AgBarSparklinePreset | AgLineSparklinePreset | AgAreaSparklinePreset;
