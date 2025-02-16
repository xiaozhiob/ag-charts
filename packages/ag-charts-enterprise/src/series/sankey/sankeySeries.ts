import { type AgSankeySeriesLinkStyle, type AgSankeySeriesNodeStyle, _ModuleSupport } from 'ag-charts-community';

import { FlowProportionDatumType, FlowProportionSeries } from '../flow-proportion/flowProportionSeries';
import type { NodeGraphEntry } from '../flow-proportion/flowProportionUtil';
import { type Column, layoutColumns } from './sankeyLayout';
import { SankeyLink } from './sankeyLink';
import {
    type SankeyDatum,
    type SankeyLinkDatum,
    type SankeyNodeDatum,
    type SankeyNodeLabelDatum,
    SankeySeriesProperties,
} from './sankeySeriesProperties';

const {
    SeriesNodePickMode,
    CachedTextMeasurerPool,
    TextWrapper,
    TextUtils,
    createDatumId,
    EMPTY_TOOLTIP_CONTENT,
    sanitizeHtml,
    Logger,
    Rect,
    BBox,
    Transformable,
} = _ModuleSupport;

export interface SankeyNodeDataContext
    extends _ModuleSupport.SeriesNodeDataContext<SankeyDatum, SankeyNodeLabelDatum> {}

export class SankeySeries extends FlowProportionSeries<
    SankeyNodeDatum,
    SankeyLinkDatum,
    SankeyNodeLabelDatum,
    SankeySeriesProperties,
    _ModuleSupport.Rect,
    SankeyLink
> {
    static readonly className = 'SankeySeries';
    static readonly type = 'sankey' as const;

    override properties = new SankeySeriesProperties();

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            pickModes: [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
        });
    }

    private isLabelEnabled() {
        return (this.properties.labelKey != null || this.nodes == null) && this.properties.label.enabled;
    }

    protected linkFactory() {
        return new SankeyLink();
    }

    protected nodeFactory() {
        return new Rect();
    }

    override createNodeData() {
        const {
            id: seriesId,
            _nodeDataDependencies: { seriesRectWidth, seriesRectHeight } = { seriesRectWidth: 0, seriesRectHeight: 0 },
        } = this;

        const {
            fromKey,
            toKey,
            sizeKey,
            label: { spacing: labelSpacing },
            node: { spacing: nodeSpacing, width: nodeWidth, alignment },
        } = this.properties;

        const {
            nodeGraph: baseNodeGraph,
            links,
            maxPathLength,
        } = this.getNodeGraph(
            (node) => ({
                ...node,
                size: 0,
                x: NaN,
                y: NaN,
                width: nodeWidth,
                height: NaN,
            }),
            (link) => ({
                ...link,
                x1: NaN,
                x2: NaN,
                y1: NaN,
                y2: NaN,
                height: NaN,
            }),
            { includeCircularReferences: false }
        );
        type EnhancedNodeGraphEntry = NodeGraphEntry<SankeyNodeDatum, SankeyLinkDatum> & {
            columnIndex: number;
            closestColumnIndex: number;
            maxSizeOfClosestNodesAfter: number;
        };
        const nodeGraph = baseNodeGraph as Map<string, EnhancedNodeGraphEntry>;

        const inset = this.isLabelEnabled()
            ? (seriesRectWidth - nodeWidth) * (1 - maxPathLength / (maxPathLength + 1))
            : 0;
        const columnWidth = (seriesRectWidth - nodeWidth - 2 * inset) / (maxPathLength - 1);

        const columns: Column[] = [];
        for (let index = 0; index < maxPathLength; index += 1) {
            const x = inset + index * columnWidth;
            columns.push({ index, size: 0, nodes: [], x });
        }

        nodeGraph.forEach((graphNode) => {
            const { datum: node, linksBefore, linksAfter, maxPathLengthBefore, maxPathLengthAfter } = graphNode;
            const size = Math.max(
                linksBefore.reduce((acc, { link }) => acc + link.size, 0),
                linksAfter.reduce((acc, { link }) => acc + link.size, 0)
            );

            if ((linksBefore.length === 0 && linksAfter.length === 0) || size === 0) {
                graphNode.columnIndex = -1;
                return;
            }

            let column: Column;
            switch (alignment) {
                case 'left':
                    column = columns[maxPathLengthBefore];
                    break;
                case 'right':
                    column = columns[maxPathLength - 1 - maxPathLengthAfter];
                    break;
                case 'center': {
                    if (linksBefore.length !== 0) {
                        column = columns[maxPathLengthBefore];
                        // eslint-disable-next-line no-negated-condition
                    } else if (linksAfter.length !== 0) {
                        const columnIndex =
                            linksAfter.reduce(
                                (acc, link) => Math.min(acc, link.node.maxPathLengthBefore),
                                maxPathLength
                            ) - 1;
                        column = columns[columnIndex];
                    } else {
                        column = columns[0];
                    }
                    break;
                }
                case 'justify': {
                    column = linksAfter.length === 0 ? columns[maxPathLength - 1] : columns[maxPathLengthBefore];
                    break;
                }
            }

            node.x = column.x;
            node.size = size;

            const label = this.getLabelText(this.properties.label, {
                datum: node.datum,
                value: node.label,
                fromKey,
                toKey,
                sizeKey,
                size,
            });
            node.label = String(label);

            column.nodes.push(graphNode);
            column.size += size;

            graphNode.columnIndex = column.index;
        });

        nodeGraph.forEach((graphNode) => {
            let closestColumnIndex = Infinity;
            let maxSizeOfClosestNodesAfter = 0;
            graphNode.linksAfter.forEach((link) => {
                const node = link.node as EnhancedNodeGraphEntry;
                const { columnIndex } = node;
                if (columnIndex < closestColumnIndex) {
                    closestColumnIndex = columnIndex;
                    maxSizeOfClosestNodesAfter = node.datum.size;
                } else if (columnIndex === closestColumnIndex) {
                    maxSizeOfClosestNodesAfter = Math.max(maxSizeOfClosestNodesAfter, node.datum.size);
                }
            });
            graphNode.closestColumnIndex = closestColumnIndex;
            graphNode.maxSizeOfClosestNodesAfter = maxSizeOfClosestNodesAfter;
        });

        const sizeScale = columns.reduce((acc, { size, nodes }) => {
            const columnSizeScale = (1 - (nodes.length - 1) * (nodeSpacing / seriesRectHeight)) / size;
            return Math.min(acc, columnSizeScale);
        }, Infinity);

        for (let i = columns.length - 1; i >= 0; i -= 1) {
            const nodes = columns[i].nodes as EnhancedNodeGraphEntry[];
            nodes.sort(
                (a, b) =>
                    a.closestColumnIndex - b.closestColumnIndex ||
                    a.maxSizeOfClosestNodesAfter - b.maxSizeOfClosestNodesAfter ||
                    a.datum.size - b.datum.size
            );
        }

        layoutColumns(columns, {
            seriesRectHeight,
            nodeSpacing,
            sizeScale,
        });

        let hasNegativeNodeHeight = false;
        nodeGraph.forEach(({ datum: node, linksBefore, linksAfter }) => {
            hasNegativeNodeHeight ||= node.height < 0;

            const bottom = node.y + node.height;
            const sortNodes = (l: typeof linksBefore) => {
                return l.sort((a, b) => {
                    const aNode = a.node.datum;
                    const bNode = b.node.datum;
                    const aBottom = aNode.y + aNode.height;
                    const bBottom = bNode.y + bNode.height;
                    const dAngleTop =
                        Math.atan2(aNode.y - node.y, Math.abs(aNode.x - node.x)) -
                        Math.atan2(bNode.y - node.y, Math.abs(bNode.x - node.x));
                    const dAngleBottom =
                        Math.atan2(aBottom - bottom, Math.abs(aNode.x - node.x)) -
                        Math.atan2(bBottom - bottom, Math.abs(bNode.x - node.x));
                    return dAngleTop + dAngleBottom;
                });
            };

            let y2 = node.y;
            sortNodes(linksBefore).forEach(({ link }) => {
                link.y2 = y2;
                y2 += link.size * seriesRectHeight * sizeScale;
            });

            let y1 = node.y;
            sortNodes(linksAfter).forEach(({ link }) => {
                link.y1 = y1;
                y1 += link.size * seriesRectHeight * sizeScale;
            });
        });

        if (hasNegativeNodeHeight) {
            Logger.warnOnce(
                'There was insufficient space to display the Sankey Series. Reduce the node spacing, or provide a larger container.'
            );
            return;
        }

        const nodeData: SankeyDatum[] = [];
        const labelData: SankeyNodeLabelDatum[] = [];
        const { fontSize } = this.properties.label;
        const canvasFont = this.properties.label.getFont();
        columns.forEach((column, index) => {
            const leading = index === 0;
            const trailing = index === columns.length - 1;

            let bottom = -Infinity;
            column.nodes.sort((a, b) => a.datum.y - b.datum.y);
            column.nodes.forEach(({ datum: node }) => {
                node.midPoint = {
                    x: node.x + node.width / 2,
                    y: node.y + node.height / 2,
                };
                nodeData.push(node);

                if (node.label == null) return;

                const x = leading ? node.x - labelSpacing : node.x + node.width + labelSpacing;
                const y = node.y + node.height / 2;
                let text: string | undefined;
                if (!leading && !trailing) {
                    const y1 = y - TextUtils.getLineHeight(fontSize);
                    const y2 = y + TextUtils.getLineHeight(fontSize);
                    let maxX = seriesRectWidth;
                    nodeGraph.forEach(({ datum }) => {
                        const intersectsLabel =
                            datum.x > node.x && Math.max(datum.y, y1) <= Math.min(datum.y + datum.height, y2);
                        if (intersectsLabel) {
                            maxX = Math.min(maxX, datum.x - labelSpacing);
                        }
                    });
                    const maxWidth = maxX - node.x - 2 * labelSpacing;
                    text = TextWrapper.wrapText(node.label, {
                        maxWidth,
                        maxHeight: node.height,
                        font: this.properties.label,
                        textWrap: 'never',
                        overflow: 'hide',
                    });
                }
                if (text == null || text === '') {
                    const labelInset = leading || trailing ? labelSpacing : labelSpacing * 2;
                    text = TextWrapper.wrapText(node.label, {
                        maxWidth: columnWidth - labelInset,
                        maxHeight: node.height,
                        font: this.properties.label,
                        textWrap: 'never',
                    });
                }
                if (text === '') return;

                const { height } = CachedTextMeasurerPool.measureText(text, {
                    font: canvasFont,
                    textAlign: 'left',
                    textBaseline: 'middle',
                });
                const y0 = y - height / 2;
                const y1 = y + height / 2;

                if (y0 >= bottom) {
                    labelData.push({ x, y, leading, text });
                    bottom = y1;
                }
            });
        });
        links.forEach((link) => {
            const { fromNode, toNode, size } = link;
            link.height = seriesRectHeight * size * sizeScale;
            link.x1 = fromNode.x + nodeWidth;
            link.x2 = toNode.x;
            link.midPoint = {
                x: (link.x1 + link.x2) / 2,
                y: (link.y1 + link.y2) / 2 + link.height / 2,
            };

            nodeData.push(link);
        });

        return {
            itemId: seriesId,
            nodeData,
            labelData,
        };
    }

    protected updateLabelSelection(opts: {
        labelData: SankeyNodeLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, SankeyNodeLabelDatum>;
    }) {
        const labels = this.isLabelEnabled() ? opts.labelData : [];
        return opts.labelSelection.update(labels);
    }

    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.TransformableText, SankeyNodeLabelDatum>;
    }) {
        const { labelSelection } = opts;
        const { color: fill, fontStyle, fontWeight, fontSize, fontFamily } = this.properties.label;

        labelSelection.each((label, { x, y, leading, text }) => {
            label.visible = true;
            label.x = x;
            label.y = y;
            label.text = text;
            label.fill = fill;
            label.fontStyle = fontStyle;
            label.fontWeight = fontWeight;
            label.fontSize = fontSize;
            label.fontFamily = fontFamily;
            label.textAlign = leading ? 'right' : 'left';
            label.textBaseline = 'middle';
        });
    }

    protected updateNodeSelection(opts: {
        nodeData: SankeyNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, SankeyNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) => createDatumId([datum.type, datum.id]));
    }

    protected updateNodeNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, SankeyNodeDatum>;
        isHighlight: boolean;
    }) {
        const { datumSelection, isHighlight } = opts;
        const { id: seriesId, properties } = this;
        const { fromKey, toKey, sizeKey } = this.properties;
        const {
            fill: baseFill,
            fillOpacity,
            stroke: baseStroke,
            strokeOpacity,
            lineDash,
            lineDashOffset,
            itemStyler,
        } = this.properties.node;
        const highlightStyle = isHighlight ? properties.highlightStyle.item : undefined;
        const strokeWidth = this.getStrokeWidth(properties.node.strokeWidth);

        datumSelection.each((rect, datum, index) => {
            const fill = baseFill ?? datum.fill;
            const stroke = baseStroke ?? datum.stroke;

            let format: AgSankeySeriesNodeStyle | undefined;
            if (itemStyler != null) {
                const { label, size } = datum;
                format = this.cachedDatumCallback(createDatumId(index, isHighlight ? 'node-highlight' : 'node'), () =>
                    itemStyler({
                        seriesId,
                        datum: datum.datum,
                        label,
                        size,
                        fromKey,
                        toKey,
                        sizeKey,
                        fill,
                        fillOpacity,
                        strokeOpacity,
                        stroke,
                        strokeWidth,
                        lineDash,
                        lineDashOffset,
                        highlighted: isHighlight,
                    })
                );
            }

            rect.x = datum.x;
            rect.y = datum.y;
            rect.width = Math.max(datum.width, 0);
            rect.height = Math.max(datum.height, 0);
            rect.fill = highlightStyle?.fill ?? format?.fill ?? fill;
            rect.fillOpacity = highlightStyle?.fillOpacity ?? format?.fillOpacity ?? fillOpacity;
            rect.stroke = highlightStyle?.stroke ?? format?.stroke ?? stroke;
            rect.strokeOpacity = highlightStyle?.strokeOpacity ?? format?.strokeOpacity ?? strokeOpacity;
            rect.strokeWidth = highlightStyle?.strokeWidth ?? format?.strokeWidth ?? strokeWidth;
            rect.lineDash = highlightStyle?.lineDash ?? format?.lineDash ?? lineDash;
            rect.lineDashOffset = highlightStyle?.lineDashOffset ?? format?.lineDashOffset ?? lineDashOffset;
        });
    }

    protected updateLinkSelection(opts: {
        nodeData: SankeyLinkDatum[];
        datumSelection: _ModuleSupport.Selection<SankeyLink, SankeyLinkDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) =>
            createDatumId([datum.type, datum.index, datum.fromNode.id, datum.toNode.id])
        );
    }

    protected updateLinkNodes(opts: {
        datumSelection: _ModuleSupport.Selection<SankeyLink, SankeyLinkDatum>;
        isHighlight: boolean;
    }) {
        const { datumSelection, isHighlight } = opts;
        const { id: seriesId, properties } = this;
        const { fromKey, toKey, sizeKey } = properties;
        const {
            fill: baseFill,
            fillOpacity,
            stroke: baseStroke,
            strokeOpacity,
            lineDash,
            lineDashOffset,
            itemStyler,
        } = properties.link;
        const highlightStyle = isHighlight ? properties.highlightStyle.item : undefined;
        const strokeWidth = this.getStrokeWidth(properties.link.strokeWidth);

        datumSelection.each((link, datum, index) => {
            const fill = baseFill ?? datum.fromNode.fill;
            const stroke = baseStroke ?? datum.fromNode.stroke;

            let format: AgSankeySeriesLinkStyle | undefined;
            if (itemStyler != null) {
                format = this.cachedDatumCallback(createDatumId(index, isHighlight ? 'link-highlight' : 'link'), () =>
                    itemStyler({
                        seriesId,
                        datum: datum.datum,
                        fromKey,
                        toKey,
                        sizeKey,
                        fill,
                        fillOpacity,
                        strokeOpacity,
                        stroke,
                        strokeWidth,
                        lineDash,
                        lineDashOffset,
                        highlighted: isHighlight,
                    })
                );
            }

            link.x1 = datum.x1;
            link.y1 = datum.y1;
            link.x2 = datum.x2;
            link.y2 = datum.y2;
            link.height = datum.height;
            link.fill = highlightStyle?.fill ?? format?.fill ?? fill;
            link.fillOpacity = highlightStyle?.fillOpacity ?? format?.fillOpacity ?? fillOpacity;
            link.stroke = highlightStyle?.stroke ?? format?.stroke ?? stroke;
            link.strokeOpacity = highlightStyle?.strokeOpacity ?? format?.strokeOpacity ?? strokeOpacity;
            link.strokeWidth = Math.min(
                highlightStyle?.strokeWidth ?? format?.strokeWidth ?? strokeWidth,
                datum.height / 2
            );
            link.lineDash = highlightStyle?.lineDash ?? format?.lineDash ?? lineDash;
            link.lineDashOffset = highlightStyle?.lineDashOffset ?? format?.lineDashOffset ?? lineDashOffset;
            link.inset = link.strokeWidth / 2;
        });
    }

    override getTooltipHtml(nodeDatum: SankeyDatum): _ModuleSupport.TooltipContent {
        const { id: seriesId, processedData, properties } = this;

        if (!processedData || !properties.isValid()) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const { fromKey, toKey, sizeKey, sizeName, tooltip } = properties;
        const { index, datum, itemId, size } = nodeDatum;

        let title: string;
        const contentLines: string[] = [];
        let fill: string;
        if (nodeDatum.type === FlowProportionDatumType.Link) {
            const { fillOpacity, strokeOpacity, strokeWidth, lineDash, lineDashOffset, itemStyler } = properties.link;
            const { fromNode, toNode } = nodeDatum;
            title = `${fromNode.label ?? fromNode.id} - ${toNode.label ?? toNode.id}`;
            if (sizeKey != null) {
                contentLines.push(sanitizeHtml(`${sizeName ?? sizeKey}: ` + size));
            }

            fill = properties.link.fill ?? fromNode.fill;
            const stroke = properties.link.stroke ?? fromNode.stroke;

            let format: AgSankeySeriesLinkStyle | undefined;
            if (itemStyler != null) {
                format = this.cachedDatumCallback(createDatumId(index, 'link-tooltip'), () =>
                    itemStyler({
                        seriesId,
                        datum: datum.datum,
                        fromKey,
                        toKey,
                        sizeKey,
                        fill,
                        fillOpacity,
                        strokeOpacity,
                        stroke,
                        strokeWidth,
                        lineDash,
                        lineDashOffset,
                        highlighted: true,
                    })
                );
            }

            fill = format?.fill ?? fill;
        } else {
            const { fillOpacity, strokeOpacity, strokeWidth, lineDash, lineDashOffset, itemStyler } = properties.node;
            const { id, label } = nodeDatum;
            title = label ?? id;
            if (sizeKey != null) {
                contentLines.push(sanitizeHtml(`${sizeName ?? sizeKey}: ` + size));
            }

            fill = properties.link.fill ?? datum.fill;
            const stroke = properties.link.stroke ?? datum.stroke;

            let format: AgSankeySeriesNodeStyle | undefined;
            if (itemStyler != null) {
                format = this.cachedDatumCallback(createDatumId(index, 'node-tooltip'), () =>
                    itemStyler({
                        seriesId,
                        datum: datum.datum,
                        label,
                        size,
                        fromKey,
                        toKey,
                        sizeKey,
                        fill,
                        fillOpacity,
                        strokeOpacity,
                        stroke,
                        strokeWidth,
                        lineDash,
                        lineDashOffset,
                        highlighted: true,
                    })
                );
            }

            fill = format?.fill ?? fill;
        }
        const content = contentLines.join('<br>');

        const color = fill;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                datum,
                size,
                title,
                color,
                itemId,
                fromKey,
                toKey,
                sizeKey,
                sizeName,
                ...this.getModuleTooltipParams(),
            }
        );
    }

    override getLabelData(): _ModuleSupport.PointLabelDatum[] {
        return [];
    }

    protected override computeFocusBounds({
        datumIndex,
        seriesRect,
    }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | _ModuleSupport.Path | undefined {
        const datum = this.contextNodeData?.nodeData[datumIndex];

        if (datum?.type === FlowProportionDatumType.Node) {
            const { x, y, width, height } = datum;
            const bbox = new BBox(x, y, width, height);
            return Transformable.toCanvas(this.contentGroup, bbox).clip(seriesRect);
        } else if (datum?.type === FlowProportionDatumType.Link) {
            for (const link of this.linkSelection) {
                if (link.datum === datum) {
                    return link.node;
                }
            }
            return undefined;
        }
    }
}
