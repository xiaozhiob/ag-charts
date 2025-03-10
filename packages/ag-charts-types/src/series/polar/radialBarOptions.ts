import type { AgBaseSeriesOptions } from '../seriesOptions';
import type {
    AgBaseRadialSeriesThemeableOptions,
    AgRadialSeriesOptionsKeys,
    AgRadialSeriesOptionsNames,
} from './radialOptions';

export type AgRadialBarSeriesThemeableOptions<TDatum = any> = AgBaseRadialSeriesThemeableOptions<TDatum>;

export interface AgRadialBarSeriesOptions<TDatum = any>
    extends AgBaseSeriesOptions<TDatum>,
        AgRadialSeriesOptionsKeys,
        AgRadialSeriesOptionsNames,
        AgBaseRadialSeriesThemeableOptions<TDatum> {
    /** Configuration for Radial Bar Series. */
    type: 'radial-bar';
    /** The number to normalise the bar stacks to. Has no effect unless series are stacked. */
    normalizedTo?: number;
    /** Whether to group together (adjacently) separate sectors. */
    grouped?: boolean;
    /** An option indicating if the sectors should be stacked. */
    stacked?: boolean;
    /** An ID to be used to group stacked items. */
    stackGroup?: string;
}
