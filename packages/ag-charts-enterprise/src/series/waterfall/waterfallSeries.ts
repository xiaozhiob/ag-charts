import type { AgWaterfallSeriesItemType } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import type { WaterfallSeriesItem, WaterfallSeriesTotal } from './waterfallSeriesProperties';
import { WaterfallSeriesProperties } from './waterfallSeriesProperties';

const {
    adjustLabelPlacement,
    SeriesNodePickMode,
    fixNumericExtent,
    valueProperty,
    keyProperty,
    accumulativeValueProperty,
    trailingAccumulatedValueProperty,
    ChartAxisDirection,
    getRectConfig,
    createDatumId,
    updateRect,
    checkCrisp,
    updateLabelNode,
    prepareBarAnimationFunctions,
    collapsedStartingBarPosition,
    resetBarSelectionsFn,
    seriesLabelFadeInAnimation,
    resetLabelFn,
    animationValidation,
    DEFAULT_CARTESIAN_DIRECTION_KEYS,
    DEFAULT_CARTESIAN_DIRECTION_NAMES,
    computeBarFocusBounds,
    sanitizeHtml,
    isContinuous,
    Rect,
    motion,
} = _ModuleSupport;

type WaterfallNodeLabelDatum = Readonly<_ModuleSupport.Point> & {
    readonly text: string;
    readonly textAlign: CanvasTextAlign;
    readonly textBaseline: CanvasTextBaseline;
};

type WaterfallNodePointDatum = _ModuleSupport.SeriesNodeDatum['point'] & {
    readonly x2: number;
    readonly y2: number;
};

interface WaterfallNodeDatum extends _ModuleSupport.CartesianSeriesNodeDatum, Readonly<_ModuleSupport.Point> {
    readonly index: number;
    readonly itemId: AgWaterfallSeriesItemType;
    readonly cumulativeValue: number;
    readonly width: number;
    readonly height: number;
    readonly label: WaterfallNodeLabelDatum;
    readonly fill: string;
    readonly stroke: string;
    readonly strokeWidth: number;
    readonly opacity: number;
    readonly clipBBox?: _ModuleSupport.BBox;
}

interface WaterfallContext extends _ModuleSupport.CartesianSeriesNodeDataContext<WaterfallNodeDatum> {
    pointData?: WaterfallNodePointDatum[];
}

type WaterfallAnimationData = _ModuleSupport.CartesianAnimationData<
    _ModuleSupport.Rect,
    WaterfallNodeDatum,
    WaterfallNodeDatum,
    WaterfallContext
>;

export class WaterfallSeries extends _ModuleSupport.AbstractBarSeries<
    _ModuleSupport.Rect,
    WaterfallSeriesProperties,
    WaterfallNodeDatum,
    WaterfallNodeDatum,
    WaterfallContext
> {
    static readonly className = 'WaterfallSeries';
    static readonly type = 'waterfall' as const;

    override properties = new WaterfallSeriesProperties();

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            directionKeys: DEFAULT_CARTESIAN_DIRECTION_KEYS,
            directionNames: DEFAULT_CARTESIAN_DIRECTION_NAMES,
            pickModes: [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            pathsPerSeries: ['connector'],
            hasHighlightedLabels: true,
            pathsZIndexSubOrderOffset: [-1, -1],
            animationResetFns: {
                datum: resetBarSelectionsFn,
                label: resetLabelFn,
            },
        });
    }

    private readonly seriesItemTypes: Set<AgWaterfallSeriesItemType> = new Set(['positive', 'negative', 'total']);

    override async processData(dataController: _ModuleSupport.DataController) {
        const { xKey, yKey, totals } = this.properties;
        const { data = [] } = this;

        if (!this.properties.isValid() || !this.visible) return;

        const positiveNumber = (v: unknown) => isContinuous(v) && Number(v) >= 0;
        const negativeNumber = (v: unknown) => isContinuous(v) && Number(v) >= 0;
        const totalTypeValue = (v: unknown) => v === 'total' || v === 'subtotal';
        const propertyDefinition = { missingValue: undefined, invalidValue: undefined };
        const dataWithTotals: unknown[] = [];

        const totalsMap = totals.reduce<Map<number, WaterfallSeriesTotal[]>>((result, total) => {
            const totalsAtIndex = result.get(total.index);
            if (totalsAtIndex) {
                totalsAtIndex.push(total);
            } else {
                result.set(total.index, [total]);
            }
            return result;
        }, new Map());

        data.forEach((datum, i) => {
            dataWithTotals.push(datum);
            // Use the `toString` method to make the axis labels unique as they're used as categories in the axis scale domain.
            // Add random id property as there is caching for the axis label formatter result. If the label object is not unique, the axis label formatter will not be invoked.
            totalsMap.get(i)?.forEach((total) => dataWithTotals.push({ ...total.toJson(), [xKey]: total.axisLabel }));
        });

        const extraProps = [];

        if (!this.ctx.animationManager.isSkipped()) {
            extraProps.push(animationValidation());
        }

        const xScale = this.getCategoryAxis()?.scale;
        const yScale = this.getValueAxis()?.scale;
        const { isContinuousX, xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });

        const { processedData } = await this.requestDataModel<any, any, true>(dataController, dataWithTotals, {
            props: [
                keyProperty(xKey, xScaleType, { id: `xValue` }),
                accumulativeValueProperty(yKey, yScaleType, {
                    ...propertyDefinition,
                    id: `yCurrent`,
                }),
                accumulativeValueProperty(yKey, yScaleType, {
                    ...propertyDefinition,
                    missingValue: 0,
                    id: `yCurrentTotal`,
                }),
                accumulativeValueProperty(yKey, yScaleType, {
                    ...propertyDefinition,
                    id: `yCurrentPositive`,
                    validation: positiveNumber,
                }),
                accumulativeValueProperty(yKey, yScaleType, {
                    ...propertyDefinition,
                    id: `yCurrentNegative`,
                    validation: negativeNumber,
                }),
                trailingAccumulatedValueProperty(yKey, yScaleType, {
                    ...propertyDefinition,
                    id: `yPrevious`,
                }),
                valueProperty(yKey, yScaleType, { id: `yRaw` }), // Raw value pass-through.
                valueProperty('totalType', 'band', {
                    id: `totalTypeValue`,
                    missingValue: undefined,
                    validation: totalTypeValue,
                }),
                ...(isContinuousX ? [_ModuleSupport.SMALLEST_KEY_INTERVAL, _ModuleSupport.LARGEST_KEY_INTERVAL] : []),
                ...extraProps,
            ],
        });

        this.smallestDataInterval = processedData.reduced?.smallestKeyInterval;
        this.largestDataInterval = processedData.reduced?.largestKeyInterval;

        this.updateSeriesItemTypes();

        this.animationState.transition('updateData');
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[] {
        const { processedData, dataModel } = this;
        if (!processedData || !dataModel) return [];

        const {
            keys: [keys],
            values,
        } = processedData.domain;

        if (direction === this.getCategoryDirection()) {
            const keyDef = dataModel.resolveProcessedDataDefById(this, `xValue`);
            if (keyDef?.def.type === 'key' && keyDef?.def.valueType === 'category') {
                return keys;
            }
            const isDirectionY = direction === ChartAxisDirection.Y;
            const isReversed = this.getCategoryAxis()!.isReversed();
            return this.padBandExtent(keys, isReversed !== isDirectionY);
        } else {
            const yCurrIndex = dataModel.resolveProcessedDataIndexById(this, 'yCurrent');
            const yExtent = values[yCurrIndex];
            const fixedYExtent = [Math.min(0, yExtent[0]), Math.max(0, yExtent[1])];
            return fixNumericExtent(fixedYExtent);
        }
    }

    override createNodeData() {
        const { data, dataModel, processedData } = this;
        const categoryAxis = this.getCategoryAxis();
        const valueAxis = this.getValueAxis();

        if (
            !data ||
            !categoryAxis ||
            !valueAxis ||
            !dataModel ||
            processedData == null ||
            processedData.rawData.length === 0
        ) {
            return;
        }

        const { line } = this.properties;
        const xScale = categoryAxis.scale;
        const yScale = valueAxis.scale;
        const barAlongX = this.getBarDirection() === ChartAxisDirection.X;
        const barWidth = this.getBandwidth(categoryAxis) ?? 10;
        const categoryAxisReversed = categoryAxis.isReversed();
        const valueAxisReversed = valueAxis.isReversed();

        if (processedData.type !== 'ungrouped') return;

        const context: WaterfallContext = {
            itemId: this.properties.yKey,
            nodeData: [],
            labelData: [],
            pointData: [],
            scales: this.calculateScaling(),
            visible: this.visible,
        };

        if (!this.visible) return context;

        const pointData: WaterfallNodePointDatum[] = [];

        const xValues = dataModel.resolveKeysById(this, `xValue`, processedData);
        const yRawValues = dataModel.resolveColumnById(this, `yRaw`, processedData);
        const totalTypeValues = dataModel.resolveColumnById<AgWaterfallSeriesItemType>(
            this,
            `totalTypeValue`,
            processedData
        );
        const yCurrValues = dataModel.resolveColumnById<number>(this, 'yCurrent', processedData);
        const yPrevValues = dataModel.resolveColumnById<number>(this, 'yPrevious', processedData);
        const yCurrTotalValues = dataModel.resolveColumnById<number>(this, 'yCurrentTotal', processedData);

        function getValues(
            isTotal: boolean,
            isSubtotal: boolean,
            datumIndex: number
        ): { cumulativeValue: number | undefined; trailingValue: number | undefined } {
            if (isTotal || isSubtotal) {
                return {
                    cumulativeValue: yCurrTotalValues[datumIndex],
                    trailingValue: isSubtotal ? trailingSubtotal : 0,
                };
            }

            return {
                cumulativeValue: yCurrValues[datumIndex],
                trailingValue: yPrevValues[datumIndex],
            };
        }

        function getValue(
            isTotal: boolean,
            isSubtotal: boolean,
            rawValue?: number,
            cumulativeValue?: number,
            trailingValue?: number
        ) {
            if (isTotal) {
                return cumulativeValue;
            }
            if (isSubtotal) {
                return (cumulativeValue ?? 0) - (trailingValue ?? 0);
            }
            return rawValue;
        }

        let trailingSubtotal = 0;
        const { xKey, yKey, xName, yName } = this.properties;

        processedData.rawData.forEach((datum, datumIndex) => {
            const datumType = totalTypeValues[datumIndex];

            const isSubtotal = this.isSubtotal(datumType);
            const isTotal = this.isTotal(datumType);
            const isTotalOrSubtotal = isTotal || isSubtotal;

            const xDatum = xValues[datumIndex];
            if (xDatum == null) return;

            const x = Math.round(xScale.convert(xDatum));

            const rawValue = yRawValues[datumIndex];

            const { cumulativeValue, trailingValue } = getValues(isTotal, isSubtotal, datumIndex);

            if (isTotalOrSubtotal) {
                trailingSubtotal = cumulativeValue ?? 0;
            }

            const currY = Math.round(yScale.convert(cumulativeValue));
            const trailY = Math.round(yScale.convert(trailingValue));

            const value = getValue(isTotal, isSubtotal, rawValue, cumulativeValue, trailingValue);
            const isPositive = (value ?? 0) >= 0;

            const seriesItemType = this.getSeriesItemType(isPositive, datumType);
            const { fill, stroke, strokeWidth, label } = this.getItemConfig(seriesItemType);

            const y = isPositive ? currY : trailY;
            const bottomY = isPositive ? trailY : currY;
            const barHeight = Math.max(strokeWidth, Math.abs(bottomY - y));

            const rect = {
                x: barAlongX ? Math.min(y, bottomY) : x,
                y: barAlongX ? x : Math.min(y, bottomY),
                width: barAlongX ? barHeight : barWidth,
                height: barAlongX ? barWidth : barHeight,
            };

            const nodeMidPoint = {
                x: rect.x + rect.width / 2,
                y: rect.y + rect.height / 2,
            };

            const pointY = isTotalOrSubtotal ? currY : trailY;
            const pixelAlignmentOffset = (Math.floor(line.strokeWidth) % 2) / 2;

            const startY = categoryAxisReversed ? currY : pointY;
            const stopY = categoryAxisReversed ? pointY : currY;

            let startCoordinates: { x: number; y: number };
            let stopCoordinates: { x: number; y: number };
            if (barAlongX) {
                startCoordinates = {
                    x: startY + pixelAlignmentOffset,
                    y: rect.y,
                };
                stopCoordinates = {
                    x: stopY + pixelAlignmentOffset,
                    y: rect.y + rect.height,
                };
            } else {
                startCoordinates = {
                    x: rect.x,
                    y: startY + pixelAlignmentOffset,
                };
                stopCoordinates = {
                    x: rect.x + rect.width,
                    y: stopY + pixelAlignmentOffset,
                };
            }

            const pathPoint = {
                // lineTo
                x: categoryAxisReversed ? stopCoordinates.x : startCoordinates.x,
                y: categoryAxisReversed ? stopCoordinates.y : startCoordinates.y,
                // moveTo
                x2: categoryAxisReversed ? startCoordinates.x : stopCoordinates.x,
                y2: categoryAxisReversed ? startCoordinates.y : stopCoordinates.y,
                size: 0,
            };

            pointData.push(pathPoint);

            const itemId = seriesItemType === 'subtotal' ? 'total' : seriesItemType;
            const labelText = this.getLabelText(label, { itemId, value, datum, xKey, yKey, xName, yName });

            const nodeDatum: WaterfallNodeDatum = {
                index: datumIndex,
                series: this,
                itemId: seriesItemType,
                datum,
                cumulativeValue: cumulativeValue ?? 0,
                xValue: xDatum,
                yValue: value,
                yKey,
                xKey,
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                midPoint: nodeMidPoint,
                fill,
                stroke,
                strokeWidth,
                opacity: 1,
                label: {
                    text: labelText,
                    ...adjustLabelPlacement({
                        isUpward: (value ?? -1) >= 0 !== valueAxisReversed,
                        isVertical: !barAlongX,
                        placement: label.placement,
                        padding: label.padding,
                        rect,
                    }),
                },
            };

            context.nodeData.push(nodeDatum);
            context.labelData.push(nodeDatum);
        });

        const connectorLinesEnabled = this.properties.line.enabled;
        if (yCurrValues != null && connectorLinesEnabled) {
            context.pointData = pointData;
        }

        return context;
    }

    private updateSeriesItemTypes() {
        const { dataModel, seriesItemTypes, processedData } = this;

        if (!dataModel || !processedData) {
            return;
        }

        seriesItemTypes.clear();

        const yPositiveIndex = dataModel.resolveProcessedDataIndexById(this, 'yCurrentPositive');
        const yNegativeIndex = dataModel.resolveProcessedDataIndexById(this, 'yCurrentNegative');
        const totalTypeIndex = dataModel.resolveProcessedDataIndexById(this, `totalTypeValue`);

        const positiveDomain = processedData.domain.values[yPositiveIndex] ?? [];
        const negativeDomain = processedData.domain.values[yNegativeIndex] ?? [];

        if (positiveDomain.length > 0) {
            seriesItemTypes.add('positive');
        }

        if (negativeDomain.length > 0) {
            seriesItemTypes.add('negative');
        }

        const itemTypes = processedData?.domain.values[totalTypeIndex];
        if (!itemTypes) {
            return;
        }

        itemTypes.forEach((type) => {
            if (type === 'total' || type === 'subtotal') {
                seriesItemTypes.add('total');
            }
        });
    }

    private isSubtotal(datumType: AgWaterfallSeriesItemType) {
        return datumType === 'subtotal';
    }

    private isTotal(datumType: AgWaterfallSeriesItemType) {
        return datumType === 'total';
    }

    protected override nodeFactory() {
        return new Rect();
    }

    private getSeriesItemType(isPositive: boolean, datumType?: AgWaterfallSeriesItemType): AgWaterfallSeriesItemType {
        return datumType ?? (isPositive ? 'positive' : 'negative');
    }

    private getItemConfig(seriesItemType: AgWaterfallSeriesItemType): WaterfallSeriesItem {
        switch (seriesItemType) {
            case 'positive': {
                return this.properties.item.positive;
            }
            case 'negative': {
                return this.properties.item.negative;
            }
            case 'subtotal':
            case 'total': {
                return this.properties.item.total;
            }
        }
    }

    protected override updateDatumSelection(opts: {
        nodeData: WaterfallNodeDatum[];
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, WaterfallNodeDatum>;
    }) {
        const { nodeData, datumSelection } = opts;
        const data = nodeData ?? [];
        return datumSelection.update(data);
    }

    protected override updateDatumNodes(opts: {
        datumSelection: _ModuleSupport.Selection<_ModuleSupport.Rect, WaterfallNodeDatum>;
        isHighlight: boolean;
    }) {
        const { datumSelection, isHighlight } = opts;
        const { id: seriesId, ctx } = this;
        const {
            yKey,
            highlightStyle: { item: itemHighlightStyle },
        } = this.properties;

        const categoryAxis = this.getCategoryAxis();
        const crisp = checkCrisp(
            categoryAxis?.scale,
            categoryAxis?.visibleRange,
            this.smallestDataInterval,
            this.largestDataInterval
        );

        const categoryAlongX = this.getCategoryDirection() === ChartAxisDirection.X;

        datumSelection.each((rect, datum) => {
            const seriesItemType = datum.itemId;
            const {
                fillOpacity,
                strokeOpacity,
                strokeWidth,
                lineDash,
                lineDashOffset,
                cornerRadius,
                itemStyler,
                shadow: fillShadow,
            } = this.getItemConfig(seriesItemType);
            const style: _ModuleSupport.RectConfig = {
                fill: datum.fill,
                stroke: datum.stroke,
                fillOpacity,
                strokeOpacity,
                lineDash,
                lineDashOffset,
                fillShadow,
                strokeWidth: this.getStrokeWidth(strokeWidth),
                cornerRadius,
            };
            const visible = categoryAlongX ? datum.width > 0 : datum.height > 0;

            const config = getRectConfig(this, createDatumId(datum.index, 'node'), {
                datum,
                isHighlighted: isHighlight,
                style,
                highlightStyle: itemHighlightStyle,
                itemStyler,
                seriesId,
                itemId: datum.itemId,
                ctx,
                value: datum.yValue,
                yKey,
            });
            config.crisp = crisp;
            config.visible = visible;
            updateRect(rect, config);
        });
    }

    protected updateLabelSelection(opts: {
        labelData: WaterfallNodeDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, WaterfallNodeDatum>;
    }) {
        const { labelData, labelSelection } = opts;

        if (labelData.length === 0) {
            return labelSelection.update([]);
        }

        const data = labelData.filter((labelDatum) => {
            const { label } = this.getItemConfig(labelDatum.itemId);
            return label.enabled;
        });

        return labelSelection.update(data);
    }

    protected updateLabelNodes(opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, WaterfallNodeDatum>;
    }) {
        opts.labelSelection.each((textNode, datum) => {
            updateLabelNode(textNode, this.getItemConfig(datum.itemId).label, datum.label);
        });
    }

    getTooltipHtml(nodeDatum: WaterfallNodeDatum): _ModuleSupport.TooltipContent {
        const categoryAxis = this.getCategoryAxis();
        const valueAxis = this.getValueAxis();

        if (!this.properties.isValid() || !categoryAxis || !valueAxis) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const { id: seriesId } = this;
        const { xKey, yKey, xName, yName, tooltip } = this.properties;
        const { index, datum, itemId, xValue, yValue } = nodeDatum;
        const {
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
            lineDash = [],
            lineDashOffset,
            cornerRadius,
            name,
            itemStyler,
        } = this.getItemConfig(itemId);

        let format;

        if (itemStyler) {
            format = this.cachedDatumCallback(createDatumId(index, 'tooltip'), () =>
                itemStyler({
                    datum,
                    xKey,
                    yKey,
                    fill,
                    fillOpacity,
                    stroke,
                    strokeWidth,
                    strokeOpacity,
                    lineDash,
                    lineDashOffset,
                    cornerRadius,
                    highlighted: false,
                    seriesId,
                    itemId: nodeDatum.itemId,
                })
            );
        }

        const color = format?.fill ?? fill ?? 'gray';

        const xString = sanitizeHtml(categoryAxis.formatDatum(xValue));
        const yString = sanitizeHtml(valueAxis.formatDatum(yValue));

        const isTotal = this.isTotal(itemId);
        const isSubtotal = this.isSubtotal(itemId);
        let ySubheading;
        if (isTotal) {
            ySubheading = 'Total';
        } else if (isSubtotal) {
            ySubheading = 'Subtotal';
        } else {
            ySubheading = name ?? yName ?? yKey;
        }

        const title = sanitizeHtml(yName);
        const content =
            `<b>${sanitizeHtml(xName ?? xKey)}</b>: ${xString}<br/>` +
            `<b>${sanitizeHtml(ySubheading)}</b>: ${yString}`;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            { seriesId, itemId, datum, xKey, yKey, xName, yName, color, title }
        );
    }

    getLegendData(legendType: _ModuleSupport.ChartLegendType) {
        if (legendType !== 'category') {
            return [];
        }

        const { id, seriesItemTypes } = this;
        const legendData: _ModuleSupport.CategoryLegendDatum[] = [];
        const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.substring(1);

        const { showInLegend } = this.properties;

        seriesItemTypes.forEach((item) => {
            const { fill, stroke, fillOpacity, strokeOpacity, strokeWidth, name } = this.getItemConfig(item);
            legendData.push({
                legendType: 'category',
                id,
                itemId: item,
                seriesId: id,
                enabled: true,
                label: { text: name ?? capitalise(item) },
                symbols: [{ marker: { fill, stroke, fillOpacity, strokeOpacity, strokeWidth } }],
                hideInLegend: !showInLegend,
            });
        });

        return legendData;
    }

    protected override toggleSeriesItem(): void {
        // Legend item toggling is unsupported.
    }

    override animateEmptyUpdateReady({ datumSelection, labelSelection, contextData, paths }: WaterfallAnimationData) {
        const fns = prepareBarAnimationFunctions(collapsedStartingBarPosition(this.isVertical(), this.axes, 'normal'));
        motion.fromToMotion(this.id, 'datums', this.ctx.animationManager, [datumSelection], fns);

        seriesLabelFadeInAnimation(this, 'labels', this.ctx.animationManager, labelSelection);

        const { pointData } = contextData;
        if (!pointData) return;

        const [lineNode] = paths;
        if (this.isVertical()) {
            this.animateConnectorLinesVertical(lineNode, pointData);
        } else {
            this.animateConnectorLinesHorizontal(lineNode, pointData);
        }
    }

    protected animateConnectorLinesHorizontal(lineNode: _ModuleSupport.Path, pointData: WaterfallNodePointDatum[]) {
        const { path: linePath } = lineNode;

        this.updateLineNode(lineNode);

        const valueAxis = this.getValueAxis();
        const valueAxisReversed = valueAxis?.isReversed();
        const compare = valueAxisReversed ? (v: number, v2: number) => v < v2 : (v: number, v2: number) => v > v2;

        const startX = valueAxis?.scale.convert(0);
        const endX = pointData.reduce(
            (end, point) => {
                if (compare(point.x, end)) {
                    end = point.x;
                }
                return end;
            },
            valueAxisReversed ? Infinity : 0
        );

        const scale = (value: number, start1: number, end1: number, start2: number, end2: number) => {
            return ((value - start1) / (end1 - start1)) * (end2 - start2) + start2;
        };

        this.ctx.animationManager.animate({
            id: `${this.id}_connectors`,
            groupId: this.id,
            phase: 'initial',
            from: startX,
            to: endX,
            ease: _ModuleSupport.Motion.easeOut,
            collapsable: false,
            onUpdate(pointX) {
                linePath.clear(true);

                pointData.forEach((point, index) => {
                    const x = scale(pointX, startX, endX, startX, point.x);
                    const x2 = scale(pointX, startX, endX, startX, point.x2);
                    if (index !== 0) {
                        linePath.lineTo(x, point.y);
                    }
                    linePath.moveTo(x2, point.y2);
                });

                lineNode.checkPathDirty();
            },
        });
    }

    protected animateConnectorLinesVertical(lineNode: _ModuleSupport.Path, pointData: WaterfallNodePointDatum[]) {
        const { path: linePath } = lineNode;

        this.updateLineNode(lineNode);

        const valueAxis = this.getValueAxis();
        const valueAxisReversed = valueAxis?.isReversed();
        const compare = valueAxisReversed ? (v: number, v2: number) => v > v2 : (v: number, v2: number) => v < v2;

        const startY = valueAxis?.scale.convert(0);
        const endY = pointData.reduce(
            (end, point) => {
                if (compare(point.y, end)) {
                    end = point.y;
                }
                return end;
            },
            valueAxisReversed ? 0 : Infinity
        );

        const scale = (value: number, start1: number, end1: number, start2: number, end2: number) => {
            return ((value - start1) / (end1 - start1)) * (end2 - start2) + start2;
        };

        this.ctx.animationManager.animate({
            id: `${this.id}_connectors`,
            groupId: this.id,
            phase: 'initial',
            from: startY,
            to: endY,
            ease: _ModuleSupport.Motion.easeOut,
            collapsable: false,
            onUpdate(pointY) {
                linePath.clear(true);

                pointData.forEach((point, index) => {
                    const y = scale(pointY, startY, endY, startY, point.y);
                    const y2 = scale(pointY, startY, endY, startY, point.y2);
                    if (index !== 0) {
                        linePath.lineTo(point.x, y);
                    }
                    linePath.moveTo(point.x2, y2);
                });

                lineNode.checkPathDirty();
            },
        });
    }

    override animateReadyResize(data: WaterfallAnimationData) {
        super.animateReadyResize(data);
        this.resetConnectorLinesPath(data);
    }

    protected override updatePaths(opts: {
        seriesHighlighted?: boolean;
        itemId?: string;
        contextData: WaterfallContext;
        paths: _ModuleSupport.Path[];
        seriesIdx: number;
    }) {
        this.resetConnectorLinesPath({ contextData: opts.contextData, paths: opts.paths });
    }

    resetConnectorLinesPath({
        contextData,
        paths,
    }: {
        contextData: WaterfallContext;
        paths: Array<_ModuleSupport.Path>;
    }) {
        if (paths.length === 0) {
            return;
        }

        const [lineNode] = paths;

        this.updateLineNode(lineNode);

        const { path: linePath } = lineNode;
        linePath.clear(true);

        const { pointData } = contextData;
        if (!pointData) {
            return;
        }
        pointData.forEach((point, index) => {
            if (index !== 0) {
                linePath.lineTo(point.x, point.y);
            }
            linePath.moveTo(point.x2, point.y2);
        });

        lineNode.checkPathDirty();
    }

    protected updateLineNode(lineNode: _ModuleSupport.Path) {
        const { stroke, strokeWidth, strokeOpacity, lineDash, lineDashOffset } = this.properties.line;
        lineNode.setProperties({
            fill: undefined,
            stroke,
            strokeWidth: this.getStrokeWidth(strokeWidth),
            strokeOpacity,
            lineDash,
            lineDashOffset,
            lineJoin: 'round',
            pointerEvents: _ModuleSupport.PointerEvents.None,
        });
    }

    protected isLabelEnabled() {
        const { positive, negative, total } = this.properties.item;
        return positive.label.enabled || negative.label.enabled || total.label.enabled;
    }

    protected override onDataChange() {}

    protected computeFocusBounds({
        datumIndex,
        seriesRect,
    }: _ModuleSupport.PickFocusInputs): _ModuleSupport.BBox | undefined {
        return computeBarFocusBounds(this.contextNodeData?.nodeData[datumIndex], this.contentGroup, seriesRect);
    }
}
