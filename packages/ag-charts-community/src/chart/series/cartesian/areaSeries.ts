import type { AgSeriesMarkerStyle } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import { fromToMotion } from '../../../motion/fromToMotion';
import { pathMotion } from '../../../motion/pathMotion';
import { resetMotion } from '../../../motion/resetMotion';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import type { Node } from '../../../scene/node';
import { PointerEvents } from '../../../scene/node';
import type { SizedPoint } from '../../../scene/point';
import type { Selection } from '../../../scene/selection';
import type { Path } from '../../../scene/shape/path';
import type { Text } from '../../../scene/shape/text';
import { extent } from '../../../util/array';
import { mergeDefaults } from '../../../util/object';
import { sanitizeHtml } from '../../../util/sanitize';
import { isDefined, isFiniteNumber } from '../../../util/type-guards';
import { isContinuous } from '../../../util/value';
import { LogAxis } from '../../axis/logAxis';
import { TimeAxis } from '../../axis/timeAxis';
import { ChartAxisDirection } from '../../chartAxisDirection';
import type { DataController } from '../../data/dataController';
import type { DatumPropertyDefinition } from '../../data/dataModel';
import { fixNumericExtent } from '../../data/dataModel';
import {
    animationValidation,
    groupAccumulativeValueProperty,
    groupStackValueProperty,
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
import { SeriesContentZIndexMap, SeriesZIndexMap } from '../seriesZIndexMap';
import { datumStylerProperties } from '../util';
import { AreaSeriesProperties } from './areaSeriesProperties';
import {
    type AreaSeriesNodeDataContext,
    type LabelSelectionDatum,
    type MarkerSelectionDatum,
    plotAreaPathFill,
    prepareAreaPathAnimation,
} from './areaUtil';
import type { CartesianAnimationData } from './cartesianSeries';
import {
    CartesianSeries,
    DEFAULT_CARTESIAN_DIRECTION_KEYS,
    DEFAULT_CARTESIAN_DIRECTION_NAMES,
    RENDER_TO_OFFSCREEN_CANVAS_THRESHOLD,
} from './cartesianSeries';
import { type LinePathSpan, type LineSpanPointDatum, interpolatePoints, plotLinePathStroke } from './lineUtil';
import {
    computeMarkerFocusBounds,
    markerFadeInAnimation,
    markerSwipeScaleInAnimation,
    resetMarkerFn,
    resetMarkerPositionFn,
} from './markerUtil';
import { buildResetPathFn, pathFadeInAnimation, pathSwipeInAnimation, updateClipPath } from './pathUtil';

const CROSS_FILTER_AREA_FILL_OPACITY_FACTOR = 0.125;
const CROSS_FILTER_AREA_STROKE_OPACITY_FACTOR = 0.25;

type AreaAnimationData = CartesianAnimationData<
    Group,
    MarkerSelectionDatum,
    LabelSelectionDatum,
    AreaSeriesNodeDataContext
>;

export class AreaSeries extends CartesianSeries<
    Group,
    AreaSeriesProperties,
    MarkerSelectionDatum,
    LabelSelectionDatum,
    AreaSeriesNodeDataContext
> {
    static readonly className = 'AreaSeries';
    static readonly type = 'area' as const;

    override properties = new AreaSeriesProperties();

    readonly backgroundGroup = new Group({
        name: `${this.id}-background`,
        zIndex: SeriesZIndexMap.BACKGROUND,
    });

    override get pickModeAxis() {
        return 'main' as const;
    }

    constructor(moduleCtx: ModuleContext) {
        super({
            moduleCtx,
            directionKeys: DEFAULT_CARTESIAN_DIRECTION_KEYS,
            directionNames: DEFAULT_CARTESIAN_DIRECTION_NAMES,
            pathsPerSeries: ['fill', 'stroke'],
            pathsZIndexSubOrderOffset: [0, 1000],
            hasMarkers: true,
            markerSelectionGarbageCollection: false,
            pickModes: [SeriesNodePickMode.AXIS_ALIGNED, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            animationResetFns: {
                path: buildResetPathFn({ getVisible: () => this.visible, getOpacity: () => this.getOpacity() }),
                label: resetLabelFn,
                marker: (node, datum) => ({ ...resetMarkerFn(node), ...resetMarkerPositionFn(node, datum) }),
            },
        });
    }

    override renderToOffscreenCanvas(): boolean {
        return (
            super.renderToOffscreenCanvas() ||
            (this.contextNodeData != null &&
                (this.contextNodeData.fillData.spans.length > RENDER_TO_OFFSCREEN_CANVAS_THRESHOLD ||
                    this.contextNodeData.strokeData.spans.length > RENDER_TO_OFFSCREEN_CANVAS_THRESHOLD))
        );
    }

    override attachSeries(seriesContentNode: Node, seriesNode: Node, annotationNode: Node | undefined): void {
        super.attachSeries(seriesContentNode, seriesNode, annotationNode);

        seriesContentNode.appendChild(this.backgroundGroup);
    }

    override detachSeries(
        seriesContentNode: Node | undefined,
        seriesNode: Node,
        annotationNode: Node | undefined
    ): void {
        super.detachSeries(seriesContentNode, seriesNode, annotationNode);

        seriesContentNode?.removeChild(this.backgroundGroup);
    }

    protected override attachPaths([fill, stroke]: Path[]) {
        this.backgroundGroup.appendChild(fill);

        this.contentGroup.appendChild(stroke);
        stroke.zIndex = -1;
    }

    private isStacked() {
        const stackCount = this.seriesGrouping?.stackCount ?? 1;
        return stackCount > 1;
    }

    private _isStacked: boolean | undefined = undefined;
    override setSeriesIndex(index: number) {
        const isStacked = this.isStacked();

        if (!super.setSeriesIndex(index) && this._isStacked === isStacked) return false;

        this._isStacked = isStacked;

        if (isStacked) {
            this.backgroundGroup.zIndex = [SeriesZIndexMap.BACKGROUND, index];
            this.contentGroup.zIndex = [SeriesZIndexMap.ANY_CONTENT, index, SeriesContentZIndexMap.FOREGROUND];
        } else {
            this.backgroundGroup.zIndex = [SeriesZIndexMap.ANY_CONTENT, index, SeriesContentZIndexMap.FOREGROUND, 0];
            this.contentGroup.zIndex = [SeriesZIndexMap.ANY_CONTENT, index, SeriesContentZIndexMap.FOREGROUND, 1];
        }

        return true;
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
        const { xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });

        const idMap = {
            value: `area-stack-${groupIndex}-yValue`,
            values: `area-stack-${groupIndex}-yValues`,
            stack: `area-stack-${groupIndex}-yValue-stack`,
            marker: `area-stack-${groupIndex}-yValues-marker`,
        };

        const extraProps = [];
        if (isDefined(normalizedTo)) {
            extraProps.push(normaliseGroupTo(Object.values(idMap), normalizedTo, 'range'));
        }
        if (animationEnabled) {
            extraProps.push(animationValidation());
        }

        const common: Partial<DatumPropertyDefinition<unknown>> = { invalidValue: null };
        if ((isDefined(normalizedTo) || connectMissingData) && stackCount > 1) {
            common.invalidValue = 0;
        }
        if (!visible) {
            common.forceValue = 0;
        }
        await this.requestDataModel<any, any, true>(dataController, data, {
            props: [
                keyProperty(xKey, xScaleType, { id: 'xValue' }),
                valueProperty(yKey, yScaleType, { id: `yValueRaw`, ...common }),
                ...(yFilterKey != null ? [valueProperty(yFilterKey, yScaleType, { id: 'yFilterRaw' })] : []),
                ...groupStackValueProperty(yKey, yScaleType, { id: `yValueStack`, ...common, groupId: idMap.stack }),
                valueProperty(yKey, yScaleType, { id: `yValue`, ...common, groupId: idMap.value }),
                ...groupAccumulativeValueProperty(
                    yKey,
                    'window',
                    'current',
                    { id: `yValueEnd`, ...common, groupId: idMap.values },
                    yScaleType
                ),
                ...groupAccumulativeValueProperty(
                    yKey,
                    'normal',
                    'current',
                    { id: `yValueCumulative`, ...common, groupId: idMap.marker },
                    yScaleType
                ),
                ...extraProps,
            ],
            groupByKeys: true,
            groupByData: false,
        });

        this.animationState.transition('updateData');
    }

    override getSeriesDomain(direction: ChartAxisDirection): any[] {
        const { processedData, dataModel, axes } = this;
        if (!processedData || !dataModel || !processedData.rawData?.length) return [];

        const yAxis = axes[ChartAxisDirection.Y];
        const keyDef = dataModel.resolveProcessedDataDefById(this, `xValue`);
        const keys = dataModel.getDomain(this, `xValue`, 'key', processedData);
        const yExtent = dataModel.getDomain(this, `yValueEnd`, 'value', processedData);

        if (direction === ChartAxisDirection.X) {
            if (keyDef?.def.type === 'key' && keyDef.def.valueType === 'category') {
                return keys;
            }

            return fixNumericExtent(extent(keys));
        } else if (yAxis instanceof LogAxis || yAxis instanceof TimeAxis) {
            return fixNumericExtent(yExtent);
        } else {
            const fixedYExtent = [yExtent[0] > 0 ? 0 : yExtent[0], yExtent[1] < 0 ? 0 : yExtent[1]];
            return fixNumericExtent(fixedYExtent);
        }
    }

    override createNodeData() {
        const { axes, data, processedData, dataModel } = this;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (
            !xAxis ||
            !yAxis ||
            !data ||
            !dataModel ||
            !processedData?.rawData.length ||
            processedData.type !== 'grouped' ||
            !this.properties.isValid()
        ) {
            return;
        }

        const {
            yKey,
            xKey,
            yFilterKey,
            marker,
            label,
            fill: seriesFill,
            stroke: seriesStroke,
            connectMissingData,
            interpolation,
        } = this.properties;
        const { scale: xScale } = xAxis;
        const { scale: yScale } = yAxis;

        const { isContinuousY } = this.getScaleInformation({ xScale, yScale });

        const xOffset = (xScale.bandwidth ?? 0) / 2;

        const xValues = dataModel.resolveKeysById(this, 'xValue', processedData);
        const yEndValues = dataModel.resolveColumnById(this, `yValueEnd`, processedData);
        const yRawValues = dataModel.resolveColumnById(this, `yValueRaw`, processedData);
        const yCumulativeValues = dataModel.resolveColumnById(this, `yValueCumulative`, processedData);
        const yFilterValues =
            yFilterKey != null ? dataModel.resolveColumnById(this, 'yFilterRaw', processedData) : undefined;
        const yStackValues = dataModel.resolveColumnById<number[]>(this, 'yValueStack', processedData);

        const createMarkerCoordinate = (xDatum: any, yEnd: number, rawYDatum: any): SizedPoint => {
            let currY;

            // if not normalized, the invalid data points will be processed as `undefined` in processData()
            // if normalized, the invalid data points will be processed as 0 rather than `undefined`
            // check if unprocessed datum is valid as we only want to show markers for valid points
            if (
                isDefined(this.properties.normalizedTo) ? isContinuousY && isContinuous(rawYDatum) : !isNaN(rawYDatum)
            ) {
                currY = yEnd;
            }

            return {
                x: xScale.convert(xDatum) + xOffset,
                y: yScale.convert(currY),
                size: marker.size,
            };
        };

        const labelData: LabelSelectionDatum[] = [];
        const markerData: MarkerSelectionDatum[] = [];
        const { visibleSameStackCount } = this.ctx.seriesStateManager.getVisiblePeerGroupIndex(this);

        let crossFiltering = false;
        const { rawData } = processedData;
        processedData.groups.forEach(({ datumIndices }) => {
            datumIndices.forEach((datumIndex) => {
                const xDatum = xValues[datumIndex];
                if (xDatum == null) return;

                const seriesDatum = rawData[datumIndex];
                const yDatum = yRawValues[datumIndex];
                const yValueCumulative = yCumulativeValues[datumIndex];
                const yValueEnd = yEndValues[datumIndex];

                const validPoint = Number.isFinite(yDatum);

                // marker data
                const point = createMarkerCoordinate(xDatum, +yValueCumulative, yDatum);

                const selected = yFilterValues != null ? yFilterValues[datumIndex] === yDatum : undefined;
                if (selected === false) {
                    crossFiltering = true;
                }

                if (validPoint && marker) {
                    markerData.push({
                        index: datumIndex,
                        series: this,
                        itemId: yKey,
                        datum: seriesDatum,
                        midPoint: { x: point.x, y: point.y },
                        cumulativeValue: yValueEnd,
                        yValue: yDatum,
                        xValue: xDatum,
                        yKey,
                        xKey,
                        point,
                        fill: marker.fill ?? seriesFill,
                        stroke: marker.stroke ?? seriesStroke,
                        strokeWidth: marker.strokeWidth ?? this.getStrokeWidth(this.properties.strokeWidth),
                        selected,
                    });
                }

                // label data
                if (validPoint && label) {
                    const labelText = this.getLabelText(label, {
                        value: yDatum,
                        datum: seriesDatum,
                        xKey,
                        yKey,
                        xName: this.properties.xName,
                        yName: this.properties.yName,
                    });

                    labelData.push({
                        index: datumIndex,
                        series: this,
                        itemId: yKey,
                        datum: seriesDatum,
                        x: point.x,
                        y: point.y,
                        labelText,
                    });
                }
            });
        });

        const spansForPoints = (points: Array<LineSpanPointDatum[] | { skip: number }>): Array<LinePathSpan | null> => {
            return points.flatMap((p): Array<LinePathSpan | null> => {
                return Array.isArray(p) ? interpolatePoints(p, interpolation) : new Array(p.skip).fill(null);
            });
        };

        const dataIndices = processedData.groups.flatMap((group) => group.datumIndices);

        const createPoint = (xDatum: any, yDatum: any): LineSpanPointDatum => ({
            point: {
                x: xScale.convert(xDatum) + xOffset,
                y: yScale.convert(yDatum),
            },
            xDatum,
            yDatum,
        });

        const getSeriesSpans = (index: number) => {
            const points: Array<LineSpanPointDatum[] | { skip: number }> = [];

            for (let dataIndicesIndex = 0; dataIndicesIndex < dataIndices.length; dataIndicesIndex += 1) {
                const datumIndex = dataIndices[dataIndicesIndex];
                const xDatum = xValues[datumIndex];
                const yValueStack = yStackValues[datumIndex];
                const yDatum = yValueStack[index];

                const yDatumIsFinite = Number.isFinite(yDatum);

                if (connectMissingData && !yDatumIsFinite) continue;

                const lastYValueStack =
                    dataIndicesIndex > 0 ? yStackValues[dataIndices[dataIndicesIndex - 1]] : undefined;
                const nextYValueStack =
                    dataIndicesIndex < dataIndices.length - 1
                        ? yStackValues[dataIndices[dataIndicesIndex + 1]]
                        : undefined;

                let yValueEndBackwards = 0;
                let yValueEndForwards = 0;
                for (let j = 0; j <= index; j += 1) {
                    const value = yValueStack[j];

                    if (Number.isFinite(value)) {
                        const lastWasFinite = lastYValueStack == null || Number.isFinite(lastYValueStack[j]);
                        const nextWasFinite = nextYValueStack == null || Number.isFinite(nextYValueStack[j]);

                        if (lastWasFinite) {
                            yValueEndBackwards += value;
                        }
                        if (nextWasFinite) {
                            yValueEndForwards += value;
                        }
                    }
                }

                const currentPoints: LineSpanPointDatum[] | { skip: number } | undefined = points[points.length - 1];
                if (!connectMissingData && (yValueEndBackwards !== yValueEndForwards || !yDatumIsFinite)) {
                    if (!yDatumIsFinite && Array.isArray(currentPoints) && currentPoints.length === 1) {
                        points[points.length - 1] = { skip: 1 };
                    } else {
                        const pointBackwards = createPoint(xDatum, yValueEndBackwards);
                        const pointForwards = createPoint(xDatum, yValueEndForwards);

                        if (Array.isArray(currentPoints)) {
                            currentPoints.push(pointBackwards);
                        } else if (currentPoints != null) {
                            currentPoints.skip += 1;
                        }
                        points.push(yDatumIsFinite ? [pointForwards] : { skip: 0 });
                    }
                } else {
                    const yValueEnd = Math.max(yValueEndBackwards, yValueEndForwards);
                    const point = createPoint(xDatum, yValueEnd);

                    if (Array.isArray(currentPoints)) {
                        currentPoints.push(point);
                    } else if (currentPoints != null) {
                        currentPoints.skip += 1;
                        points.push([point]);
                    } else {
                        points.push([point]);
                    }
                }
            }

            return spansForPoints(points);
        };

        const stackIndex = this.seriesGrouping?.stackIndex ?? 0;

        const getAxisSpans = () => {
            const yValueZeroPoints = dataIndices
                .map<LineSpanPointDatum | undefined>((datumIndex) => {
                    const xDatum = xValues[datumIndex];
                    const yValueStack: number[] = yStackValues[datumIndex];
                    const yDatum = yValueStack[stackIndex];

                    if (connectMissingData && !Number.isFinite(yDatum)) return;
                    return createPoint(xDatum, 0);
                })
                .filter((x): x is LineSpanPointDatum => x != null);

            return interpolatePoints(yValueZeroPoints, interpolation);
        };

        const currentSeriesSpans = getSeriesSpans(stackIndex);

        const phantomSpans = currentSeriesSpans.map((): LinePathSpan => null!);
        for (let j = stackIndex - 1; j >= -1; j -= 1) {
            let spans: Array<LinePathSpan | null> | undefined; // lazily init
            for (let i = 0; i < phantomSpans.length; i += 1) {
                if (phantomSpans[i] != null) continue;
                spans ??= j !== -1 ? getSeriesSpans(j) : getAxisSpans();
                phantomSpans[i] = spans[i]!;
            }
        }

        const fillSpans = currentSeriesSpans.map((span, index) => span ?? phantomSpans[index]);
        const strokeSpans = currentSeriesSpans.filter((span): span is LinePathSpan => span != null);

        const context: AreaSeriesNodeDataContext = {
            itemId: yKey,
            fillData: { itemId: yKey, spans: fillSpans, phantomSpans },
            strokeData: { itemId: yKey, spans: strokeSpans },
            labelData,
            nodeData: markerData,
            scales: this.calculateScaling(),
            visible: this.visible,
            stackVisible: visibleSameStackCount > 0,
            crossFiltering,
        };

        return context;
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
        paths: Path[];
        opacity: number;
        visible: boolean;
        animationEnabled: boolean;
    }) {
        const { opacity, visible, animationEnabled } = opts;
        const [fill, stroke] = opts.paths;
        const crossFiltering = this.contextNodeData?.crossFiltering === true;

        const strokeWidth = this.getStrokeWidth(this.properties.strokeWidth);
        stroke.setProperties({
            fill: undefined,
            lineCap: 'round',
            lineJoin: 'round',
            pointerEvents: PointerEvents.None,
            stroke: this.properties.stroke,
            strokeWidth,
            strokeOpacity:
                this.properties.strokeOpacity * (crossFiltering ? CROSS_FILTER_AREA_STROKE_OPACITY_FACTOR : 1),
            lineDash: this.properties.lineDash,
            lineDashOffset: this.properties.lineDashOffset,
            opacity,
            visible: visible || animationEnabled,
        });
        fill.setProperties({
            stroke: undefined,
            lineJoin: 'round',
            pointerEvents: PointerEvents.None,
            fill: this.properties.fill,
            fillOpacity: this.properties.fillOpacity * (crossFiltering ? CROSS_FILTER_AREA_FILL_OPACITY_FACTOR : 1),
            fillShadow: this.properties.shadow,
            opacity,
            visible: visible || animationEnabled,
        });

        updateClipPath(this, stroke);
        updateClipPath(this, fill);
    }

    protected override updatePaths(opts: { contextData: AreaSeriesNodeDataContext; paths: Path[] }) {
        this.updateAreaPaths(opts.paths, opts.contextData);
    }

    private updateAreaPaths(paths: Path[], contextData: AreaSeriesNodeDataContext) {
        for (const path of paths) {
            path.visible = contextData.visible;
        }

        if (contextData.visible) {
            this.updateFillPath(paths, contextData);
            this.updateStrokePath(paths, contextData);
        } else {
            for (const path of paths) {
                path.path.clear();
                path.markDirty();
            }
        }
    }

    private updateFillPath(paths: Path[], contextData: AreaSeriesNodeDataContext) {
        const [fill] = paths;

        fill.path.clear();
        plotAreaPathFill(fill, contextData.fillData);
        fill.markDirty();
    }

    private updateStrokePath(paths: Path[], contextData: AreaSeriesNodeDataContext) {
        const { spans } = contextData.strokeData;
        const [, stroke] = paths;

        stroke.path.clear();
        plotLinePathStroke(stroke, spans);
        stroke.markDirty();
    }

    protected override updateMarkerSelection(opts: {
        nodeData: MarkerSelectionDatum[];
        markerSelection: Selection<Marker, MarkerSelectionDatum>;
    }) {
        const { nodeData, markerSelection } = opts;
        const markersEnabled = this.properties.marker.enabled || this.contextNodeData?.crossFiltering === true;

        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }

        return markerSelection.update(markersEnabled ? nodeData : []);
    }

    protected override updateMarkerNodes(opts: {
        markerSelection: Selection<Marker, MarkerSelectionDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight: highlighted } = opts;
        const { xKey, yKey, marker, fill, stroke, strokeWidth, fillOpacity, strokeOpacity, highlightStyle } =
            this.properties;
        const xDomain = this.getSeriesDomain(ChartAxisDirection.X);
        const yDomain = this.getSeriesDomain(ChartAxisDirection.Y);
        const baseStyle = mergeDefaults(highlighted && highlightStyle.item, marker.getStyle(), {
            fill,
            stroke,
            strokeWidth,
            fillOpacity,
            strokeOpacity,
        });

        markerSelection.each((node, datum) => {
            this.updateMarkerStyle(
                node,
                marker,
                { ...datumStylerProperties(datum, xKey, yKey, xDomain, yDomain), highlighted },
                baseStyle,
                { selected: datum.selected }
            );
        });

        if (!highlighted) {
            this.properties.marker.markClean();
        }
    }

    protected updateLabelSelection(opts: {
        labelData: LabelSelectionDatum[];
        labelSelection: Selection<Text, LabelSelectionDatum>;
    }) {
        const { labelData, labelSelection } = opts;

        return labelSelection.update(labelData);
    }

    protected updateLabelNodes(opts: { labelSelection: Selection<Text, LabelSelectionDatum> }) {
        const { labelSelection } = opts;
        const { enabled: labelEnabled, fontStyle, fontWeight, fontSize, fontFamily, color } = this.properties.label;
        labelSelection.each((text, datum) => {
            const { x, y, labelText } = datum;

            if (labelText && labelEnabled && this.visible) {
                text.fontStyle = fontStyle;
                text.fontWeight = fontWeight;
                text.fontSize = fontSize;
                text.fontFamily = fontFamily;
                text.textAlign = 'center';
                text.textBaseline = 'bottom';
                text.text = labelText;
                text.x = x;
                text.y = y - 10;
                text.fill = color;
                text.visible = true;
            } else {
                text.visible = false;
            }
        });
    }

    getTooltipHtml(nodeDatum: MarkerSelectionDatum): TooltipContent {
        const { id: seriesId, axes, dataModel } = this;
        const { xKey, xName, yName, tooltip, marker } = this.properties;
        const { yKey, xValue, yValue, datum, itemId } = nodeDatum;
        const xDomain = this.getSeriesDomain(ChartAxisDirection.X);
        const yDomain = this.getSeriesDomain(ChartAxisDirection.Y);

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !(xAxis && yAxis && isFiniteNumber(yValue)) || !dataModel) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const xString = xAxis.formatDatum(xValue);
        const yString = yAxis.formatDatum(yValue);
        const title = sanitizeHtml(yName);
        const content = sanitizeHtml(xString + ': ' + yString);

        const baseStyle = mergeDefaults({ fill: this.properties.fill }, marker.getStyle(), {
            stroke: this.properties.stroke,
            strokeWidth: this.properties.strokeWidth,
        });
        const { fill: color } = this.getMarkerStyle(
            marker,
            { ...datumStylerProperties(nodeDatum, xKey, yKey, xDomain, yDomain), highlighted: false },
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
                color,
                title,
                seriesId,
            }
        );
    }

    getLegendData(legendType: ChartLegendType): CategoryLegendDatum[] {
        if (!this.properties.isValid() || legendType !== 'category') {
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
            fill,
            stroke,
            fillOpacity,
            strokeOpacity,
            strokeWidth,
            lineDash,
            marker,
            legendItemName,
            showInLegend,
        } = this.properties;

        const useAreaFill = !marker.enabled || marker.fill === undefined;
        return [
            {
                legendType,
                id: seriesId,
                itemId,
                seriesId,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId }),
                label: {
                    text: legendItemName ?? yName ?? itemId,
                },
                symbols: [
                    {
                        marker: {
                            shape: marker.shape,
                            fill: useAreaFill ? fill : marker.fill,
                            fillOpacity: useAreaFill ? fillOpacity : marker.fillOpacity,
                            stroke: marker.stroke ?? stroke,
                            strokeOpacity: marker.strokeOpacity ?? strokeOpacity,
                            strokeWidth: marker.strokeWidth ?? 0,
                            enabled: marker.enabled || strokeWidth <= 0,
                        },
                        line: {
                            stroke,
                            strokeOpacity,
                            strokeWidth,
                            lineDash,
                        },
                    },
                ],
                legendItemName,
                hideInLegend: !showInLegend,
            },
        ];
    }

    override animateEmptyUpdateReady(animationData: AreaAnimationData) {
        const { markerSelection, labelSelection, contextData, paths } = animationData;
        const { animationManager } = this.ctx;

        this.updateAreaPaths(paths, contextData);
        pathSwipeInAnimation(this, animationManager, ...paths);
        resetMotion([markerSelection], resetMarkerPositionFn);
        markerSwipeScaleInAnimation(this, animationManager, markerSelection);
        seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);
    }

    protected override animateReadyResize(animationData: AreaAnimationData): void {
        const { contextData, paths } = animationData;
        this.updateAreaPaths(paths, contextData);

        super.animateReadyResize(animationData);
    }

    override animateWaitingUpdateReady(animationData: AreaAnimationData) {
        const { animationManager } = this.ctx;
        const { markerSelection, labelSelection, contextData, paths, previousContextData } = animationData;
        const [fill, stroke] = paths;

        // Handling initially hidden series case gracefully.
        if (fill == null && stroke == null) return;

        this.resetMarkerAnimation(animationData);
        this.resetLabelAnimation(animationData);

        const update = () => {
            this.resetPathAnimation(animationData);
            this.updateAreaPaths(paths, contextData);
        };
        const skip = () => {
            animationManager.skipCurrentBatch();
            update();
        };

        if (contextData == null || previousContextData == null) {
            // Added series to existing chart case - fade in series.
            update();

            markerFadeInAnimation(this, animationManager, 'added', markerSelection);
            pathFadeInAnimation(this, 'fill_path_properties', animationManager, 'add', fill);
            pathFadeInAnimation(this, 'stroke_path_properties', animationManager, 'add', stroke);
            seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);
            return;
        }

        if (contextData.crossFiltering !== previousContextData.crossFiltering) {
            skip();
            return;
        }

        const fns = prepareAreaPathAnimation(contextData, previousContextData);
        if (fns === undefined) {
            // Un-animatable - skip all animations.
            skip();
            return;
        } else if (fns.status === 'no-op') {
            return;
        }

        markerFadeInAnimation(this, animationManager, undefined, markerSelection);

        fromToMotion(this.id, 'fill_path_properties', animationManager, [fill], fns.fill.pathProperties);
        pathMotion(this.id, 'fill_path_update', animationManager, [fill], fns.fill.path);

        fromToMotion(this.id, 'stroke_path_properties', animationManager, [stroke], fns.stroke.pathProperties);
        pathMotion(this.id, 'stroke_path_update', animationManager, [stroke], fns.stroke.path);

        seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);

        // The animation may clip spans
        // When using smooth interpolation, the bezier spans are clipped using an approximation
        // This can result in artefacting, which may be present on the final frame
        // To remove this on the final frame, re-draw the series without animations
        this.ctx.animationManager.animate({
            id: this.id,
            groupId: 'reset_after_animation',
            phase: 'trailing',
            from: {},
            to: {},
            onComplete: () => this.updateAreaPaths(paths, contextData),
        });
    }

    protected isLabelEnabled() {
        return this.properties.label.enabled;
    }

    protected nodeFactory() {
        return new Group();
    }

    public getFormattedMarkerStyle(datum: MarkerSelectionDatum): AgSeriesMarkerStyle & { size: number } {
        const { xKey, yKey } = datum;
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
