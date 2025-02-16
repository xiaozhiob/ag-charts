import { _ModuleSupport } from 'ag-charts-community';

import { RadiusCategoryAxis } from '../../axes/radius-category/radiusCategoryAxis';
import type { RadialColumnNodeDatum } from '../radial-column/radialColumnSeriesBase';
import { RadialBarSeriesProperties } from './radialBarSeriesProperties';
import { prepareRadialBarSeriesAnimationFunctions, resetRadialBarSelectionsFn } from './radialBarUtil';

const {
    ChartAxisDirection,
    PolarAxis,
    diff,
    isDefined,
    groupAccumulativeValueProperty,
    keyProperty,
    mergeDefaults,
    normaliseGroupTo,
    valueProperty,
    fixNumericExtent,
    resetLabelFn,
    seriesLabelFadeInAnimation,
    seriesLabelFadeOutAnimation,
    animationValidation,
    isFiniteNumber,
    angleBetween,
    sanitizeHtml,
    createDatumId,
    BandScale,
    Sector,
    SectorBox,
    motion,
} = _ModuleSupport;

class RadialBarSeriesNodeEvent<
    TEvent extends string = _ModuleSupport.SeriesNodeEventTypes,
> extends _ModuleSupport.SeriesNodeEvent<RadialBarNodeDatum, TEvent> {
    readonly angleKey?: string;
    readonly radiusKey?: string;
    constructor(type: TEvent, nativeEvent: Event, datum: RadialBarNodeDatum, series: RadialBarSeries) {
        super(type, nativeEvent, datum, series);
        this.angleKey = series.properties.angleKey;
        this.radiusKey = series.properties.radiusKey;
    }
}

interface RadialBarLabelNodeDatum {
    text: string;
    x: number;
    y: number;
    textAlign: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
}

export interface RadialBarNodeDatum extends _ModuleSupport.SeriesNodeDatum {
    readonly label?: RadialBarLabelNodeDatum;
    readonly angleValue: any;
    readonly radiusValue: any;
    readonly innerRadius: number;
    readonly outerRadius: number;
    readonly startAngle: number;
    readonly endAngle: number;
    readonly clipSector: _ModuleSupport.SectorBox;
    readonly reversed: boolean;
    readonly index: number;
}

export class RadialBarSeries extends _ModuleSupport.PolarSeries<
    RadialBarNodeDatum,
    RadialBarSeriesProperties<any>,
    _ModuleSupport.Sector
> {
    static readonly className = 'RadialBarSeries';
    static readonly type = 'radial-bar' as const;

    override properties = new RadialBarSeriesProperties();

    protected override readonly NodeEvent = RadialBarSeriesNodeEvent;

    private readonly groupScale = new BandScale<string>();

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super({
            moduleCtx,
            useLabelLayer: true,
            canHaveAxes: true,
            animationResetFns: {
                item: resetRadialBarSelectionsFn,
                label: resetLabelFn,
            },
        });
    }

    protected override nodeFactory(): _ModuleSupport.Sector {
        return new Sector();
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
            const xExtent = dataModel.getDomain(this, 'angleValue-end', 'value', processedData);
            const fixedXExtent = [xExtent[0] > 0 ? 0 : xExtent[0], xExtent[1] < 0 ? 0 : xExtent[1]];
            return fixNumericExtent(fixedXExtent);
        } else {
            return dataModel.getDomain(this, 'radiusValue', 'key', processedData);
        }
    }

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

        if (animationEnabled) {
            if (this.processedData) {
                extraProps.push(diff(this.id, this.processedData));
            }
            extraProps.push(animationValidation());
        }

        const visibleProps = this.visible || !animationEnabled ? {} : { forceValue: 0 };

        const radiusScaleType = this.axes[ChartAxisDirection.Y]?.scale.type;
        const angleScaleType = this.axes[ChartAxisDirection.X]?.scale.type;

        await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                keyProperty(radiusKey, radiusScaleType, { id: 'radiusValue' }),
                valueProperty(angleKey, angleScaleType, {
                    id: 'angleValue-raw',
                    invalidValue: null,
                    ...visibleProps,
                }),
                ...groupAccumulativeValueProperty(
                    angleKey,
                    'normal',
                    'current',
                    {
                        id: `angleValue-end`,
                        rangeId: `angleValue-range`,
                        invalidValue: null,
                        groupId: stackGroupId,
                        separateNegative: true,
                        ...visibleProps,
                    },
                    angleScaleType
                ),
                ...groupAccumulativeValueProperty(
                    angleKey,
                    'trailing',
                    'current',
                    {
                        id: `angleValue-start`,
                        invalidValue: null,
                        groupId: stackGroupTrailingId,
                        separateNegative: true,
                        ...visibleProps,
                    },
                    angleScaleType
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
        if (!(r === cache.r && cx === cache.cx && cy === cache.cy)) {
            this.circleCache = { r, cx, cy };
            return true;
        }
        return false;
    }

    protected maybeRefreshNodeData() {
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
        const { processedData, dataModel } = this;

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

        const radiusValues = dataModel.resolveKeysById<number>(this, 'radiusValue', processedData);
        const angleStartValues = dataModel.resolveColumnById(this, `angleValue-start`, processedData);
        const angleEndValues = dataModel.resolveColumnById(this, `angleValue-end`, processedData);
        const angleRawValues = dataModel.resolveColumnById(this, `angleValue-raw`, processedData);

        const angleRangeIndex = dataModel.resolveProcessedDataIndexById(this, `angleValue-range`);

        let groupPaddingInner = 0;
        if (radiusAxis instanceof RadiusCategoryAxis) {
            groupPaddingInner = radiusAxis.groupPaddingInner;
        }

        const { groupScale } = this;
        const { index: groupIndex, visibleGroupCount } = this.ctx.seriesStateManager.getVisiblePeerGroupIndex(this);
        groupScale.domain = Array.from({ length: visibleGroupCount }).map((_, i) => String(i));
        groupScale.range = [0, Math.abs(radiusScale.bandwidth ?? 0)];
        groupScale.paddingInner = visibleGroupCount > 1 ? groupPaddingInner : 0;

        const barWidth = groupScale.bandwidth >= 1 ? groupScale.bandwidth : groupScale.rawBandwidth;

        const angleAxisReversed = angleAxis.isReversed();
        const radiusAxisReversed = radiusAxis.isReversed();

        const axisInnerRadius = radiusAxisReversed ? this.radius : this.getAxisInnerRadius();
        const axisOuterRadius = radiusAxisReversed ? this.getAxisInnerRadius() : this.radius;
        const axisTotalRadius = axisOuterRadius + axisInnerRadius;

        const { angleKey, radiusKey, angleName, radiusName, label } = this.properties;

        const getLabelNodeDatum = (
            datum: RadialColumnNodeDatum,
            angleDatum: number,
            x: number,
            y: number
        ): RadialBarLabelNodeDatum | undefined => {
            const labelText = this.getLabelText(label, {
                value: angleDatum,
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

        const nodeData: RadialBarNodeDatum[] = [];
        const context = { itemId: radiusKey, nodeData, labelData: nodeData };
        if (!this.visible) return context;

        const { rawData, aggregation } = processedData;
        rawData.forEach((datum, datumIndex) => {
            const radiusDatum = radiusValues[datumIndex];
            if (radiusDatum == null) return;

            const angleDatum = angleRawValues[datumIndex];
            const angleStartDatum = angleStartValues[datumIndex];
            const angleEndDatum = angleEndValues[datumIndex];
            const isPositive = angleDatum >= 0 && !Object.is(angleDatum, -0);
            const datumAggregation = aggregation![datumIndex];
            const angleRange = datumAggregation[angleRangeIndex][isPositive ? 1 : 0];
            const reversed = isPositive === angleAxisReversed;

            let startAngle = angleScale.convert(angleStartDatum, true);
            let endAngle = angleScale.convert(angleEndDatum, true);

            let rangeStartAngle = angleScale.convert(0, true);
            let rangeEndAngle = angleScale.convert(angleRange, true);

            if (reversed) {
                [rangeStartAngle, rangeEndAngle] = [rangeEndAngle, rangeStartAngle];
                [startAngle, endAngle] = [endAngle, startAngle];
            }

            const dataRadius = axisTotalRadius - radiusScale.convert(radiusDatum);
            const innerRadius = dataRadius + groupScale.convert(String(groupIndex));
            const outerRadius = innerRadius + barWidth;
            const midRadius = (innerRadius + outerRadius) / 2;
            const midAngle = startAngle + angleBetween(startAngle, endAngle) / 2;
            const x = Math.cos(midAngle) * midRadius;
            const y = Math.sin(midAngle) * midRadius;
            const labelNodeDatum = this.properties.label.enabled
                ? getLabelNodeDatum(datum, angleDatum, x, y)
                : undefined;

            const clipSector = new SectorBox(startAngle, endAngle, innerRadius, outerRadius);

            nodeData.push({
                series: this,
                datum,
                point: { x, y, size: 0 },
                midPoint: { x, y },
                label: labelNodeDatum,
                angleValue: angleDatum,
                radiusValue: radiusDatum,
                innerRadius,
                outerRadius,
                startAngle: rangeStartAngle,
                endAngle: rangeEndAngle,
                clipSector,
                reversed,
                index: datumIndex,
            });
        });

        return context;
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

    protected updateSectorSelection(
        selection: _ModuleSupport.Selection<_ModuleSupport.Sector, RadialBarNodeDatum>,
        highlighted: boolean
    ) {
        let selectionData: RadialBarNodeDatum[] = [];
        if (highlighted) {
            const activeHighlight = this.ctx.highlightManager?.getActiveHighlight();
            if (activeHighlight?.datum && activeHighlight.series === this) {
                selectionData = [activeHighlight as RadialBarNodeDatum];
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
                              seriesId: this.id,
                              datum: datum.datum,
                              highlighted,
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
                      )
                    : undefined;

                node.fill = format?.fill ?? fill;
                node.fillOpacity = format?.fillOpacity ?? fillOpacity;
                node.stroke = format?.stroke ?? stroke;
                node.strokeWidth = format?.strokeWidth ?? strokeWidth;
                node.strokeOpacity = format?.strokeOpacity ?? strokeOpacity;
                node.lineDash = format?.lineDash ?? lineDash;
                node.lineDashOffset = format?.lineDashOffset ?? lineDashOffset;
                node.lineJoin = 'round';
                node.inset = stroke != null ? (format?.strokeWidth ?? strokeWidth) / 2 : 0;
                node.startInnerCornerRadius = datum.reversed ? format?.cornerRadius ?? cornerRadius : 0;
                node.startOuterCornerRadius = datum.reversed ? format?.cornerRadius ?? cornerRadius : 0;
                node.endInnerCornerRadius = datum.reversed ? 0 : format?.cornerRadius ?? cornerRadius;
                node.endOuterCornerRadius = datum.reversed ? 0 : format?.cornerRadius ?? cornerRadius;

                if (highlighted) {
                    node.startAngle = datum.startAngle;
                    node.endAngle = datum.endAngle;
                    node.clipSector = datum.clipSector;
                    node.innerRadius = datum.innerRadius;
                    node.outerRadius = datum.outerRadius;
                }
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

    private getBarTransitionFunctions() {
        const angleScale = this.axes[ChartAxisDirection.X]?.scale;
        let axisZeroAngle = 0;
        if (!angleScale) {
            return prepareRadialBarSeriesAnimationFunctions(axisZeroAngle);
        }

        const d0 = Math.min(angleScale.domain[0], angleScale.domain[1]);
        const d1 = Math.max(angleScale.domain[0], angleScale.domain[1]);
        if (d0 <= 0 && d1 >= 0) {
            axisZeroAngle = angleScale.convert(0);
        }

        return prepareRadialBarSeriesAnimationFunctions(axisZeroAngle);
    }

    protected override animateEmptyUpdateReady() {
        const { labelSelection } = this;

        const fns = this.getBarTransitionFunctions();
        motion.fromToMotion(this.id, 'datums', this.ctx.animationManager, [this.itemSelection], fns);
        seriesLabelFadeInAnimation(this, 'labels', this.ctx.animationManager, labelSelection);
    }

    override animateClearingUpdateEmpty() {
        const { itemSelection } = this;
        const { animationManager } = this.ctx;

        const fns = this.getBarTransitionFunctions();
        motion.fromToMotion(this.id, 'datums', animationManager, [itemSelection], fns);

        seriesLabelFadeOutAnimation(this, 'labels', animationManager, this.labelSelection);
    }

    getTooltipHtml(nodeDatum: RadialBarNodeDatum): _ModuleSupport.TooltipContent {
        const { id: seriesId, axes, dataModel } = this;
        const {
            angleKey,
            angleName,
            radiusKey,
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

        if (!this.properties.isValid() || !(xAxis && yAxis && isFiniteNumber(angleValue)) || !dataModel) {
            return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;
        }

        const angleString = xAxis.formatDatum(angleValue);
        const radiusString = yAxis.formatDatum(radiusValue);
        const title = sanitizeHtml(angleName);
        const content = sanitizeHtml(`${radiusString}: ${angleString}`);

        const { fill: color } = (itemStyler &&
            this.cachedDatumCallback(createDatumId(this.getDatumId(nodeDatum), 'tooltip'), () =>
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

        const { angleKey, angleName, fill, stroke, fillOpacity, strokeOpacity, strokeWidth, showInLegend } =
            this.properties;

        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId: angleKey,
                seriesId,
                enabled: visible,
                label: {
                    text: angleName ?? angleKey,
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

    private getDatumId(datum: RadialBarNodeDatum) {
        return createDatumId(datum.radiusValue);
    }

    override computeLabelsBBox() {
        return null;
    }

    protected getStackId() {
        const groupIndex = this.seriesGrouping?.groupIndex ?? this.id;
        return `radialBar-stack-${groupIndex}-xValues`;
    }
}
