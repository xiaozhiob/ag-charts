import type { AgAreaSeriesOptions } from './areaOptions';
import type { AgBarSeriesOptions } from './barOptions';
import type { AgBoxPlotSeriesOptions } from './boxPlotOptions';
import type { AgBubbleSeriesOptions } from './bubbleOptions';
import type { AgBulletSeriesOptions } from './bulletOptions';
import type { AgHeatmapSeriesOptions } from './heatmapOptions';
import type { AgHistogramSeriesOptions } from './histogramOptions';
import type { AgLineSeriesOptions } from './lineOptions';
import type { AgRangeAreaSeriesOptions } from './rangeAreaOptions';
import type { AgRangeBarSeriesOptions } from './rangeBarOptions';
import type { AgScatterSeriesOptions } from './scatterOptions';
import type { AgWaterfallSeriesOptions } from './waterfallOptions';

export type AgCartesianSeriesOptions =
    | AgLineSeriesOptions
    | AgScatterSeriesOptions
    | AgBubbleSeriesOptions
    | AgAreaSeriesOptions
    | AgBarSeriesOptions
    | AgBoxPlotSeriesOptions
    | AgHistogramSeriesOptions
    | AgHeatmapSeriesOptions
    | AgWaterfallSeriesOptions
    | AgRangeBarSeriesOptions
    | AgRangeAreaSeriesOptions
    | AgBulletSeriesOptions;
