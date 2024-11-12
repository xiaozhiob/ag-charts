import { type AgCandlestickSeriesItemOptions, type AgOhlcSeriesItemType, _ModuleSupport } from 'ag-charts-community';

import { visibleRange } from '../../utils/aggregation';
import type { CandlestickBaseGroup } from '../candlestick/candlestickGroup';
import type { CandlestickSeriesProperties } from '../candlestick/candlestickSeriesProperties';
import type { CandlestickNodeBaseDatum } from '../candlestick/candlestickTypes';
import { prepareCandlestickAnimationFunctions } from '../candlestick/candlestickUtil';
import { CLOSE, HIGH, LOW, OPEN, type OhlcSeriesDataAggregationFilter, SPAN, aggregateData } from './ohlcAggregation';

const {
    fixNumericExtent,
    keyProperty,
    findMinMax,
    SeriesNodePickMode,
    ChartAxisDirection,
    SMALLEST_KEY_INTERVAL,
    valueProperty,
    diff,
    animationValidation,
    sanitizeHtml,
    Logger,
    ContinuousScale,
    motion,
} = _ModuleSupport;

class CandlestickSeriesNodeEvent<
    TEvent extends string = _ModuleSupport.SeriesNodeEventTypes,
> extends _ModuleSupport.SeriesNodeEvent<CandlestickNodeBaseDatum, TEvent> {
    readonly xKey?: string;
    readonly openKey?: string;
    readonly closeKey?: string;
    readonly highKey?: string;
    readonly lowKey?: string;

    constructor(
        type: TEvent,
        nativeEvent: Event,
        datum: CandlestickNodeBaseDatum,
        series: OhlcSeriesBase<CandlestickBaseGroup<CandlestickNodeBaseDatum, any>, any, any, CandlestickNodeBaseDatum>
    ) {
        super(type, nativeEvent, datum, series);
        this.xKey = series.properties.xKey;
        this.openKey = series.properties.openKey;
        this.closeKey = series.properties.closeKey;
        this.highKey = series.properties.highKey;
        this.lowKey = series.properties.lowKey;
    }
}

export abstract class OhlcSeriesBase<
    TItemShapeGroup extends CandlestickBaseGroup<TNodeDatum, TItemOptions>,
    TItemOptions extends AgCandlestickSeriesItemOptions,
    TSeriesOptions extends CandlestickSeriesProperties<any>,
    TNodeDatum extends CandlestickNodeBaseDatum,
> extends _ModuleSupport.AbstractBarSeries<TItemShapeGroup, TSeriesOptions, TNodeDatum> {
    protected override readonly NodeEvent = CandlestickSeriesNodeEvent;

    private dataAggregationFilters: OhlcSeriesDataAggregationFilter[] | undefined = undefined;

    constructor(
        moduleCtx: _ModuleSupport.ModuleContext,
        datumAnimationResetFnc: (
            node: TItemShapeGroup,
            datum: TNodeDatum
        ) => _ModuleSupport.AnimationValue & Partial<TItemShapeGroup>
    ) {
        super({
            moduleCtx,
            pickModes: [SeriesNodePickMode.AXIS_ALIGNED, SeriesNodePickMode.EXACT_SHAPE_MATCH],
            directionKeys: {
                x: ['xKey'],
                y: ['lowKey', 'highKey', 'openKey', 'closeKey'],
            },
            directionNames: {
                x: ['xName'],
                y: ['lowName', 'highName', 'openName', 'closeName'],
            },
            pathsPerSeries: [],
            datumSelectionGarbageCollection: false,
            animationAlwaysUpdateSelections: true,
            animationResetFns: {
                datum: datumAnimationResetFnc,
            },
        });
    }

    protected override animateEmptyUpdateReady({
        datumSelection,
    }: _ModuleSupport.CartesianAnimationData<TItemShapeGroup, TNodeDatum>) {
        const animationFns = prepareCandlestickAnimationFunctions(true);
        motion.fromToMotion(this.id, 'datums', this.ctx.animationManager, [datumSelection], animationFns);
    }

    protected override animateWaitingUpdateReady({
        datumSelection,
    }: _ModuleSupport.CartesianAnimationData<TItemShapeGroup, TNodeDatum>) {
        const { processedData } = this;
        const difference = processedData?.reduced?.diff;

        const animationFns = prepareCandlestickAnimationFunctions(false);
        motion.fromToMotion(
            this.id,
            'datums',
            this.ctx.animationManager,
            [datumSelection],
            animationFns,
            (_, datum) => String(datum.xValue),
            difference
        );
    }

    override async processData(dataController: _ModuleSupport.DataController): Promise<void> {
        if (!this.properties.isValid() || !this.visible) return;

        const { xKey, openKey, closeKey, highKey, lowKey } = this.properties;
        const animationEnabled = !this.ctx.animationManager.isSkipped();

        const xScale = this.getCategoryAxis()?.scale;
        const yScale = this.getValueAxis()?.scale;
        const { isContinuousX, xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });

        const extraProps = [];
        if (animationEnabled) {
            if (this.processedData) {
                extraProps.push(diff(this.id, this.processedData));
            }
            extraProps.push(animationValidation());
        }
        if (openKey) {
            extraProps.push(
                valueProperty(openKey, yScaleType, {
                    id: `openValue`,
                    invalidValue: undefined,
                    missingValue: undefined,
                })
            );
        }

        const { dataModel, processedData } = await this.requestDataModel<any>(dataController, this.data, {
            props: [
                keyProperty(xKey, xScaleType, { id: `xValue` }),
                valueProperty(closeKey, yScaleType, { id: `closeValue` }),
                valueProperty(highKey, yScaleType, { id: `highValue` }),
                valueProperty(lowKey, yScaleType, { id: `lowValue` }),
                ...(isContinuousX ? [SMALLEST_KEY_INTERVAL] : []),
                ...extraProps,
            ],
        });

        this.smallestDataInterval = processedData.reduced?.smallestKeyInterval;

        this.dataAggregationFilters = this.aggregateData(
            dataModel,
            processedData as any as _ModuleSupport.UngroupedData<any>
        );

        this.animationState.transition('updateData');
    }

    private aggregateData(
        dataModel: _ModuleSupport.DataModel<any, any, any>,
        processedData: _ModuleSupport.UngroupedData<any>
    ) {
        if (processedData.rawData.length === 0) return;

        const xAxis = this.axes[ChartAxisDirection.X];
        // if (xAxis == null || !ContinuousScale.is(xAxis.scale)) return;
        if (xAxis == null) return;

        const xValues = dataModel.resolveKeysById(this, `xValue`, processedData);
        const highValues = dataModel.resolveColumnById(this, `highValue`, processedData);
        const lowValues = dataModel.resolveColumnById(this, `lowValue`, processedData);

        const { index } = dataModel.resolveProcessedDataDefById(this, `xValue`);
        const domain = processedData.domain.keys[index];

        return aggregateData(xValues, highValues, lowValues, domain);
    }

    override getSeriesDomain(direction: _ModuleSupport.ChartAxisDirection) {
        const { processedData, dataModel } = this;
        if (!(processedData && dataModel)) return [];

        const { openKey } = this.properties;

        if (direction === this.getBarDirection()) {
            const lowValues = dataModel.getDomain(this, `lowValue`, 'value', processedData);
            const highValues = dataModel.getDomain(this, `highValue`, 'value', processedData);
            const openValues = openKey ? dataModel.getDomain(this, `openValue`, 'value', processedData) : [];
            const closeValues = dataModel.getDomain(this, `closeValue`, 'value', processedData);

            return fixNumericExtent([
                Math.min(...lowValues, ...highValues, ...openValues, ...closeValues),
                Math.max(...highValues, ...lowValues, ...openValues, ...closeValues),
            ]);
        }

        const { index, def } = dataModel.resolveProcessedDataDefById(this, `xValue`);
        const keys = processedData.domain.keys[index];
        if (def.type === 'key' && def.valueType === 'category') {
            return keys;
        }
        return this.padBandExtent(keys);
    }

    createBaseNodeData() {
        const { visible, dataModel, processedData } = this;

        const xAxis = this.getCategoryAxis();
        const yAxis = this.getValueAxis();

        if (!(dataModel && processedData != null && processedData.rawData.length !== 0 && xAxis && yAxis)) {
            return;
        }

        const nodeData: CandlestickNodeBaseDatum[] = [];
        const { xKey, highKey, lowKey } = this.properties;
        const { rawData } = processedData;
        const xValues = dataModel.resolveKeysById(this, 'xValue', processedData);
        const openValues = dataModel.resolveColumnById(this, 'openValue', processedData);
        const closeValues = dataModel.resolveColumnById(this, 'closeValue', processedData);
        const highValues = dataModel.resolveColumnById(this, 'highValue', processedData);
        const lowValues = dataModel.resolveColumnById(this, 'lowValue', processedData);

        const { barWidth, groupIndex } = this.updateGroupScale(xAxis);
        const barOffset = ContinuousScale.is(xAxis.scale) ? barWidth * -0.5 : 0;
        const { groupScale } = this;

        const context = {
            itemId: xKey,
            nodeData,
            labelData: [],
            scales: this.calculateScaling(),
            visible: this.visible,
        };
        if (!visible) return context;

        const handleDatum = (
            datum: any,
            xValue: any,
            openValue: any,
            closeValue: any,
            highValue: any,
            lowValue: any,
            thickness: number | undefined
        ) => {
            const scaledValues = {
                xValue: Math.round(xAxis.scale.convert(xValue)),
                openValue: Math.round(yAxis.scale.convert(openValue)),
                closeValue: Math.round(yAxis.scale.convert(closeValue)),
                highValue: Math.round(yAxis.scale.convert(highValue)),
                lowValue: Math.round(yAxis.scale.convert(lowValue)),
            };

            scaledValues.xValue += Math.round(groupScale.convert(String(groupIndex))) + barOffset;

            const isRising = closeValue > openValue;
            const itemId = this.getSeriesItemType(isRising);

            const [y, yBottom] = isRising
                ? [scaledValues.openValue, scaledValues.closeValue]
                : [scaledValues.closeValue, scaledValues.openValue];
            const height = yBottom - y;

            const midPoint = {
                x: scaledValues.xValue + Math.round(barWidth) / 2,
                y: y + height / 2,
            };

            nodeData.push({
                series: this,
                itemId,
                datum,
                xKey,
                xValue,
                openValue,
                closeValue,
                highValue,
                lowValue,
                // CRT-340 Use atleast 1px width to prevent nothing being drawn.
                bandwidth: thickness ?? (barWidth >= 1 ? barWidth : groupScale.rawBandwidth),
                scaledValues,
                midPoint,
                aggregatedValue: closeValue,
            });
        };

        const { dataAggregationFilters } = this;
        const xScale = xAxis.scale;
        const [x0, x1] = findMinMax(xAxis.range);
        const xFor = (index: number) => {
            const xDatum = xValues[index];
            return xScale.convert(xDatum) + barOffset;
        };

        const [r0, r1] = xScale.range;
        const range = r1 - r0;

        const dataAggregationFilter = dataAggregationFilters?.find((f) => f.maxRange > range);

        if (dataAggregationFilter != null) {
            const { maxRange, indexData } = dataAggregationFilter;
            const [start, end] = visibleRange(maxRange, x0, x1, (index) => {
                const aggIndex = index * SPAN;
                const openIndex = indexData[aggIndex + OPEN];
                const closeIndex = indexData[aggIndex + CLOSE];
                const midDatumIndex = ((openIndex + closeIndex) / 2) | 0;
                return openIndex !== -1 ? xFor(midDatumIndex) : NaN;
            });

            for (let i = start; i < end; i += 1) {
                const aggIndex = i * SPAN;
                const openIndex = indexData[aggIndex + OPEN];
                const closeIndex = indexData[aggIndex + CLOSE];
                const highIndex = indexData[aggIndex + HIGH];
                const lowIndex = indexData[aggIndex + LOW];

                if (openIndex === -1) continue;

                const midDatumIndex = ((openIndex + closeIndex) / 2) | 0;

                const xValue = xValues[midDatumIndex];
                if (xValue == null) continue;

                const datum = rawData[midDatumIndex];
                const openValue = openValues[openIndex];
                const closeValue = closeValues[closeIndex];
                const highValue = highValues[highIndex];
                const lowValue = lowValues[lowIndex];

                const thickness = Math.abs(xScale.convert(xValues[closeIndex]) - xScale.convert(xValues[openIndex]));

                handleDatum(datum, xValue, openValue, closeValue, highValue, lowValue, thickness);
            }
        } else {
            const [start, end] = visibleRange(rawData.length, x0, x1, xFor);

            for (let i = start; i < end; i += 1) {
                const xValue = xValues[i];
                if (xValue == null) continue;

                const datum = rawData[i];
                const openValue = openValues[i];
                const closeValue = closeValues[i];
                const highValue = highValues[i];
                const lowValue = lowValues[i];

                // compare unscaled values
                const validLowValue = lowValue != null && lowValue <= openValue && lowValue <= closeValue;
                const validHighValue = highValue != null && highValue >= openValue && highValue >= closeValue;

                if (!validLowValue) {
                    Logger.warnOnce(
                        `invalid low value for key [${lowKey}] in data element, low value cannot be higher than datum open or close values`
                    );
                    return;
                }

                if (!validHighValue) {
                    Logger.warnOnce(
                        `invalid high value for key [${highKey}] in data element, high value cannot be lower than datum open or close values.`
                    );
                    return;
                }

                handleDatum(datum, xValue, openValue, closeValue, highValue, lowValue, undefined);
            }
        }

        return context;
    }

    private getSeriesItemType(isRising: boolean): AgOhlcSeriesItemType {
        return isRising ? 'up' : 'down';
    }

    protected getItemConfig(seriesItemType: AgOhlcSeriesItemType) {
        return this.properties.item[seriesItemType];
    }

    getLegendData(legendType: _ModuleSupport.ChartLegendType): _ModuleSupport.CategoryLegendDatum[] {
        const { id, data } = this;
        const {
            xKey,
            yName,
            item: { up, down },
            showInLegend,
            legendItemName,
            visible,
        } = this.properties;

        if (!showInLegend || !data?.length || !xKey || legendType !== 'category') {
            return [];
        }

        return [
            {
                legendType: 'category',
                id,
                itemId: id,
                seriesId: id,
                enabled: visible,
                label: {
                    text: legendItemName ?? yName ?? id,
                },
                symbols: [
                    {
                        marker: {
                            fill: up.fill ?? up.stroke,
                            fillOpacity: up.fillOpacity ?? 1,
                            stroke: up.stroke,
                            strokeWidth: up.strokeWidth ?? 1,
                            strokeOpacity: up.strokeOpacity ?? 1,
                            padding: 0,
                        },
                    },
                    {
                        marker: {
                            fill: down.fill ?? down.stroke,
                            fillOpacity: down.fillOpacity ?? 1,
                            stroke: down.stroke,
                            strokeWidth: down.strokeWidth ?? 1,
                            strokeOpacity: down.strokeOpacity ?? 1,
                        },
                    },
                ],
                legendItemName,
            },
        ];
    }

    getTooltipHtml(nodeDatum: TNodeDatum): _ModuleSupport.TooltipContent {
        const {
            xKey,
            openKey,
            closeKey,
            highKey,
            lowKey,
            xName,
            yName,
            openName,
            closeName,
            highName,
            lowName,
            tooltip,
        } = this.properties;
        const { datum, itemId } = nodeDatum;

        const xAxis = this.getCategoryAxis();
        const yAxis = this.getValueAxis();

        if (!xAxis || !yAxis || !this.properties.isValid()) return _ModuleSupport.EMPTY_TOOLTIP_CONTENT;

        const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.substring(1);

        const title = sanitizeHtml(yName);
        const contentData: [string, string | undefined, _ModuleSupport.ChartAxis][] = [
            [xKey, xName, xAxis],
            [openKey, openName, yAxis],
            [highKey, highName, yAxis],
            [lowKey, lowName, yAxis],
            [closeKey, closeName, yAxis],
        ];

        const content = contentData
            .map(([key, name, axis]) => sanitizeHtml(`${name ?? capitalise(key)}: ${axis.formatDatum(datum[key])}`))
            .join('<br/>');

        const styles = this.getFormattedStyles(nodeDatum);

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: styles.stroke },
            {
                seriesId: this.id,
                highlighted: false,
                datum,
                ...styles,
                xKey,
                openKey,
                closeKey,
                highKey,
                lowKey,
                xName,
                yName,
                openName,
                closeName,
                highName,
                lowName,
                title,
                color: styles.fill,
                fill: styles.fill,
                itemId,
            }
        );
    }

    protected override isVertical(): boolean {
        return true;
    }

    protected isLabelEnabled(): boolean {
        return false;
    }

    protected override async updateDatumSelection(opts: {
        nodeData: TNodeDatum[];
        datumSelection: _ModuleSupport.Selection<TItemShapeGroup, TNodeDatum>;
        seriesIdx: number;
    }) {
        const data = opts.nodeData ?? [];
        return opts.datumSelection.update(data);
    }

    protected override async updateDatumNodes({
        datumSelection,
        isHighlight: highlighted,
    }: {
        datumSelection: _ModuleSupport.Selection<TItemShapeGroup, TNodeDatum>;
        isHighlight: boolean;
    }) {
        datumSelection.each((group, nodeDatum) => {
            const activeStyles = this.getActiveStyles(nodeDatum, highlighted);

            group.updateDatumStyles(nodeDatum, activeStyles);
        });
    }

    protected async updateLabelNodes(_opts: {
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, TNodeDatum>;
        seriesIdx: number;
    }) {
        // Labels unsupported
    }

    protected async updateLabelSelection(opts: {
        labelData: TNodeDatum[];
        labelSelection: _ModuleSupport.Selection<_ModuleSupport.Text, TNodeDatum>;
        seriesIdx: number;
    }) {
        const { labelData, labelSelection } = opts;
        return labelSelection.update(labelData);
    }

    abstract getFormattedStyles(nodeDatum: TNodeDatum, highlighted?: boolean): TItemOptions;
    protected abstract getSeriesStyles(nodeDatum: TNodeDatum): TItemOptions;
    protected abstract getActiveStyles(nodeDatum: TNodeDatum, highlighted: boolean): TItemOptions;
}
