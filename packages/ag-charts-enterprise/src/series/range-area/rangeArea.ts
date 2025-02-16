import { _ModuleSupport } from 'ag-charts-community';

import { type RangeAreaMarkerDatum, RangeAreaProperties } from './rangeAreaProperties';
import { type RangeAreaContext, type RangeAreaLabelDatum, prepareRangeAreaPathAnimation } from './rangeAreaUtil';

const {
    valueProperty,
    keyProperty,
    ChartAxisDirection,
    mergeDefaults,
    updateLabelNode,
    fixNumericExtent,
    buildResetPathFn,
    resetLabelFn,
    resetMarkerFn,
    resetMarkerPositionFn,
    pathSwipeInAnimation,
    resetMotion,
    markerSwipeScaleInAnimation,
    seriesLabelFadeInAnimation,
    animationValidation,
    diff,
    updateClipPath,
    computeMarkerFocusBounds,
    plotAreaPathFill,
    plotLinePathStroke,
    interpolatePoints,
    pathFadeInAnimation,
    markerFadeInAnimation,
    fromToMotion,
    pathMotion,
    sanitizeHtml,
    extent,
    getMarker,
    PointerEvents,
    Group,
    BBox,
} = _ModuleSupport;

class RangeAreaSeriesNodeEvent<
    TEvent extends string = _ModuleSupport.SeriesNodeEventTypes,
> extends _ModuleSupport.SeriesNodeEvent<RangeAreaMarkerDatum, TEvent> {
    readonly xKey?: string;
    readonly yLowKey?: string;
    readonly yHighKey?: string;

    constructor(type: TEvent, nativeEvent: Event, datum: RangeAreaMarkerDatum, series: RangeAreaSeries) {
        super(type, nativeEvent, datum, series);
        this.xKey = series.properties.xKey;
        this.yLowKey = series.properties.yLowKey;
        this.yHighKey = series.properties.yHighKey;
    }
}

interface RangeAreaSpanPointDatum {
    high: _ModuleSupport.LineSpanPointDatum;
    low: _ModuleSupport.LineSpanPointDatum;
}

export class RangeAreaSeries extends _ModuleSupport.CartesianSeries<
    _ModuleSupport.Group,
    RangeAreaProperties,
    RangeAreaMarkerDatum,
    RangeAreaLabelDatum,
    RangeAreaContext
> {
    static readonly className = 'RangeAreaSeries';
    static readonly type = 'range-area' as const;

    override properties = new RangeAreaProperties();

    protected override readonly NodeEvent = RangeAreaSeriesNodeEvent;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            hasMarkers: true,
            pathsPerSeries: ['fill', 'stroke'],
            pickModes: [_ModuleSupport.SeriesNodePickMode.AXIS_ALIGNED],
            directionKeys: {
                [ChartAxisDirection.X]: ['xKey'],
                [ChartAxisDirection.Y]: ['yLowKey', 'yHighKey'],
            },
            directionNames: {
                [ChartAxisDirection.X]: ['xName'],
                [ChartAxisDirection.Y]: ['yLowName', 'yHighName', 'yName'],
            },
            animationResetFns: {
                path: buildResetPathFn({ getVisible: () => this.visible, getOpacity: () => this.getOpacity() }),
                label: resetLabelFn,
                marker: (node, datum) => ({ ...resetMarkerFn(node), ...resetMarkerPositionFn(node, datum) }),
            },
        });
    }

    override async processData(dataController: _ModuleSupport.DataController) {
        if (!this.properties.isValid() || !this.visible) return;

        const { xKey, yLowKey, yHighKey } = this.properties;
        const xScale = this.axes[ChartAxisDirection.X]?.scale;
        const yScale = this.axes[ChartAxisDirection.Y]?.scale;
        const { xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });

        const extraProps = [];
        const animationEnabled = !this.ctx.animationManager.isSkipped();
        if (!this.ctx.animationManager.isSkipped() && this.processedData) {
            extraProps.push(diff(this.id, this.processedData));
        }
        if (animationEnabled) {
            extraProps.push(animationValidation());
        }

        await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                keyProperty(xKey, xScaleType, { id: `xValue` }),
                valueProperty(yLowKey, yScaleType, { id: `yLowValue`, invalidValue: undefined }),
                valueProperty(yHighKey, yScaleType, { id: `yHighValue`, invalidValue: undefined }),
                ...extraProps,
            ],
        });

        this.animationState.transition('updateData');
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[] {
        const { processedData, dataModel } = this;
        if (!(processedData && dataModel)) return [];

        const {
            domain: {
                keys: [keys],
                values,
            },
        } = processedData;

        if (direction === ChartAxisDirection.X) {
            const keyDef = dataModel.resolveProcessedDataDefById(this, `xValue`);
            if (keyDef?.def.type === 'key' && keyDef.def.valueType === 'category') {
                return keys;
            }
            return fixNumericExtent(extent(keys));
        } else {
            const yLowIndex = dataModel.resolveProcessedDataIndexById(this, 'yLowValue');
            const yLowExtent = values[yLowIndex];
            const yHighIndex = dataModel.resolveProcessedDataIndexById(this, 'yHighValue');
            const yHighExtent = values[yHighIndex];
            const fixedYExtent = [
                yLowExtent[0] > yHighExtent[0] ? yHighExtent[0] : yLowExtent[0],
                yHighExtent[1] < yLowExtent[1] ? yLowExtent[1] : yHighExtent[1],
            ];
            return fixNumericExtent(fixedYExtent);
        }
    }

    override createNodeData() {
        const { data, dataModel, processedData, axes, visible } = this;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (
            !(
                data &&
                visible &&
                xAxis &&
                yAxis &&
                dataModel &&
                processedData != null &&
                processedData.rawData.length !== 0
            )
        ) {
            return;
        }

        const xScale = xAxis.scale;
        const yScale = yAxis.scale;

        const { xKey, yLowKey, yHighKey, connectMissingData, marker, interpolation } = this.properties;

        const xOffset = (xScale.bandwidth ?? 0) / 2;

        const xValues = dataModel.resolveKeysById(this, 'xValue', processedData);
        const yHighValues = dataModel.resolveColumnById(this, 'yHighValue', processedData);
        const yLowValues = dataModel.resolveColumnById(this, 'yLowValue', processedData);

        if (!this.visible) return;

        const labelData: RangeAreaLabelDatum[] = [];
        const markerData: RangeAreaMarkerDatum[] = [];
        const spanPoints: Array<RangeAreaSpanPointDatum[] | { skip: number }> = [];

        processedData.rawData.forEach((datum, datumIndex) => {
            const xValue = xValues[datumIndex];
            if (xValue == null) return;

            const yHighValue = yHighValues[datumIndex];
            const yLowValue = yLowValues[datumIndex];

            const currentSpanPoints: RangeAreaSpanPointDatum[] | { skip: number } | undefined =
                spanPoints[spanPoints.length - 1];
            if (yHighValue != null || yLowValue != null) {
                const appendMarker = (id: 'high' | 'low', yValue: any, y: number) => {
                    markerData.push({
                        index: datumIndex,
                        series: this,
                        itemId: id,
                        datum,
                        midPoint: { x, y },
                        yHighValue,
                        yLowValue,
                        xValue,
                        xKey,
                        yLowKey,
                        yHighKey,
                        point: { x, y, size },
                        enabled: true,
                    });
                    const highLabelDatum: RangeAreaLabelDatum = this.createLabelData({
                        point: { x, y },
                        value: yValue,
                        yLowValue,
                        yHighValue,
                        itemId: id,
                        inverted,
                        datum,
                        series: this,
                    });
                    labelData.push(highLabelDatum);
                };

                const inverted = yLowValue > yHighValue;
                const x = xScale.convert(xValue) + xOffset;
                const yHighCoordinate = yScale.convert(yHighValue);
                const yLowCoordinate = yScale.convert(yLowValue);
                const { size } = marker;

                appendMarker('high', yHighValue, yHighCoordinate);
                appendMarker('low', yLowValue, yLowCoordinate);

                const spanPoint: RangeAreaSpanPointDatum = {
                    high: {
                        point: { x, y: yHighCoordinate },
                        xDatum: xValue,
                        yDatum: yHighValue,
                    },
                    low: {
                        point: { x, y: yLowCoordinate },
                        xDatum: xValue,
                        yDatum: yLowValue,
                    },
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
        });

        const highSpans = spanPoints.flatMap((p): _ModuleSupport.LinePathSpan[] => {
            if (!Array.isArray(p)) return [];
            const highPoints = p.map((d) => d.high);
            return interpolatePoints(highPoints, interpolation);
        });
        const lowSpans = spanPoints.flatMap((p): _ModuleSupport.LinePathSpan[] => {
            if (!Array.isArray(p)) return [];
            const lowPoints = p.map((d) => d.low);
            return interpolatePoints(lowPoints, interpolation);
        });

        const context: RangeAreaContext = {
            itemId: `${yLowKey}-${yHighKey}`,
            labelData,
            nodeData: markerData,
            fillData: { itemId: 'high', spans: highSpans, phantomSpans: lowSpans },
            highStrokeData: { itemId: 'high', spans: highSpans },
            lowStrokeData: { itemId: 'low', spans: lowSpans },
            scales: this.calculateScaling(),
            visible: this.visible,
        };

        return context;
    }

    private createLabelData({
        point,
        value,
        itemId,
        inverted,
        datum,
        series,
    }: {
        point: _ModuleSupport.Point;
        value: any;
        yLowValue: any;
        yHighValue: any;
        itemId: string;
        inverted: boolean;
        datum: any;
        series: RangeAreaSeries;
    }): RangeAreaLabelDatum {
        const { xKey, yLowKey, yHighKey, xName, yName, yLowName, yHighName, label } = this.properties;
        const { placement, padding = 10 } = label;

        let actualItemId = itemId;
        if (inverted) {
            actualItemId = itemId === 'low' ? 'high' : 'low';
        }
        const direction =
            (placement === 'outside' && actualItemId === 'high') || (placement === 'inside' && actualItemId === 'low')
                ? -1
                : 1;

        return {
            x: point.x,
            y: point.y + padding * direction,
            series,
            itemId,
            datum,
            text: this.getLabelText(label, {
                value,
                datum,
                itemId,
                xKey,
                yLowKey,
                yHighKey,
                xName,
                yLowName,
                yHighName,
                yName,
            }),
            textAlign: 'center',
            textBaseline: direction === -1 ? 'bottom' : 'top',
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

    protected override updatePathNodes(opts: { paths: _ModuleSupport.Path[]; opacity: number; visible: boolean }) {
        const { opacity, visible } = opts;
        const [fill, stroke] = opts.paths;

        const strokeWidth = this.getStrokeWidth(this.properties.strokeWidth);
        stroke.setProperties({
            fill: undefined,
            lineCap: 'round',
            lineJoin: 'round',
            pointerEvents: PointerEvents.None,
            stroke: this.properties.stroke,
            strokeWidth,
            strokeOpacity: this.properties.strokeOpacity,
            lineDash: this.properties.lineDash,
            lineDashOffset: this.properties.lineDashOffset,
            opacity,
            visible,
        });
        fill.setProperties({
            stroke: undefined,
            lineJoin: 'round',
            pointerEvents: PointerEvents.None,
            fill: this.properties.fill,
            fillOpacity: this.properties.fillOpacity,
            lineDash: this.properties.lineDash,
            lineDashOffset: this.properties.lineDashOffset,
            strokeOpacity: this.properties.strokeOpacity,
            fillShadow: this.properties.shadow,
            strokeWidth,
            opacity,
            visible,
        });

        updateClipPath(this, stroke);
        updateClipPath(this, fill);
    }

    protected override updatePaths(opts: { contextData: RangeAreaContext; paths: _ModuleSupport.Path[] }) {
        this.updateAreaPaths(opts.paths, opts.contextData);
    }

    private updateAreaPaths(paths: _ModuleSupport.Path[], contextData: RangeAreaContext) {
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

    private updateFillPath(paths: _ModuleSupport.Path[], contextData: RangeAreaContext) {
        const [fill] = paths;
        fill.path.clear();
        plotAreaPathFill(fill, contextData.fillData);
        fill.markDirty();
    }

    private updateStrokePath(paths: _ModuleSupport.Path[], contextData: RangeAreaContext) {
        const [, stroke] = paths;
        stroke.path.clear();
        plotLinePathStroke(stroke, contextData.highStrokeData.spans);
        plotLinePathStroke(stroke, contextData.lowStrokeData.spans);
        stroke.markDirty();
    }

    protected override updateMarkerSelection(opts: {
        nodeData: RangeAreaMarkerDatum[];
        markerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, RangeAreaMarkerDatum>;
    }) {
        const { nodeData, markerSelection } = opts;
        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }
        return markerSelection.update(this.properties.marker.enabled ? nodeData : []);
    }

    protected override updateMarkerNodes(opts: {
        markerSelection: _ModuleSupport.Selection<_ModuleSupport.Marker, RangeAreaMarkerDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight: highlighted } = opts;
        const { xKey, yLowKey, yHighKey, marker, fill, stroke, strokeWidth, fillOpacity, strokeOpacity } =
            this.properties;

        const baseStyle = mergeDefaults(highlighted && this.properties.highlightStyle.item, marker.getStyle(), {
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
        });

        markerSelection.each((node, datum) => {
            this.updateMarkerStyle(node, marker, { datum, highlighted, xKey, yHighKey, yLowKey }, baseStyle);
        });

        if (!highlighted) {
            this.properties.marker.markClean();
        }
    }

    protected updateLabelSelection(opts: {
        labelData: RangeAreaLabelDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, RangeAreaLabelDatum>;
    }) {
        const { labelData, labelSelection } = opts;

        return labelSelection.update(labelData, (text) => {
            text.pointerEvents = PointerEvents.None;
        });
    }

    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, RangeAreaLabelDatum>;
    }) {
        opts.labelSelection.each((textNode, datum) => {
            updateLabelNode(textNode, this.properties.label, datum);
        });
    }

    protected override getHighlightLabelData(
        labelData: RangeAreaLabelDatum[],
        highlightedItem: RangeAreaMarkerDatum
    ): RangeAreaLabelDatum[] | undefined {
        const labelItems = labelData.filter((ld) => ld.datum === highlightedItem.datum);
        return labelItems.length > 0 ? labelItems : undefined;
    }

    protected override getHighlightData(
        nodeData: RangeAreaMarkerDatum[],
        highlightedItem: RangeAreaMarkerDatum
    ): RangeAreaMarkerDatum[] | undefined {
        const highlightItems = nodeData.filter((nodeDatum) => nodeDatum.datum === highlightedItem.datum);
        return highlightItems.length > 0 ? highlightItems : undefined;
    }

    getTooltipHtml(nodeDatum: RangeAreaMarkerDatum): _ModuleSupport.TooltipContent {
        const xAxis = this.axes[ChartAxisDirection.X];
        const yAxis = this.axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !xAxis || !yAxis) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const { id: seriesId } = this;
        const { xKey, yLowKey, yHighKey, xName, yName, yLowName, yHighName, fill, tooltip } = this.properties;
        const { datum, itemId, xValue, yLowValue, yHighValue } = nodeDatum;

        const color = fill ?? 'gray';

        const xString = sanitizeHtml(xAxis.formatDatum(xValue));
        const yLowString = sanitizeHtml(yAxis.formatDatum(yLowValue));
        const yHighString = sanitizeHtml(yAxis.formatDatum(yHighValue));

        const xSubheading = xName ?? xKey;
        const yLowSubheading = yLowName ?? yLowKey;
        const yHighSubheading = yHighName ?? yHighKey;

        const title = sanitizeHtml(yName);

        const content = yName
            ? `<b>${sanitizeHtml(xSubheading)}</b>: ${xString}<br>` +
              `<b>${sanitizeHtml(yLowSubheading)}</b>: ${yLowString}<br>` +
              `<b>${sanitizeHtml(yHighSubheading)}</b>: ${yHighString}<br>`
            : `${xString}: ${yLowString} - ${yHighString}`;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                itemId,
                datum,
                xKey,
                yLowKey,
                yHighKey,
                xName,
                yLowName,
                yHighName,
                yName,
                color,
                title,
                yHighValue,
                yLowValue,
            }
        );
    }

    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] {
        if (legendType !== 'category') {
            return [];
        }

        const { id: seriesId, visible } = this;

        const {
            yLowKey,
            yHighKey,
            yName,
            yLowName,
            yHighName,
            fill,
            stroke,
            strokeWidth,
            strokeOpacity,
            lineDash,
            marker,
            showInLegend,
        } = this.properties;
        const legendItemText = yName ?? `${yLowName ?? yLowKey} - ${yHighName ?? yHighKey}`;
        const itemId = `${yLowKey}-${yHighKey}`;
        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId,
                seriesId,
                enabled: visible,
                label: { text: `${legendItemText}` },
                symbols: [
                    {
                        marker: {
                            shape: marker.shape,
                            fill: marker.fill ?? fill,
                            stroke: marker.stroke ?? stroke,
                            fillOpacity: marker.fillOpacity,
                            strokeOpacity: marker.strokeOpacity,
                            strokeWidth: marker.strokeWidth,
                        },
                        line: {
                            stroke,
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

    protected isLabelEnabled() {
        return this.properties.label.enabled;
    }

    override onDataChange() {}

    protected nodeFactory() {
        return new Group();
    }

    override animateEmptyUpdateReady(
        animationData: _ModuleSupport.CartesianAnimationData<
            _ModuleSupport.Group,
            RangeAreaMarkerDatum,
            RangeAreaLabelDatum,
            RangeAreaContext
        >
    ) {
        const { markerSelection, labelSelection, contextData, paths } = animationData;
        const { animationManager } = this.ctx;

        this.updateAreaPaths(paths, contextData);
        pathSwipeInAnimation(this, animationManager, ...paths);
        resetMotion([markerSelection], resetMarkerPositionFn);
        markerSwipeScaleInAnimation(this, animationManager, markerSelection);
        seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);
    }

    protected override animateReadyResize(
        animationData: _ModuleSupport.CartesianAnimationData<
            _ModuleSupport.Group,
            RangeAreaMarkerDatum,
            RangeAreaLabelDatum,
            RangeAreaContext
        >
    ): void {
        const { contextData, paths } = animationData;
        this.updateAreaPaths(paths, contextData);

        super.animateReadyResize(animationData);
    }

    override animateWaitingUpdateReady(
        animationData: _ModuleSupport.CartesianAnimationData<
            _ModuleSupport.Group,
            RangeAreaMarkerDatum,
            RangeAreaLabelDatum,
            RangeAreaContext
        >
    ) {
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

        const fns = prepareRangeAreaPathAnimation(contextData, previousContextData);
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

    public getFormattedMarkerStyle(datum: RangeAreaMarkerDatum) {
        const { xKey, yLowKey, yHighKey } = this.properties;
        return this.getMarkerStyle(this.properties.marker, { datum, xKey, yLowKey, yHighKey, highlighted: true });
    }

    protected computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        const hiBox = computeMarkerFocusBounds(this, opts);
        const loBox = computeMarkerFocusBounds(this, { ...opts, datumIndex: opts.datumIndex + 1 });
        if (hiBox && loBox) {
            return BBox.merge([hiBox, loBox]);
        }
        return undefined;
    }
}
