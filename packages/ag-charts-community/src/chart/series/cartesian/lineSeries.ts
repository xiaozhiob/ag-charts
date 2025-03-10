import type { AgErrorBoundSeriesTooltipRendererParams } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import { fromToMotion } from '../../../motion/fromToMotion';
import { pathMotion } from '../../../motion/pathMotion';
import { resetMotion } from '../../../motion/resetMotion';
import type { BBox } from '../../../scene/bbox';
import type { ExtendedPath2D } from '../../../scene/extendedPath2D';
import { Group } from '../../../scene/group';
import { PointerEvents } from '../../../scene/node';
import type { Selection } from '../../../scene/selection';
import type { Path } from '../../../scene/shape/path';
import type { Text } from '../../../scene/shape/text';
import { extent } from '../../../util/array';
import { findMinMax } from '../../../util/number';
import { mergeDefaults } from '../../../util/object';
import { sanitizeHtml } from '../../../util/sanitize';
import { isDefined } from '../../../util/type-guards';
import type { RequireOptional } from '../../../util/types';
import { ChartAxisDirection } from '../../chartAxisDirection';
import type { DataController } from '../../data/dataController';
import type { DataModel, DataModelOptions, DatumPropertyDefinition, UngroupedData } from '../../data/dataModel';
import { fixNumericExtent } from '../../data/dataModel';
import {
    animationValidation,
    createDatumId,
    diff,
    groupAccumulativeValueProperty,
    keyProperty,
    normaliseGroupTo,
    valueProperty,
} from '../../data/processors';
import type { CategoryLegendDatum, ChartLegendType } from '../../legend/legendDatum';
import type { Marker } from '../../marker/marker';
import { getMarker } from '../../marker/util';
import { EMPTY_TOOLTIP_CONTENT, type TooltipContent } from '../../tooltip/tooltip';
import { type PickFocusInputs, SeriesNodePickMode } from '../series';
import { resetLabelFn, seriesLabelFadeInAnimation } from '../seriesLabelUtil';
import { datumStylerProperties } from '../util';
import type { CartesianAnimationData } from './cartesianSeries';
import {
    CartesianSeries,
    DEFAULT_CARTESIAN_DIRECTION_KEYS,
    DEFAULT_CARTESIAN_DIRECTION_NAMES,
} from './cartesianSeries';
import { LineSeriesProperties } from './lineSeriesProperties';
import {
    type LineNodeDatum,
    type LinePathSpan,
    type LineSeriesNodeDataContext,
    type LineSpanPointDatum,
    interpolatePoints,
    plotLinePathStroke,
    prepareLinePathAnimation,
} from './lineUtil';
import {
    computeMarkerFocusBounds,
    markerFadeInAnimation,
    markerSwipeScaleInAnimation,
    resetMarkerFn,
    resetMarkerPositionFn,
} from './markerUtil';
import { buildResetPathFn, pathFadeInAnimation, pathSwipeInAnimation, updateClipPath } from './pathUtil';

const CROSS_FILTER_LINE_STROKE_OPACITY_FACTOR = 0.25;

type LineAnimationData = CartesianAnimationData<Group, LineNodeDatum, LineNodeDatum, LineSeriesNodeDataContext>;

type SpanPoints = Array<LineSpanPointDatum[] | { skip: number }>;

export interface LineSeriesDataAggregationFilter {
    indices: number[];
    maxRange: number;
}

export class LineSeries extends CartesianSeries<
    Group,
    LineSeriesProperties,
    LineNodeDatum,
    LineNodeDatum,
    LineSeriesNodeDataContext
> {
    static readonly className = 'LineSeries';
    static readonly type = 'line' as const;

    override properties = new LineSeriesProperties();

    private dataAggregationFilters: LineSeriesDataAggregationFilter[] | undefined = undefined;

    override get pickModeAxis() {
        return this.properties.sparklineMode ? 'main' : 'main-category';
    }

    constructor(moduleCtx: ModuleContext) {
        super({
            moduleCtx,
            directionKeys: DEFAULT_CARTESIAN_DIRECTION_KEYS,
            directionNames: DEFAULT_CARTESIAN_DIRECTION_NAMES,
            hasMarkers: true,
            pickModes: [
                SeriesNodePickMode.AXIS_ALIGNED,
                SeriesNodePickMode.NEAREST_NODE,
                SeriesNodePickMode.EXACT_SHAPE_MATCH,
            ],
            markerSelectionGarbageCollection: false,
            animationResetFns: {
                path: buildResetPathFn({ getVisible: () => this.visible, getOpacity: () => this.getOpacity() }),
                label: resetLabelFn,
                marker: (node, datum) => ({ ...resetMarkerFn(node), ...resetMarkerPositionFn(node, datum) }),
            },
        });
    }

    override async processData(dataController: DataController) {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const { data, visible, seriesGrouping: { groupIndex = this.id, stackCount = 1 } = {} } = this;
        const { xKey, yKey, yFilterKey, connectMissingData, normalizedTo } = this.properties;
        const animationEnabled = !this.ctx.animationManager.isSkipped();

        const xScale = this.axes[ChartAxisDirection.X]?.scale;
        const yScale = this.axes[ChartAxisDirection.Y]?.scale;
        const { isContinuousX, xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });

        const common: Partial<DatumPropertyDefinition<unknown>> = { invalidValue: null };
        if (connectMissingData && stackCount > 1) {
            common.invalidValue = 0;

            if (!visible) {
                common.forceValue = 0;
            }
        }

        const props: DataModelOptions<any, false>['props'] = [];

        // If two or more datum share an x-value, i.e. lined up vertically, they will have the same datum id.
        // They must be identified this way when animated to ensure they can be tracked when their y-value
        // is updated. If this is a static chart, we can instead not bother with identifying datum and
        // automatically garbage collect the marker selection.
        if (!isContinuousX) {
            props.push(keyProperty(xKey, xScaleType, { id: 'xKey' }));
        }

        props.push(
            valueProperty(xKey, xScaleType, { id: 'xValue' }),
            valueProperty(yKey, yScaleType, {
                id: `yValueRaw`,
                ...common,
                invalidValue: undefined,
            })
        );

        if (yFilterKey != null) {
            props.push(valueProperty(yFilterKey, yScaleType, { id: 'yFilterRaw' }));
        }

        if (stackCount > 1) {
            const ids = [
                `line-stack-${groupIndex}-yValues`,
                `line-stack-${groupIndex}-yValues-trailing`,
                `line-stack-${groupIndex}-yValues-marker`,
            ];

            props.push(
                ...groupAccumulativeValueProperty(
                    yKey,
                    'window',
                    'current',
                    { id: `yValueEnd`, ...common, groupId: ids[0] },
                    yScaleType
                ),
                ...groupAccumulativeValueProperty(
                    yKey,
                    'window-trailing',
                    'current',
                    { id: `yValueStart`, ...common, groupId: ids[1] },
                    yScaleType
                ),
                ...groupAccumulativeValueProperty(
                    yKey,
                    'normal',
                    'current',
                    { id: `yValueCumulative`, ...common, groupId: ids[2] },
                    yScaleType
                )
            );

            if (isDefined(normalizedTo)) {
                props.push(normaliseGroupTo([ids[0], ids[1], ids[2]], normalizedTo, 'range'));
            }
        }

        if (animationEnabled) {
            props.push(animationValidation(isContinuousX ? ['xValue'] : undefined));
            if (this.processedData) {
                props.push(diff(this.id, this.processedData));
            }
        }

        const { dataModel, processedData } = await this.requestDataModel<any>(dataController, data, {
            props,
        });

        this.dataAggregationFilters = this.aggregateData(dataModel, processedData as any as UngroupedData<any>);

        this.animationState.transition('updateData');
    }

    override getSeriesDomain(direction: ChartAxisDirection): any[] {
        const { dataModel, processedData } = this;
        if (!dataModel || !processedData?.rawData.length) return [];

        const xDef = dataModel.resolveProcessedDataDefById(this, `xValue`);
        if (direction === ChartAxisDirection.X) {
            const domain = dataModel.getDomain(this, `xValue`, 'value', processedData);
            if (xDef?.def.type === 'value' && xDef.def.valueType === 'category') {
                return domain;
            }

            return fixNumericExtent(extent(domain));
        } else {
            const stackCount = this.seriesGrouping?.stackCount ?? 1;
            const domain =
                stackCount > 1
                    ? dataModel.getDomain(this, `yValueEnd`, 'value', processedData)
                    : dataModel.getDomain(this, `yValueRaw`, 'value', processedData);
            return fixNumericExtent(domain);
        }
    }

    protected aggregateData(
        _dataModel: DataModel<any, any, any>,
        _processedData: UngroupedData<any>
    ): LineSeriesDataAggregationFilter[] | undefined {
        return;
    }

    protected visibleRange(
        length: number,
        _x0: number,
        _x1: number,
        _xFor: (index: number) => number
    ): [number, number] {
        return [0, length];
    }

    override createNodeData() {
        const { dataModel, processedData, axes, dataAggregationFilters } = this;
        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (!dataModel || !processedData || processedData.rawData.length === 0 || !xAxis || !yAxis) {
            return;
        }

        const {
            xKey,
            yKey,
            yFilterKey,
            xName,
            yName,
            marker,
            label,
            connectMissingData,
            interpolation,
            legendItemName,
        } = this.properties;
        const stacked = (this.seriesGrouping?.stackCount ?? 1) > 1;
        const xScale = xAxis.scale;
        const yScale = yAxis.scale;
        const xOffset = (xScale.bandwidth ?? 0) / 2;
        const yOffset = (yScale.bandwidth ?? 0) / 2;
        const size = marker.enabled ? marker.size : 0;

        const { rawData } = processedData;
        const xValues = dataModel.resolveColumnById(this, `xValue`, processedData);
        const yValues = dataModel.resolveColumnById(this, `yValueRaw`, processedData);
        const yEndValues = stacked ? dataModel.resolveColumnById<number>(this, `yValueEnd`, processedData) : undefined;
        const yCumulativeValues = stacked
            ? dataModel.resolveColumnById<number>(this, `yValueCumulative`, processedData)
            : yValues;
        const selectionValues =
            yFilterKey != null ? dataModel.resolveColumnById(this, `yFilterRaw`, processedData) : undefined;

        const nodeData: LineNodeDatum[] = [];
        let spanPoints: SpanPoints | undefined;
        const handleDatum = (index: number) => {
            const datum = rawData[index];
            const xDatum = xValues[index];
            const yDatum = yValues[index];
            const yEndDatum = yEndValues?.[index];
            const yCumulativeDatum = yCumulativeValues?.[index];
            const selected = selectionValues?.[index];

            const x = xScale.convert(xDatum) + xOffset;
            const y = yScale.convert(yCumulativeDatum) + yOffset;

            if (!Number.isFinite(x)) return;

            if (yDatum != null) {
                const labelText = label.enabled
                    ? this.getLabelText(label, {
                          value: yDatum,
                          datum,
                          xKey,
                          yKey,
                          xName,
                          yName,
                          legendItemName,
                      })
                    : undefined;

                nodeData.push({
                    series: this,
                    datum,
                    yKey,
                    xKey,
                    point: { x, y, size },
                    midPoint: { x, y },
                    cumulativeValue: yEndDatum,
                    yValue: yDatum,
                    xValue: xDatum,
                    capDefaults: {
                        lengthRatioMultiplier: this.properties.marker.getDiameter(),
                        lengthMax: Infinity,
                    },
                    labelText,
                    selected,
                });
            }

            if (spanPoints == null) return;

            const currentSpanPoints: LineSpanPointDatum[] | { skip: number } | undefined =
                spanPoints[spanPoints.length - 1];
            if (yDatum != null) {
                const spanPoint: LineSpanPointDatum = {
                    point: { x, y },
                    xDatum,
                    yDatum,
                };

                if (Array.isArray(currentSpanPoints)) {
                    currentSpanPoints.push(spanPoint);
                } else if (currentSpanPoints != null) {
                    currentSpanPoints.skip += 1;
                    spanPoints.push([spanPoint]);
                } else {
                    spanPoints.push([spanPoint]);
                }
            } else if (!connectMissingData) {
                if (Array.isArray(currentSpanPoints) || currentSpanPoints == null) {
                    spanPoints.push({ skip: 0 });
                } else {
                    currentSpanPoints.skip += 1;
                }
            }
        };

        const [x0, x1] = findMinMax(xAxis.range);
        const xFor = (index: number) => {
            const xDatum = xValues[index];
            return xScale.convert(xDatum) + xOffset;
        };

        const [r0, r1] = xScale.range;
        const range = r1 - r0;
        const dataAggregationFilter = dataAggregationFilters?.find((f) => f.maxRange > range);

        if (dataAggregationFilter != null) {
            const { indices } = dataAggregationFilter;
            const [start, end] = this.visibleRange(indices.length, x0, x1, (index) => xFor(indices[index]));

            for (let i = start; i < end; i += 1) {
                handleDatum(indices[i]);
            }
        } else {
            spanPoints = [];
            const [start, end] = this.visibleRange(rawData.length, x0, x1, xFor);

            for (let i = start; i < end; i += 1) {
                handleDatum(i);
            }
        }

        const strokeSpans = spanPoints?.flatMap((p): LinePathSpan[] => {
            return Array.isArray(p) ? interpolatePoints(p, interpolation) : [];
        });
        const strokeData = strokeSpans != null ? { itemId: yKey, spans: strokeSpans } : undefined;

        const crossFiltering =
            selectionValues?.some((selectionValue, index) => selectionValue === yValues[index]) ?? false;

        return {
            itemId: yKey,
            nodeData,
            labelData: nodeData,
            strokeData,
            scales: this.calculateScaling(),
            visible: this.visible,
            crossFiltering,
        };
    }

    protected override isPathOrSelectionDirty(): boolean {
        return this.properties.marker.isDirty();
    }

    protected override markerFactory() {
        const { shape } = this.properties.marker;
        const MarkerShape = getMarker(shape);
        return new MarkerShape();
    }

    protected override updatePathNodes(opts: {
        seriesHighlighted?: boolean;
        paths: Path[];
        opacity: number;
        visible: boolean;
        animationEnabled: boolean;
    }) {
        const {
            paths: [lineNode],
            opacity,
            visible,
            animationEnabled,
        } = opts;
        const crossFiltering = this.contextNodeData?.crossFiltering === true;

        lineNode.setProperties({
            fill: undefined,
            lineJoin: 'round',
            pointerEvents: PointerEvents.None,
            opacity,
            stroke: this.properties.stroke,
            strokeWidth: this.getStrokeWidth(this.properties.strokeWidth),
            strokeOpacity:
                this.properties.strokeOpacity * (crossFiltering ? CROSS_FILTER_LINE_STROKE_OPACITY_FACTOR : 1),
            lineDash: this.properties.lineDash,
            lineDashOffset: this.properties.lineDashOffset,
        });

        if (!animationEnabled) {
            lineNode.visible = visible;
        }

        updateClipPath(this, lineNode);
    }

    protected override updateMarkerSelection(opts: {
        nodeData: LineNodeDatum[];
        markerSelection: Selection<Marker, LineNodeDatum>;
        markerGroup?: Group;
    }) {
        let { nodeData } = opts;
        const { markerSelection } = opts;
        const markersEnabled = this.properties.marker.enabled || this.contextNodeData?.crossFiltering === true;
        nodeData = markersEnabled ? nodeData : [];

        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }

        return markerSelection.update(nodeData, undefined, (datum) => createDatumId(datum.xValue));
    }

    protected override updateMarkerNodes(opts: {
        markerSelection: Selection<Marker, LineNodeDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight: highlighted } = opts;
        const { xKey, yKey, stroke, strokeWidth, strokeOpacity, marker, highlightStyle } = this.properties;
        const xDomain = this.getSeriesDomain(ChartAxisDirection.X);
        const yDomain = this.getSeriesDomain(ChartAxisDirection.Y);
        const baseStyle = mergeDefaults(highlighted && highlightStyle.item, marker.getStyle(), {
            stroke,
            strokeWidth,
            strokeOpacity,
        });

        const applyTranslation = this.ctx.animationManager.isSkipped();
        markerSelection.each((node, datum) => {
            this.updateMarkerStyle(
                node,
                marker,
                { ...datumStylerProperties(datum, xKey, yKey, xDomain, yDomain), highlighted },
                baseStyle,
                { applyTranslation, selected: datum.selected }
            );
        });

        if (!highlighted) {
            marker.markClean();
        }
    }

    protected updateLabelSelection(opts: {
        labelData: LineNodeDatum[];
        labelSelection: Selection<Text, LineNodeDatum>;
    }) {
        return opts.labelSelection.update(this.isLabelEnabled() ? opts.labelData : []);
    }

    protected updateLabelNodes(opts: { labelSelection: Selection<Text, LineNodeDatum> }) {
        const { enabled, fontStyle, fontWeight, fontSize, fontFamily, color } = this.properties.label;

        opts.labelSelection.each((text, datum) => {
            if (enabled && datum?.labelText) {
                text.fontStyle = fontStyle;
                text.fontWeight = fontWeight;
                text.fontSize = fontSize;
                text.fontFamily = fontFamily;
                text.textAlign = 'center';
                text.textBaseline = 'bottom';
                text.text = datum.labelText;
                text.x = datum.point.x;
                text.y = datum.point.y - 10;
                text.fill = color;
                text.visible = true;
            } else {
                text.visible = false;
            }
        });
    }

    getTooltipHtml(nodeDatum: LineNodeDatum): TooltipContent {
        const xAxis = this.axes[ChartAxisDirection.X];
        const yAxis = this.axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !xAxis || !yAxis) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const { xKey, yKey, xName, yName, strokeWidth, marker, tooltip } = this.properties;
        const { datum, xValue, yValue, itemId } = nodeDatum;
        const xDomain = this.getSeriesDomain(ChartAxisDirection.X);
        const yDomain = this.getSeriesDomain(ChartAxisDirection.Y);
        const xString = xAxis.formatDatum(xValue);
        const yString = yAxis.formatDatum(yValue);
        const title = sanitizeHtml(this.properties.title ?? yName);
        const content = sanitizeHtml(xString + ': ' + yString);

        const baseStyle = mergeDefaults({ fill: marker.stroke }, marker.getStyle(), { strokeWidth });
        const { fill: color } = this.getMarkerStyle(
            marker,
            {
                ...datumStylerProperties(nodeDatum, xKey, yKey, xDomain, yDomain),
                highlighted: false,
            },
            baseStyle
        );

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                datum,
                itemId,
                xKey,
                xName,
                yKey,
                yName,
                title,
                color,
                seriesId: this.id,
                ...(this.getModuleTooltipParams() as RequireOptional<AgErrorBoundSeriesTooltipRendererParams>),
            }
        );
    }

    getLegendData(legendType: ChartLegendType): CategoryLegendDatum[] {
        if (!(this.properties.isValid() && legendType === 'category')) {
            return [];
        }

        const {
            id: seriesId,
            ctx: { legendManager },
            visible,
        } = this;

        const {
            yKey: itemId,
            yName,
            stroke,
            strokeOpacity,
            strokeWidth,
            lineDash,
            title,
            marker,
            legendItemName,
            showInLegend,
        } = this.properties;

        const color0 = 'rgba(0, 0, 0, 0)';
        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId,
                legendItemName,
                seriesId,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId }),
                label: {
                    text: legendItemName ?? title ?? yName ?? itemId,
                },
                symbols: [
                    {
                        marker: {
                            shape: marker.shape,
                            fill: marker.fill ?? color0,
                            stroke: marker.stroke ?? stroke ?? color0,
                            fillOpacity: marker.fillOpacity ?? 1,
                            strokeOpacity: marker.strokeOpacity ?? strokeOpacity ?? 1,
                            strokeWidth: marker.strokeWidth ?? 0,
                            enabled: marker.enabled,
                        },
                        line: {
                            stroke: stroke ?? color0,
                            strokeOpacity,
                            strokeWidth,
                            lineDash,
                        },
                    },
                ],
                hideInLegend: !showInLegend,
            },
        ];
    }

    protected override updatePaths(opts: { contextData: LineSeriesNodeDataContext; paths: Path[] }) {
        this.updateLinePaths(opts.paths, opts.contextData);
    }

    private plotNodeDataPoints(path: ExtendedPath2D, nodeData: LineNodeDatum[]) {
        if (nodeData.length === 0) return;

        const initialPoint = nodeData[0].point;
        path.moveTo(initialPoint.x, initialPoint.y);

        for (let i = 1; i < nodeData.length; i += 1) {
            const { x, y } = nodeData[i].point;
            path.lineTo(x, y);
        }
    }

    private updateLinePaths(paths: Path[], contextData: LineSeriesNodeDataContext) {
        const spans = contextData.strokeData?.spans;
        const [lineNode] = paths;

        lineNode.path.clear();
        if (spans != null) {
            plotLinePathStroke(lineNode, spans);
        } else {
            this.plotNodeDataPoints(lineNode.path, contextData.nodeData);
        }

        lineNode.markDirty();
    }

    protected override animateEmptyUpdateReady(animationData: LineAnimationData) {
        const { markerSelection, labelSelection, annotationSelections, contextData, paths } = animationData;
        const { animationManager } = this.ctx;

        this.updateLinePaths(paths, contextData);
        pathSwipeInAnimation(this, animationManager, ...paths);
        resetMotion([markerSelection], resetMarkerPositionFn);
        markerSwipeScaleInAnimation(this, animationManager, markerSelection);
        seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);
        seriesLabelFadeInAnimation(this, 'annotations', animationManager, ...annotationSelections);
    }

    protected override animateReadyResize(animationData: LineAnimationData): void {
        const { contextData, paths } = animationData;
        this.updateLinePaths(paths, contextData);

        super.animateReadyResize(animationData);
    }

    protected override animateWaitingUpdateReady(animationData: LineAnimationData) {
        const { animationManager } = this.ctx;
        const {
            markerSelection: markerSelections,
            labelSelection: labelSelections,
            annotationSelections,
            contextData,
            paths,
            previousContextData,
        } = animationData;
        const [path] = paths;

        this.resetMarkerAnimation(animationData);
        this.resetLabelAnimation(animationData);

        const update = () => {
            this.resetPathAnimation(animationData);
            this.updateLinePaths(paths, contextData);
        };
        const skip = () => {
            animationManager.skipCurrentBatch();
            update();
        };

        if (contextData == null || previousContextData == null) {
            // Added series to existing chart case - fade in series.
            update();

            markerFadeInAnimation(this, animationManager, 'added', markerSelections);
            pathFadeInAnimation(this, 'path_properties', animationManager, 'add', path);
            seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelections);
            seriesLabelFadeInAnimation(this, 'annotations', animationManager, ...annotationSelections);
            return;
        }

        if (contextData.crossFiltering !== previousContextData.crossFiltering) {
            skip();
            return;
        }

        const fns = prepareLinePathAnimation(contextData, previousContextData, this.processedData?.reduced?.diff);

        if (fns === undefined) {
            skip();
            return;
        } else if (fns.status === 'no-op') {
            return;
        }

        fromToMotion(this.id, 'path_properties', animationManager, [path], fns.stroke.pathProperties);

        if (fns.status === 'added') {
            this.updateLinePaths(paths, contextData);
        } else if (fns.status === 'removed') {
            this.updateLinePaths(paths, previousContextData);
        } else {
            pathMotion(this.id, 'path_update', animationManager, [path], fns.stroke.path);
        }

        if (fns.hasMotion) {
            markerFadeInAnimation(this, animationManager, undefined, markerSelections);
            seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelections);
            seriesLabelFadeInAnimation(this, 'annotations', animationManager, ...annotationSelections);
        }
    }

    protected isLabelEnabled() {
        return this.properties.label.enabled;
    }

    override getBandScalePadding() {
        return { inner: 1, outer: 0.1 };
    }

    protected nodeFactory() {
        return new Group();
    }

    public getFormattedMarkerStyle(datum: LineNodeDatum) {
        const { xKey, yKey } = this.properties;
        const xDomain = this.getSeriesDomain(ChartAxisDirection.X);
        const yDomain = this.getSeriesDomain(ChartAxisDirection.Y);
        return this.getMarkerStyle(this.properties.marker, {
            ...datumStylerProperties(datum, xKey, yKey, xDomain, yDomain),
            highlighted: true,
        });
    }

    protected computeFocusBounds(opts: PickFocusInputs): BBox | undefined {
        return computeMarkerFocusBounds(this, opts);
    }
}
