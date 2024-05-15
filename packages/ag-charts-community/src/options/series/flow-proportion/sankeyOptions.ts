import type { AgChartCallbackParams } from '../../chart/callbackOptions';
import type { AgSeriesTooltipRendererParams } from '../../chart/tooltipOptions';
import type { CssColor, PixelSize } from '../../chart/types';
import type { FillOptions, LineDashOptions, StrokeOptions } from '../cartesian/commonOptions';
import type { AgBaseSeriesOptions } from '../seriesOptions';

export interface AgSankeySeriesOptions<TDatum = any>
    extends AgBaseSeriesOptions<TDatum>,
        AgSankeySeriesOptionsKeys,
        AgSankeySeriesThemeableOptions<TDatum> {
    /** Configuration for the Sankey Series. */
    type: 'sankey';
    /** Node options */
    nodes?: any[];
}

export interface AgSankeySeriesThemeableOptions<_TDatum = any> {
    /** The colours to cycle through for the fills of the nodes and links. */
    fills?: CssColor[];
    /** The colours to cycle through for the strokes of the nodes and links. */
    strokes?: CssColor[];
    /** Options for the links */
    link?: AgSankeySeriesLinkOptions;
    /** Options for the nodes */
    node?: AgSankeySeriesNodeOptions;
}

export interface AgSankeySeriesLinkStyle extends FillOptions, StrokeOptions, LineDashOptions {}

export interface AgSankeySeriesLinkOptions extends AgSankeySeriesLinkStyle {}
export interface AgSankeySeriesNodeOptions extends FillOptions, StrokeOptions, LineDashOptions {
    /** Minimum spacing of the nodes */
    spacing?: PixelSize;
    /** Width of the nodes */
    width?: PixelSize;
    /** Justification of the nodes */
    justify?: 'left' | 'right' | 'center' | 'justify';
}

export interface AgSankeySeriesOptionsKeys {
    /** The name of the node key containing the from id. */
    fromIdKey?: string;
    /** The name of the node key containing the to id. */
    toIdKey?: string;
    /** The name of the node key containing the size. */
    sizeKey?: string;
    /** The name of the node key containing the node id. */
    nodeIdKey?: string;
    /** The name of the node key containing the node label. */
    labelKey?: string;
    /** The name of the node key containing the node size. */
    nodeSizeKey?: string;
    /** The name of the node key containing the node position. */
    positionKey?: string;
}

export interface AgSankeySeriesOptionsNames {
    /** The name of the node key containing the from id. */
    fromIdName?: string;
    /** The name of the node key containing the to id. */
    toIdName?: string;
    /** The name of the node key containing the size. */
    sizeName?: string;
    /** The name of the node key containing the node id. */
    nodeIdName?: string;
    /** The name of the node key containing the label. */
    labelName?: string;
    /** The name of the node key containing the node size. */
    nodeSizeName?: string;
    /** The name of the node key containing the node position. */
    positionName?: string;
}

export interface AgSankeySeriesTooltipRendererParams
    extends AgSeriesTooltipRendererParams,
        AgSankeySeriesOptionsKeys,
        AgSankeySeriesOptionsNames {}

export interface AgSankeySeriesFormatterParams<TDatum = any>
    extends AgChartCallbackParams<TDatum>,
        AgSankeySeriesOptionsKeys,
        AgSankeySeriesLinkStyle {
    /** `true` if the sector is highlighted by hovering. */
    readonly highlighted: boolean;
}
