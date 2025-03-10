import { _ModuleSupport } from 'ag-charts-community';

import { type RadarNodeDatum, RadarSeriesProperties } from './radarSeriesProperties';

const {
    ChartAxisDirection,
    PolarAxis,
    SeriesNodePickMode,
    valueProperty,
    fixNumericExtent,
    seriesLabelFadeInAnimation,
    markerFadeInAnimation,
    resetMarkerFn,
    animationValidation,
    formatValue,
    computeMarkerFocusBounds,
    isFiniteNumber,
    extent,
    isNumberEqual,
    sanitizeHtml,
    createDatumId,
    BBox,
    Group,
    Path,
    PointerEvents,
    Selection,
    Text,
    getMarker,
} = _ModuleSupport;

export interface RadarPathPoint {
    x: number;
    y: number;
    moveTo: boolean;
    radius?: number;
    startAngle?: number;
    endAngle?: number;
    arc?: boolean;
}

class RadarSeriesNodeEvent<
    TEvent extends string = _ModuleSupport.SeriesNodeEventTypes,
> extends _ModuleSupport.SeriesNodeEvent<RadarNodeDatum, TEvent> {
    readonly angleKey?: string;
    readonly radiusKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RadarNodeDatum, series: RadarSeries) {
        super(type, nativeEvent, datum, series);
        this.angleKey = series.properties.angleKey;
        this.radiusKey = series.properties.radiusKey;
    }
}

export abstract class RadarSeries extends _ModuleSupport.PolarSeries<
    RadarNodeDatum,
    RadarSeriesProperties<any>,
    _ModuleSupport.Marker
> {
    static readonly className: string = 'RadarSeries';

    override properties = new RadarSeriesProperties();

    protected override readonly NodeEvent = RadarSeriesNodeEvent;

    private readonly lineGroup = this.contentGroup.appendChild(
        new Group({
            name: 'radar-line',
            zIndex: _ModuleSupport.SeriesZIndexMap.ANY_CONTENT,
        })
    );
    protected lineSelection: _ModuleSupport.Selection<_ModuleSupport.Path, boolean> = Selection.select(
        this.lineGroup,
        Path
    );

    protected resetInvalidToZero: boolean = false;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            canHaveAxes: true,
            animationResetFns: {
                item: resetMarkerFn,
            },
        });
    }

    protected override nodeFactory(): _ModuleSupport.Marker {
        const { shape } = this.properties.marker;
        const MarkerShape = getMarker(shape);
        return new MarkerShape();
    }

    override setSeriesIndex(index: number): boolean {
        if (!super.setSeriesIndex(index)) return false;

        this.lineGroup.zIndex = [
            _ModuleSupport.SeriesZIndexMap.ANY_CONTENT,
            index,
            _ModuleSupport.SeriesContentZIndexMap.FOREGROUND,
            1,
        ];

        return true;
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[] {
        const { dataModel, processedData } = this;
        if (!processedData || !dataModel) return [];

        if (direction === ChartAxisDirection.X) {
            return dataModel.getDomain(this, `angleValue`, 'value', processedData);
        } else {
            const domain = dataModel.getDomain(this, `radiusValue`, 'value', processedData);
            const ext = extent(domain.length === 0 ? domain : [0].concat(domain));
            return fixNumericExtent(ext);
        }
    }

    override async processData(dataController: _ModuleSupport.DataController) {
        if (!this.properties.isValid()) {
            return;
        }

        const { angleKey, radiusKey } = this.properties;
        const extraProps = [];

        if (!this.ctx.animationManager.isSkipped()) {
            extraProps.push(animationValidation());
        }

        const radiusScaleType = this.axes[ChartAxisDirection.Y]?.scale.type;
        const angleScaleType = this.axes[ChartAxisDirection.X]?.scale.type;

        await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                valueProperty(angleKey, angleScaleType, { id: 'angleValue' }),
                valueProperty(radiusKey, radiusScaleType, { id: 'radiusValue', invalidValue: undefined }),
                ...extraProps,
            ],
        });

        this.animationState.transition('updateData');
    }

    protected circleCache = { r: 0, cx: 0, cy: 0 };

    protected didCircleChange() {
        const r = this.radius;
        const cx = this.centerX;
        const cy = this.centerY;
        const cache = this.circleCache;
        if (!(r === cache.r && cx === cache.cx && cy === cache.cy)) {
            this.circleCache = { r, cx, cy };
            return true;
        }
        return false;
    }

    protected getAxisInnerRadius() {
        const radiusAxis = this.axes[ChartAxisDirection.Y];
        return radiusAxis instanceof PolarAxis ? this.radius * radiusAxis.innerRadiusRatio : 0;
    }

    maybeRefreshNodeData() {
        const didCircleChange = this.didCircleChange();
        if (!didCircleChange && !this.nodeDataRefresh) return;
        const { nodeData = [] } = this.createNodeData() ?? {};
        this.nodeData = nodeData;
        this.nodeDataRefresh = false;
    }

    override createNodeData() {
        const { processedData, dataModel } = this;

        if (!processedData || !dataModel || processedData.rawData.length === 0 || !this.properties.isValid()) {
            return;
        }

        const { angleKey, radiusKey, angleName, radiusName, marker, label } = this.properties;
        const angleScale = this.axes[ChartAxisDirection.X]?.scale;
        const radiusScale = this.axes[ChartAxisDirection.Y]?.scale;

        if (!angleScale || !radiusScale) {
            return;
        }

        const angleValues = dataModel.resolveColumnById<number | string>(this, `angleValue`, processedData);
        const radiusValues = dataModel.resolveColumnById<number>(this, `radiusValue`, processedData);
        const axisInnerRadius = this.getAxisInnerRadius();

        const nodeData = processedData.rawData.map((datum, datumIndex): RadarNodeDatum => {
            const angleDatum = angleValues[datumIndex];
            const radiusDatum = radiusValues[datumIndex];

            const angle = angleScale.convert(angleDatum);
            const radius = this.radius + axisInnerRadius - radiusScale.convert(radiusDatum);

            const cos = Math.cos(angle);
            const sin = Math.sin(angle);

            const x = cos * radius;
            const y = sin * radius;

            let labelNodeDatum: RadarNodeDatum['label'];
            if (label.enabled) {
                const labelText = this.getLabelText(label, {
                    value: radiusDatum,
                    datum,
                    angleKey,
                    radiusKey,
                    angleName,
                    radiusName,
                });

                if (labelText) {
                    let textAlign: CanvasTextAlign = 'right';
                    if (isNumberEqual(cos, 0)) {
                        textAlign = 'center';
                    } else if (cos > 0) {
                        textAlign = 'left';
                    }

                    let textBaseline: CanvasTextBaseline = 'bottom';
                    if (isNumberEqual(sin, 0)) {
                        textBaseline = 'middle';
                    } else if (sin > 0) {
                        textBaseline = 'top';
                    }

                    labelNodeDatum = {
                        x: x + cos * marker.size,
                        y: y + sin * marker.size,
                        text: labelText,
                        textAlign,
                        textBaseline,
                    };
                }
            }

            return {
                series: this,
                datum,
                index: datumIndex,
                point: { x, y, size: marker.size },
                midPoint: { x, y },
                label: labelNodeDatum,
                angleValue: angleDatum,
                radiusValue: radiusDatum,
                missing: !isFiniteNumber(angle) || !isFiniteNumber(radius),
            };
        });

        return { itemId: radiusKey, nodeData, labelData: nodeData };
    }

    update({ seriesRect }: { seriesRect?: _ModuleSupport.BBox }) {
        const resize = this.checkResize(seriesRect);

        const animationEnabled = !this.ctx.animationManager.isSkipped();
        const { series } = this.ctx.highlightManager?.getActiveHighlight() ?? {};
        this.highlightGroup.visible = (animationEnabled || this.visible) && series === this;

        this.maybeRefreshNodeData();

        this.contentGroup.translationX = this.centerX;
        this.contentGroup.translationY = this.centerY;
        this.highlightGroup.translationX = this.centerX;
        this.highlightGroup.translationY = this.centerY;
        if (this.labelGroup) {
            this.labelGroup.translationX = this.centerX;
            this.labelGroup.translationY = this.centerY;
        }

        this.updatePathSelections();
        this.updateMarkerSelection();
        this.updateMarkers(this.itemSelection, false);
        this.updateMarkers(this.highlightSelection, true);
        this.updateLabels();

        if (resize) {
            this.animationState.transition('resize');
        }
        this.animationState.transition('update');
    }

    protected updatePathSelections() {
        const pathData = this.visible ? [true] : [];
        this.lineSelection.update(pathData);
    }

    protected updateMarkerSelection() {
        if (this.properties.marker.isDirty()) {
            this.itemSelection.clear();
            this.itemSelection.cleanup();
            this.itemSelection = Selection.select(this.itemGroup, () => this.nodeFactory(), false);
        }

        this.itemSelection.update(this.properties.marker.enabled ? this.nodeData : []);
    }

    protected getMarkerFill(highlightedStyle?: _ModuleSupport.SeriesItemHighlightStyle) {
        return highlightedStyle?.fill ?? this.properties.marker.fill;
    }

    protected updateMarkers(
        selection: _ModuleSupport.Selection<_ModuleSupport.Marker, RadarNodeDatum>,
        highlight: boolean
    ) {
        const { angleKey, radiusKey, marker, visible } = this.properties;
        const { itemStyler } = marker;

        let selectionData: RadarNodeDatum[] = [];

        if (visible && marker.shape && marker.enabled) {
            if (highlight) {
                const highlighted = this.ctx.highlightManager?.getActiveHighlight();
                if (highlighted?.datum) {
                    selectionData = [highlighted as RadarNodeDatum];
                }
            } else {
                selectionData = this.nodeData;
            }
        }
        const highlightedStyle = highlight ? this.properties.highlightStyle.item : undefined;
        const formatType = highlight ? 'highlight' : 'node';
        selection.update(selectionData).each((node, datum, index) => {
            const fill = this.getMarkerFill(highlightedStyle);
            const fillOpacity = highlightedStyle?.fillOpacity ?? this.properties.marker.fillOpacity;
            const stroke = highlightedStyle?.stroke ?? marker.stroke ?? this.properties.stroke;
            const strokeWidth = highlightedStyle?.strokeWidth ?? marker.strokeWidth ?? this.properties.strokeWidth ?? 1;
            const strokeOpacity = highlightedStyle?.strokeOpacity ?? this.properties.marker.strokeOpacity;
            const format = itemStyler
                ? this.cachedDatumCallback(createDatumId(index, formatType), () =>
                      itemStyler({
                          datum: datum.datum,
                          angleKey,
                          radiusKey,
                          fill,
                          fillOpacity,
                          stroke,
                          strokeWidth,
                          strokeOpacity,
                          shape: marker.shape,
                          size: marker.size,
                          highlighted: highlight,
                          seriesId: this.id,
                      })
                  )
                : undefined;
            node.fill = format?.fill ?? fill;
            node.stroke = format?.stroke ?? stroke;
            node.strokeWidth = format?.strokeWidth ?? strokeWidth;
            node.fillOpacity = highlightedStyle?.fillOpacity ?? marker.fillOpacity ?? 1;
            node.strokeOpacity = marker.strokeOpacity ?? this.properties.strokeOpacity ?? 1;
            node.size = format?.size ?? marker.size;

            const { x, y } = datum.point;
            node.x = x;
            node.y = y;
            node.visible = visible && node.size > 0 && !isNaN(x) && !isNaN(y);
        });
    }

    protected updateLabels() {
        const { label } = this.properties;
        this.labelSelection.update(this.nodeData).each((node, datum) => {
            if (label.enabled && datum.label) {
                node.x = datum.label.x;
                node.y = datum.label.y;

                node.fill = label.color;

                node.fontFamily = label.fontFamily;
                node.fontSize = label.fontSize;
                node.fontStyle = label.fontStyle;
                node.fontWeight = label.fontWeight;
                node.text = datum.label.text;
                node.textAlign = datum.label.textAlign;
                node.textBaseline = datum.label.textBaseline;

                node.visible = true;
            } else {
                node.visible = false;
            }
        });
    }

    getTooltipHtml(nodeDatum: RadarNodeDatum): _ModuleSupport.TooltipContent {
        if (!this.properties.isValid()) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const { id: seriesId } = this;
        const { angleKey, radiusKey, angleName, radiusName, marker, tooltip } = this.properties;
        const { index, datum, angleValue, radiusValue, itemId } = nodeDatum;

        const formattedAngleValue = formatValue(angleValue);
        const formattedRadiusValue = formatValue(radiusValue);
        const title = sanitizeHtml(radiusName);
        const content = sanitizeHtml(`${formattedAngleValue}: ${formattedRadiusValue}`);

        const {
            itemStyler,
            fill,
            fillOpacity,
            stroke,
            strokeWidth = this.properties.strokeWidth,
            strokeOpacity,
            shape,
            size,
        } = marker;

        const { fill: color } = (itemStyler &&
            this.cachedDatumCallback(createDatumId(index, 'tooltip'), () =>
                itemStyler({
                    datum,
                    angleKey,
                    radiusKey,
                    fill,
                    fillOpacity,
                    stroke,
                    strokeWidth,
                    strokeOpacity,
                    shape,
                    size,
                    highlighted: false,
                    seriesId,
                })
            )) ?? { fill };

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                datum,
                angleKey,
                angleName,
                radiusKey,
                radiusName,
                title,
                color,
                seriesId,
                itemId,
            }
        );
    }

    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] {
        if (!this.properties.isValid() || legendType !== 'category') {
            return [];
        }

        const {
            id: seriesId,
            ctx: { legendManager },
            visible,
        } = this;

        const { radiusKey, radiusName, stroke, strokeWidth, strokeOpacity, lineDash, marker, showInLegend } =
            this.properties;

        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId: radiusKey,
                seriesId,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId: radiusKey }),
                label: {
                    text: radiusName ?? radiusKey,
                },
                symbols: [
                    {
                        marker: {
                            shape: marker.shape,
                            fill: this.getMarkerFill() ?? marker.stroke ?? stroke ?? 'rgba(0, 0, 0, 0)',
                            stroke: marker.stroke ?? stroke ?? 'rgba(0, 0, 0, 0)',
                            fillOpacity: marker.fillOpacity ?? 1,
                            strokeOpacity: marker.strokeOpacity ?? strokeOpacity ?? 1,
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
                hideInLegend: !showInLegend,
            },
        ];
    }

    protected override pickNodeClosestDatum(
        hitPoint: _ModuleSupport.Point
    ): _ModuleSupport.SeriesNodePickMatch | undefined {
        const { nodeData, centerX: cx, centerY: cy } = this;
        const { x, y } = hitPoint;
        const radius = this.radius;

        const distanceFromCenter = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
        if (distanceFromCenter > radius + this.properties.marker.size) {
            return;
        }

        let minDistance = Infinity;
        let closestDatum: RadarNodeDatum | undefined;

        for (const datum of nodeData) {
            const { point: { x: datumX = NaN, y: datumY = NaN } = {} } = datum;
            if (isNaN(datumX) || isNaN(datumY)) {
                continue;
            }

            const distance = Math.sqrt((hitPoint.x - datumX - cx) ** 2 + (hitPoint.y - datumY - cy) ** 2);
            if (distance < minDistance) {
                minDistance = distance;
                closestDatum = datum;
            }
        }

        if (closestDatum) {
            const distance = Math.max(minDistance - (closestDatum.point?.size ?? 0), 0);
            return { datum: closestDatum, distance };
        }
    }

    override computeLabelsBBox() {
        const { label } = this.properties;

        this.maybeRefreshNodeData();

        const textBoxes: _ModuleSupport.BBox[] = [];
        const tempText = new Text();
        this.nodeData.forEach((nodeDatum) => {
            if (!label.enabled || !nodeDatum.label) {
                return;
            }
            tempText.text = nodeDatum.label.text;
            tempText.x = nodeDatum.label.x;
            tempText.y = nodeDatum.label.y;
            tempText.setFont(label);
            tempText.setAlign(nodeDatum.label);
            const box = tempText.getBBox();
            textBoxes.push(box);
        });
        if (textBoxes.length === 0) {
            return null;
        }
        return BBox.merge(textBoxes);
    }

    protected getLineNode() {
        return this.lineSelection?.at(0);
    }

    protected beforePathAnimation() {
        const lineNode = this.getLineNode();
        if (!lineNode) return;

        lineNode.fill = undefined;
        lineNode.lineJoin = 'round';
        lineNode.lineCap = 'round';
        lineNode.pointerEvents = PointerEvents.None;

        lineNode.stroke = this.properties.stroke;
        lineNode.strokeWidth = this.getStrokeWidth(this.properties.strokeWidth);
        lineNode.strokeOpacity = this.properties.strokeOpacity;

        lineNode.lineDash = this.properties.lineDash;
        lineNode.lineDashOffset = this.properties.lineDashOffset;
    }

    protected getLinePoints(): RadarPathPoint[] {
        const { nodeData, resetInvalidToZero } = this;
        const { connectMissingData } = this.properties;
        if (nodeData.length === 0) {
            return [];
        }

        const radiusAxis = this.axes[ChartAxisDirection.Y];
        const angleAxis = this.axes[ChartAxisDirection.X];
        const reversedAngleAxis = angleAxis?.isReversed();
        const reversedRadiusAxis = radiusAxis?.isReversed();

        // For inverted radar area the inner line shape points must be anti-clockwise and the zero line points (outer
        // shape must be clockwise) to create a hole in the middle of the shape
        const data = reversedRadiusAxis && !reversedAngleAxis ? [...nodeData].reverse() : nodeData;
        const points: RadarPathPoint[] = [];
        let prevPointInvalid = false;
        let firstValid: RadarNodeDatum | undefined;

        data.forEach((datum, index) => {
            let { x, y } = datum.point;

            const isPointInvalid = isNaN(x) || isNaN(y);

            if (!isPointInvalid) {
                firstValid ??= datum;
            }

            if (isPointInvalid && !connectMissingData) {
                x = 0;
                y = 0;
            }

            const moveTo =
                index === 0 || (!resetInvalidToZero && !connectMissingData && (isPointInvalid || prevPointInvalid));

            points.push({ x, y, moveTo });

            prevPointInvalid = isPointInvalid;
        });

        if (firstValid !== undefined) {
            points.push({ x: firstValid.point.x, y: firstValid.point.y, moveTo: false });
        }

        return points;
    }

    protected animateSinglePath(pathNode: _ModuleSupport.Path, points: RadarPathPoint[], ratio: number) {
        const { path } = pathNode;

        path.clear(true);

        const axisInnerRadius = this.getAxisInnerRadius();
        const radiusAxis = this.axes[ChartAxisDirection.Y];
        const reversedRadiusAxis = radiusAxis?.isReversed();
        const radiusZero = reversedRadiusAxis
            ? this.radius + axisInnerRadius - radiusAxis?.scale.convert(0)
            : axisInnerRadius;

        points.forEach((point) => {
            const { x: x1, y: y1, arc, radius = 0, startAngle = 0, endAngle = 0, moveTo } = point;
            const angle = Math.atan2(y1, x1);
            const x0 = radiusZero * Math.cos(angle);
            const y0 = radiusZero * Math.sin(angle);
            const t = ratio;
            const x = x0 * (1 - t) + x1 * t;
            const y = y0 * (1 - t) + y1 * t;

            if (arc) {
                path.arc(x1, y1, radius, startAngle, endAngle);
            } else if (moveTo) {
                path.moveTo(x, y);
            } else {
                path.lineTo(x, y);
            }
        });

        pathNode.checkPathDirty();
    }

    protected animatePaths(ratio: number) {
        const linePoints = this.getLinePoints();
        const lineNode = this.getLineNode();
        if (!lineNode) return;
        this.animateSinglePath(lineNode, linePoints, ratio);
    }

    override animateEmptyUpdateReady() {
        const { itemSelection, labelSelection } = this;
        const { animationManager } = this.ctx;

        this.beforePathAnimation();

        animationManager.animate({
            id: `${this.id}_'path`,
            groupId: this.id,
            from: 0,
            to: 1,
            phase: 'initial',
            collapsable: false,
            onUpdate: (ratio) => this.animatePaths(ratio),
            onStop: () => this.animatePaths(1),
        });

        markerFadeInAnimation(this, animationManager, 'added', itemSelection);
        seriesLabelFadeInAnimation(this, 'labels', animationManager, labelSelection);
    }

    override animateWaitingUpdateReady(data: _ModuleSupport.PolarAnimationData) {
        super.animateWaitingUpdateReady(data);
        this.resetPaths();
    }

    override animateReadyResize(data: _ModuleSupport.PolarAnimationData) {
        super.animateReadyResize(data);
        this.resetPaths();
    }

    protected resetPaths() {
        const lineNode = this.getLineNode();

        if (lineNode) {
            const { path: linePath } = lineNode;
            const linePoints = this.getLinePoints();

            lineNode.fill = undefined;
            lineNode.stroke = this.properties.stroke;
            lineNode.strokeWidth = this.getStrokeWidth(this.properties.strokeWidth);
            lineNode.strokeOpacity = this.properties.strokeOpacity;

            lineNode.lineDash = this.properties.lineDash;
            lineNode.lineDashOffset = this.properties.lineDashOffset;

            linePath.clear(true);

            for (const { x, y, moveTo } of linePoints) {
                if (moveTo) {
                    linePath.moveTo(x, y);
                } else {
                    linePath.lineTo(x, y);
                }
            }

            lineNode.checkPathDirty();
        }
    }

    public getFormattedMarkerStyle(datum: RadarNodeDatum) {
        const { angleKey, radiusKey } = this.properties;
        return this.getMarkerStyle(this.properties.marker, { datum, angleKey, radiusKey, highlighted: true });
    }

    protected override computeFocusBounds(opts: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        return computeMarkerFocusBounds(this, opts);
    }
}
