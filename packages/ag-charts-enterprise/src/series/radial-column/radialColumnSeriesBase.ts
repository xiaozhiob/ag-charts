import type { AgRadialSeriesStyle } from 'ag-charts-community';
import { _ModuleSupport } from 'ag-charts-community';

import { AngleCategoryAxis } from '../../axes/angle-category/angleCategoryAxis';
import type { RadialColumnSeriesBaseProperties } from './radialColumnSeriesBaseProperties';

const {
    isDefined,
    isFiniteNumber,
    ChartAxisDirection,
    PolarAxis,
    diff,
    fixNumericExtent,
    groupAccumulativeValueProperty,
    keyProperty,
    mergeDefaults,
    normaliseGroupTo,
    resetLabelFn,
    seriesLabelFadeInAnimation,
    seriesLabelFadeOutAnimation,
    valueProperty,
    animationValidation,
    createDatumId,
    SeriesNodePickMode,
    normalizeAngle360,
    sanitizeHtml,
    BandScale,
    motion,
} = _ModuleSupport;

class RadialColumnSeriesNodeEvent<
    TEvent extends string = _ModuleSupport.SeriesNodeEventTypes,
> extends _ModuleSupport.SeriesNodeEvent<RadialColumnNodeDatum, TEvent> {
    readonly angleKey?: string;
    readonly radiusKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RadialColumnNodeDatum, series: RadialColumnSeriesBase<any>) {
        super(type, nativeEvent, datum, series);
        this.angleKey = series.properties.angleKey;
        this.radiusKey = series.properties.radiusKey;
    }
}

interface RadialColumnLabelNodeDatum {
    text: string;
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
}

export interface RadialColumnNodeDatum extends _ModuleSupport.SeriesNodeDatum {
    readonly label?: RadialColumnLabelNodeDatum;
    readonly angleValue: any;
    readonly radiusValue: any;
    readonly negative: boolean;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly stackInnerRadius: number;
    readonly stackOuterRadius: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly axisInnerRadius: number;
    readonly axisOuterRadius: number;
    readonly columnWidth: number;
    readonly index: number;
}

export abstract class RadialColumnSeriesBase<
    ItemPathType extends _ModuleSupport.Sector | _ModuleSupport.RadialColumnShape,
> extends _ModuleSupport.PolarSeries<RadialColumnNodeDatum, RadialColumnSeriesBaseProperties<any>, ItemPathType> {
    protected override readonly NodeEvent = RadialColumnSeriesNodeEvent;

    private readonly groupScale = new BandScale<string>();

    constructor(
        moduleCtx: _ModuleSupport.ModuleContext,
        {
            animationResetFns,
        }: {
            animationResetFns?: {
                item?: (
                    node: ItemPathType,
                    datum: RadialColumnNodeDatum
                ) => _ModuleSupport.AnimationValue & Partial<ItemPathType>;
            };
        }
    ) {
        super({
            moduleCtx,
            useLabelLayer: true,
            canHaveAxes: true,
            pickModes: [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            animationResetFns: {
                ...animationResetFns,
                label: resetLabelFn,
            },
        });
    }

    override addChartEventListeners(): void {
        this.destroyFns.push(
            this.ctx.chartEventManager?.addListener('legend-item-click', (event) => this.onLegendItemClick(event)),
            this.ctx.chartEventManager?.addListener('legend-item-double-click', (event) =>
                this.onLegendItemDoubleClick(event)
            )
        );
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection): any[] {
        const { dataModel, processedData } = this;
        if (!processedData || !dataModel) return [];

        if (direction === ChartAxisDirection.X) {
            return dataModel.getDomain(this, 'angleValue', 'key', processedData);
        } else {
            const yExtent = dataModel.getDomain(this, 'radiusValue-end', 'value', processedData);
            const fixedYExtent = [yExtent[0] > 0 ? 0 : yExtent[0], yExtent[1] < 0 ? 0 : yExtent[1]];
            return fixNumericExtent(fixedYExtent);
        }
    }

    protected abstract getStackId(): string;

    override async processData(dataController: _ModuleSupport.DataController) {
        const { angleKey, radiusKey, normalizedTo, visible } = this.properties;
        const animationEnabled = !this.ctx.animationManager.isSkipped();

        if (!this.properties.isValid() || !(visible || animationEnabled)) return;

        const stackGroupId = this.getStackId();
        const stackGroupTrailingId = `${stackGroupId}-trailing`;
        const extraProps = [];

        if (isDefined(normalizedTo)) {
            extraProps.push(normaliseGroupTo([stackGroupId, stackGroupTrailingId], Math.abs(normalizedTo), 'range'));
        }

        if (animationEnabled && this.processedData) {
            extraProps.push(diff(this.id, this.processedData));
        }
        if (animationEnabled) {
            extraProps.push(animationValidation());
        }

        const visibleProps = visible || !animationEnabled ? {} : { forceValue: 0 };

        const radiusScaleType = this.axes[ChartAxisDirection.Y]?.scale.type;
        const angleScaleType = this.axes[ChartAxisDirection.X]?.scale.type;

        await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                keyProperty(angleKey, angleScaleType, { id: 'angleValue' }),
                valueProperty(radiusKey, radiusScaleType, {
                    id: 'radiusValue-raw',
                    invalidValue: null,
                    ...visibleProps,
                }),
                ...groupAccumulativeValueProperty(
                    radiusKey,
                    'normal',
                    'current',
                    {
                        id: `radiusValue-end`,
                        rangeId: `radiusValue-range`,
                        invalidValue: null,
                        groupId: stackGroupId,
                        separateNegative: true,
                        ...visibleProps,
                    },
                    radiusScaleType
                ),
                ...groupAccumulativeValueProperty(
                    radiusKey,
                    'trailing',
                    'current',
                    {
                        id: `radiusValue-start`,
                        invalidValue: null,
                        groupId: stackGroupTrailingId,
                        separateNegative: true,
                        ...visibleProps,
                    },
                    radiusScaleType
                ),
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
        if (r !== cache.r || cx !== cache.cx || cy !== cache.cy) {
            this.circleCache = { r, cx, cy };
            return true;
        }
        return false;
    }

    protected isRadiusAxisReversed() {
        return this.axes[ChartAxisDirection.Y]?.isReversed();
    }

    maybeRefreshNodeData() {
        const circleChanged = this.didCircleChange();
        if (!circleChanged && !this.nodeDataRefresh) return;
        const { nodeData = [] } = this.createNodeData() ?? {};
        this.nodeData = nodeData;
        this.nodeDataRefresh = false;
    }

    protected getAxisInnerRadius() {
        const radiusAxis = this.axes[ChartAxisDirection.Y];
        return radiusAxis instanceof PolarAxis ? this.radius * radiusAxis.innerRadiusRatio : 0;
    }

    override createNodeData() {
        const { processedData, dataModel, groupScale } = this;

        if (
            !dataModel ||
            !processedData ||
            processedData.type !== 'ungrouped' ||
            processedData.rawData.length === 0 ||
            !this.properties.isValid()
        ) {
            return;
        }

        const angleAxis = this.axes[ChartAxisDirection.X];
        const radiusAxis = this.axes[ChartAxisDirection.Y];
        const angleScale = angleAxis?.scale;
        const radiusScale = radiusAxis?.scale;

        if (!angleScale || !radiusScale) {
            return;
        }

        const angleValues = dataModel.resolveKeysById(this, `angleValue`, processedData);
        const radiusStartValues = dataModel.resolveColumnById(this, `radiusValue-start`, processedData);
        const radiusEndValues = dataModel.resolveColumnById(this, `radiusValue-end`, processedData);
        const radiusRawValues = dataModel.resolveColumnById(this, `radiusValue-raw`, processedData);
        const radiusRangeIndex = dataModel.resolveProcessedDataIndexById(this, `radiusValue-range`);

        let groupPaddingInner = 0;
        let groupPaddingOuter = 0;
        if (angleAxis instanceof AngleCategoryAxis) {
            groupPaddingInner = angleAxis.groupPaddingInner;
            groupPaddingOuter = angleAxis.paddingInner;
        }

        const groupAngleStep = angleScale.bandwidth ?? 0;
        const paddedGroupAngleStep = groupAngleStep * (1 - groupPaddingOuter);

        const { index: groupIndex, visibleGroupCount } = this.ctx.seriesStateManager.getVisiblePeerGroupIndex(this);
        groupScale.domain = Array.from({ length: visibleGroupCount }).map((_, i) => String(i));
        groupScale.range = [-paddedGroupAngleStep / 2, paddedGroupAngleStep / 2];
        groupScale.paddingInner = visibleGroupCount > 1 ? groupPaddingInner : 0;

        const radiusAxisReversed = this.isRadiusAxisReversed();
        const axisInnerRadius = radiusAxisReversed ? this.radius : this.getAxisInnerRadius();
        const axisOuterRadius = radiusAxisReversed ? this.getAxisInnerRadius() : this.radius;

        const axisTotalRadius = axisOuterRadius + axisInnerRadius;

        const { angleKey, radiusKey, angleName, radiusName, label } = this.properties;

        const getLabelNodeDatum = (
            datum: RadialColumnNodeDatum,
            radiusDatum: number,
            x: number,
            y: number
        ): RadialColumnLabelNodeDatum | undefined => {
            const labelText = this.getLabelText(label, {
                value: radiusDatum,
                datum,
                angleKey,
                radiusKey,
                angleName,
                radiusName,
            });

            if (labelText) {
                return { x, y, text: labelText, textAlign: 'center', textBaseline: 'middle' };
            }
        };

        const nodeData: RadialColumnNodeDatum[] = [];
        const context = { itemId: radiusKey, nodeData, labelData: nodeData };
        if (!this.visible) return context;

        const { rawData, aggregation } = processedData;
        rawData.forEach((datum, datumIndex) => {
            const angleDatum = angleValues[datumIndex];
            if (angleDatum == null) return;

            const radiusDatum = radiusRawValues[datumIndex];
            const isPositive = radiusDatum >= 0 && !Object.is(radiusDatum, -0);
            const innerRadiusDatum = radiusStartValues[datumIndex];
            const outerRadiusDatum = radiusEndValues[datumIndex];
            const datumAggregation = aggregation![datumIndex];
            const radiusRange = datumAggregation[radiusRangeIndex][isPositive ? 1 : 0] ?? 0;
            const negative = isPositive === radiusAxisReversed;
            if (innerRadiusDatum === undefined || outerRadiusDatum === undefined) return;

            let startAngle: number;
            let endAngle: number;
            if (rawData.length === 1) {
                startAngle = -0.5 * Math.PI;
                endAngle = 1.5 * Math.PI;
            } else {
                const groupAngle = angleScale.convert(angleDatum);
                startAngle = normalizeAngle360(groupAngle + groupScale.convert(String(groupIndex)));
                endAngle = normalizeAngle360(startAngle + groupScale.bandwidth);
            }
            const angle = startAngle + groupScale.bandwidth / 2;

            const innerRadius = axisTotalRadius - radiusScale.convert(innerRadiusDatum);
            const outerRadius = axisTotalRadius - radiusScale.convert(outerRadiusDatum);
            const midRadius = (innerRadius + outerRadius) / 2;

            const stackInnerRadius = axisTotalRadius - radiusScale.convert(0);
            const stackOuterRadius = axisTotalRadius - radiusScale.convert(radiusRange);

            const x = Math.cos(angle) * midRadius;
            const y = Math.sin(angle) * midRadius;

            const labelNodeDatum = this.properties.label.enabled
                ? getLabelNodeDatum(datum, radiusDatum, x, y)
                : undefined;

            const columnWidth = this.getColumnWidth(startAngle, endAngle);

            nodeData.push({
                series: this,
                datum,
                point: { x, y, size: 0 },
                midPoint: { x, y },
                label: labelNodeDatum,
                angleValue: angleDatum,
                radiusValue: radiusDatum,
                negative,
                innerRadius,
                outerRadius,
                stackInnerRadius,
                stackOuterRadius,
                startAngle,
                endAngle,
                axisInnerRadius,
                axisOuterRadius,
                columnWidth,
                index: datumIndex,
            });
        });

        return { itemId: radiusKey, nodeData, labelData: nodeData };
    }

    protected getColumnWidth(_startAngle: number, _endAngle: number) {
        return NaN;
    }

    update({ seriesRect }: { seriesRect?: _ModuleSupport.BBox }) {
        const resize = this.checkResize(seriesRect);
        this.maybeRefreshNodeData();

        this.contentGroup.translationX = this.centerX;
        this.contentGroup.translationY = this.centerY;
        this.highlightGroup.translationX = this.centerX;
        this.highlightGroup.translationY = this.centerY;
        if (this.labelGroup) {
            this.labelGroup.translationX = this.centerX;
            this.labelGroup.translationY = this.centerY;
        }

        this.updateSectorSelection(this.itemSelection, false);
        this.updateSectorSelection(this.highlightSelection, true);
        this.updateLabels();

        if (resize) {
            this.animationState.transition('resize');
        }
        this.animationState.transition('update');
    }

    protected abstract updateItemPath(
        node: ItemPathType,
        datum: RadialColumnNodeDatum,
        highlight: boolean,
        format: AgRadialSeriesStyle | undefined
    ): void;

    protected updateSectorSelection(
        selection: _ModuleSupport.Selection<ItemPathType, RadialColumnNodeDatum>,
        highlighted: boolean
    ) {
        let selectionData: RadialColumnNodeDatum[] = [];
        if (highlighted) {
            const activeHighlight = this.ctx.highlightManager?.getActiveHighlight();
            if (activeHighlight?.datum && activeHighlight.series === this) {
                selectionData = [activeHighlight as RadialColumnNodeDatum];
            }
        } else {
            selectionData = this.nodeData;
        }

        const {
            fill,
            fillOpacity,
            stroke,
            strokeOpacity,
            strokeWidth,
            lineDash,
            lineDashOffset,
            cornerRadius,
            angleKey,
            radiusKey,
        } = mergeDefaults(highlighted ? this.properties.highlightStyle.item : null, this.properties);
        const { itemStyler } = this.properties;
        const formatType = highlighted ? 'highlight' : 'node';

        selection
            .update(selectionData, undefined, (datum) => this.getDatumId(datum))
            .each((node, datum) => {
                const format = itemStyler
                    ? this.cachedDatumCallback(createDatumId(this.getDatumId(datum), formatType), () =>
                          itemStyler({
                              datum: datum.datum,
                              fill,
                              fillOpacity,
                              stroke,
                              strokeWidth,
                              strokeOpacity,
                              lineDash,
                              lineDashOffset,
                              cornerRadius,
                              highlighted,
                              angleKey,
                              radiusKey,
                              seriesId: this.id,
                          })
                      )
                    : undefined;

                this.updateItemPath(node, datum, highlighted, format);
                node.fill = format?.fill ?? fill;
                node.fillOpacity = format?.fillOpacity ?? fillOpacity;
                node.stroke = format?.stroke ?? stroke;
                node.strokeWidth = format?.strokeWidth ?? strokeWidth;
                node.strokeOpacity = format?.strokeOpacity ?? strokeOpacity;
                node.lineDash = format?.lineDash ?? lineDash;
                node.lineDashOffset = format?.lineDashOffset ?? lineDashOffset;
                node.cornerRadius = format?.cornerRadius ?? cornerRadius;
                node.lineJoin = 'round';
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

    protected abstract getColumnTransitionFunctions(): {
        fromFn: _ModuleSupport.FromToMotionPropFn<any, any, any>;
        toFn: _ModuleSupport.FromToMotionPropFn<any, any, any>;
    };

    protected override animateEmptyUpdateReady() {
        const { labelSelection } = this;

        const fns = this.getColumnTransitionFunctions();
        motion.fromToMotion(this.id, 'datums', this.ctx.animationManager, [this.itemSelection], fns);
        seriesLabelFadeInAnimation(this, 'labels', this.ctx.animationManager, labelSelection);
    }

    override animateClearingUpdateEmpty() {
        const { itemSelection } = this;
        const { animationManager } = this.ctx;

        const fns = this.getColumnTransitionFunctions();
        motion.fromToMotion(this.id, 'datums', animationManager, [itemSelection], fns);

        seriesLabelFadeOutAnimation(this, 'labels', animationManager, this.labelSelection);
    }

    getTooltipHtml(nodeDatum: RadialColumnNodeDatum): _ModuleSupport.TooltipContent {
        const { id: seriesId, axes, dataModel } = this;
        const {
            angleKey,
            radiusKey,
            angleName,
            radiusName,
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
            lineDash,
            lineDashOffset,
            cornerRadius,
            itemStyler,
            tooltip,
        } = this.properties;
        const { angleValue, radiusValue, datum, itemId } = nodeDatum;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !(xAxis && yAxis && isFiniteNumber(radiusValue)) || !dataModel) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const angleString = xAxis.formatDatum(angleValue);
        const radiusString = yAxis.formatDatum(radiusValue);
        const title = sanitizeHtml(radiusName);
        const content = sanitizeHtml(`${angleString}: ${radiusString}`);

        const { fill: color } = (itemStyler &&
            this.cachedDatumCallback(createDatumId(this.getDatumId(datum), 'tooltip'), () =>
                itemStyler({
                    highlighted: false,
                    seriesId,
                    datum,
                    angleKey,
                    radiusKey,
                    fill,
                    fillOpacity,
                    stroke,
                    strokeWidth,
                    strokeOpacity,
                    lineDash,
                    lineDashOffset,
                    cornerRadius,
                })
            )) ?? { fill };

        return tooltip.toTooltipHtml(
            { title, backgroundColor: fill, content },
            {
                seriesId,
                datum,
                color,
                title,
                angleKey,
                radiusKey,
                angleName,
                radiusName,
                angleValue,
                itemId,
                radiusValue,
            }
        );
    }

    protected override pickNodeClosestDatum(
        point: _ModuleSupport.Point
    ): _ModuleSupport.SeriesNodePickMatch | undefined {
        return this.pickNodeNearestDistantObject(point, this.itemSelection.nodes());
    }

    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] {
        if (!this.properties.isValid() || legendType !== 'category') {
            return [];
        }

        const { id: seriesId, visible } = this;

        const { radiusKey, radiusName, fill, stroke, fillOpacity, strokeOpacity, strokeWidth, showInLegend } =
            this.properties;

        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId: radiusKey,
                seriesId,
                enabled: visible,
                label: {
                    text: radiusName ?? radiusKey,
                },
                symbols: [
                    {
                        marker: {
                            fill: fill ?? 'rgba(0, 0, 0, 0)',
                            stroke: stroke ?? 'rgba(0, 0, 0, 0)',
                            fillOpacity: fillOpacity ?? 1,
                            strokeOpacity: strokeOpacity ?? 1,
                            strokeWidth,
                        },
                    },
                ],
                hideInLegend: !showInLegend,
            },
        ];
    }

    private getDatumId(datum: RadialColumnNodeDatum) {
        return createDatumId(datum.angleValue);
    }

    override computeLabelsBBox() {
        return null;
    }
}
