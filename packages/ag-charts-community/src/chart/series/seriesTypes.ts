import type { AgContextMenuOptions } from 'ag-charts-types';

import type { BBox } from '../../scene/bbox';
import type { Group } from '../../scene/group';
import type { Point, SizedPoint } from '../../scene/point';
import type { ChartAxisDirection } from '../chartAxisDirection';
import type { ChartLegendDatum, ChartLegendType } from '../legend/legendDatum';
import type { TooltipContent } from '../tooltip/tooltip';

// Breaks circular dependency between ISeries and ChartAxis.
interface ChartAxisLike {
    id: string;
}

// Ensure that the created contextmenu event matches the API option contract:
type NodeContextMenuActionEvent = Parameters<
    NonNullable<AgContextMenuOptions['extraNodeActions']>[number]['action']
>[0];

export interface ISeries<TDatum, TProps> {
    id: string;
    axes: Record<ChartAxisDirection, ChartAxisLike | undefined>;
    contentGroup: Group;
    properties: TProps;
    hasEventListener(type: string): boolean;
    update(opts: { seriesRect?: BBox }): Promise<void> | void;
    fireNodeClickEvent(event: Event, datum: SeriesNodeDatum): void;
    fireNodeDoubleClickEvent(event: Event, datum: SeriesNodeDatum): void;
    createNodeContextMenuActionEvent(event: Event, datum: TDatum): NodeContextMenuActionEvent;
    getLegendData<T extends ChartLegendType>(legendType: T): ChartLegendDatum<T>[];
    getLegendData(legendType: ChartLegendType): ChartLegendDatum<ChartLegendType>[];
    getTooltipHtml(seriesDatum: any): TooltipContent;
    getDatumAriaText?(seriesDatum: TDatum, description: string): string | undefined;
    // BoundSeries
    getBandScalePadding?(): { inner: number; outer: number };
    getDomain(direction: ChartAxisDirection): any[];
    getKeys(direction: ChartAxisDirection): string[];
    getKeyProperties(direction: ChartAxisDirection): string[];
    getNames(direction: ChartAxisDirection): (string | undefined)[];
    getMinRects(width: number, height: number): { minRect: BBox; minVisibleRect: BBox } | undefined;
    datumMidPoint?<T extends SeriesNodeDatum>(datum: T): Point | undefined;
    isEnabled(): boolean;
    type: string;
    visible: boolean;
}

/**
 * Processed series datum used in node selections,
 * contains information used to render pie sectors, bars, markers, etc.
 */
export interface SeriesNodeDatum {
    readonly series: ISeries<any, any>;
    readonly itemId?: any;
    readonly datum: any;
    readonly point?: Readonly<Point> & SizedPoint;
    readonly missing?: boolean;
    readonly enabled?: boolean;
    readonly focusable?: boolean;
    midPoint?: Readonly<Point>;
}

export interface ErrorBoundSeriesNodeDatum {
    // Caps can appear on bar, line and scatter series. The length is determined
    // by the size of the marker (line, scatter), width of the bar (vertical
    // bars), or height of the bar (horizontal bars).
    readonly capDefaults: { lengthRatioMultiplier: number; lengthMax: number };
    readonly cumulativeValue?: number;
    xBar?: { lowerPoint: Point; upperPoint: Point };
    yBar?: { lowerPoint: Point; upperPoint: Point };
}

export type NodeDataDependencies = { seriesRectWidth: number; seriesRectHeight: number };
export type NodeDataDependant = { readonly nodeDataDependencies: NodeDataDependencies };
