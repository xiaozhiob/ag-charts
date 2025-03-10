import type { AgChartLegendListeners, AgMarkerShape } from 'ag-charts-types';

import type { Scene } from '../../scene/scene';

export interface ChartLegend {
    attachLegend(scene: Scene): void;
    destroy(): void;
    data: any;
    listeners?: AgChartLegendListeners;
    pagination?: {
        currentPage: number;
        setPage: (pageNumber: number) => void;
    };
}

export type ChartLegendType = 'category' | 'gradient';
export type ChartLegendDatum<T extends ChartLegendType> = T extends 'category'
    ? CategoryLegendDatum
    : T extends 'gradient'
      ? GradientLegendDatum
      : never;

export interface BaseChartLegendDatum {
    legendType: ChartLegendType;
    seriesId: string;
    enabled: boolean;
    hideInLegend?: boolean;
}

export interface LegendSymbolOptions {
    marker: {
        shape?: AgMarkerShape;
        fill?: string;
        stroke?: string;
        fillOpacity: number;
        strokeOpacity: number;
        strokeWidth: number;
        enabled?: boolean;
        padding?: number;
    };
    line?: {
        stroke: string;
        strokeOpacity: number;
        strokeWidth: number;
        lineDash: number[];
    };
}
export interface CategoryLegendDatum extends BaseChartLegendDatum {
    legendType: 'category';
    id: string; // component ID
    itemId: any; // sub-component ID
    datum?: any; // series datum
    symbols: LegendSymbolOptions[];
    /** Optional deduplication id - used to coordinate synced toggling of multiple items. */
    legendItemName?: string;
    label: {
        text: string; // display name for the sub-component
    };
    skipAnimations?: boolean;
}

export interface GradientLegendDatum extends BaseChartLegendDatum {
    legendType: 'gradient';
    enabled: boolean;
    seriesId: string;
    colorName?: string;
    colorDomain: number[];
    colorRange: string[];
}

/**
 * Internal Use Only: Used to ensure this file is treated as a module until we can use moduleDetection flag in Ts v4.7
 */
export const __FORCE_MODULE_DETECTION = 0;
