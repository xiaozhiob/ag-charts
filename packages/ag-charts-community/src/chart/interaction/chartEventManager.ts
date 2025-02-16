import { BaseManager } from '../../util/baseManager';
import type { ChartAxisDirection } from '../chartAxisDirection';
import type { ChartLegendType } from '../legend/legendDatum';

type ChartEventType = 'legend-item-click' | 'legend-item-double-click' | 'axis-hover';
type ChartEvents = LegendItemClickChartEvent | LegendItemDoubleClickChartEvent | AxisHoverChartEvent;

interface ChartEvent<T> {
    type: T;
}

export interface LegendItemClickChartEvent extends ChartEvent<'legend-item-click'> {
    legendType: ChartLegendType;
    series: any;
    itemId: any;
    enabled: boolean;
    legendItemName?: string;
}

export interface LegendItemDoubleClickChartEvent extends ChartEvent<'legend-item-double-click'> {
    legendType: ChartLegendType;
    series: any;
    itemId: any;
    enabled: boolean;
    legendItemName?: string;
    numVisibleItems: number;
}

export interface AxisHoverChartEvent extends ChartEvent<'axis-hover'> {
    axisId: string;
    direction: ChartAxisDirection;
}

export class ChartEventManager extends BaseManager<ChartEventType, ChartEvents> {
    legendItemClick(legendType: ChartLegendType, series: any, itemId: any, enabled: boolean, legendItemName?: string) {
        const event: LegendItemClickChartEvent = {
            type: 'legend-item-click',
            legendType,
            series,
            itemId,
            enabled,
            legendItemName,
        };

        this.listeners.dispatch('legend-item-click', event);
    }

    legendItemDoubleClick(
        legendType: ChartLegendType,
        series: any,
        itemId: any,
        enabled: boolean,
        numVisibleItems: number,
        legendItemName?: string
    ) {
        const event: LegendItemDoubleClickChartEvent = {
            type: 'legend-item-double-click',
            legendType,
            series,
            itemId,
            enabled,
            legendItemName,
            numVisibleItems,
        };

        this.listeners.dispatch('legend-item-double-click', event);
    }

    axisHover(axisId: string, direction: ChartAxisDirection) {
        const event: AxisHoverChartEvent = {
            type: 'axis-hover',
            axisId,
            direction,
        };

        this.listeners.dispatch('axis-hover', event);
    }
}
