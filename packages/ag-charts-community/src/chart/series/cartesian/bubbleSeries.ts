import type { AgSeriesMarkerStyle } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import { ColorScale } from '../../../scale/colorScale';
import { LinearScale } from '../../../scale/linearScale';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import type { Selection } from '../../../scene/selection';
import { Text } from '../../../scene/shape/text';
import type { PointLabelDatum } from '../../../scene/util/labelPlacement';
import { extent } from '../../../util/array';
import { mergeDefaults } from '../../../util/object';
import { sanitizeHtml } from '../../../util/sanitize';
import { CachedTextMeasurerPool } from '../../../util/textMeasurer';
import { ChartAxisDirection } from '../../chartAxisDirection';
import type { DataController } from '../../data/dataController';
import { fixNumericExtent } from '../../data/dataModel';
import { createDatumId, valueProperty } from '../../data/processors';
import type { CategoryLegendDatum } from '../../legend/legendDatum';
import type { Marker } from '../../marker/marker';
import { getMarker } from '../../marker/util';
import { EMPTY_TOOLTIP_CONTENT, type TooltipContent } from '../../tooltip/tooltip';
import type { PickFocusInputs, SeriesNodeEventTypes } from '../series';
import { SeriesNodePickMode } from '../series';
import { resetLabelFn, seriesLabelFadeInAnimation } from '../seriesLabelUtil';
import { type BubbleNodeDatum, BubbleSeriesProperties } from './bubbleSeriesProperties';
import type { CartesianAnimationData } from './cartesianSeries';
import {
    CartesianSeries,
    CartesianSeriesNodeEvent,
    DEFAULT_CARTESIAN_DIRECTION_KEYS,
    DEFAULT_CARTESIAN_DIRECTION_NAMES,
} from './cartesianSeries';
import { computeMarkerFocusBounds, markerScaleInAnimation, resetMarkerFn } from './markerUtil';

type BubbleAnimationData = CartesianAnimationData<Group, BubbleNodeDatum>;

class BubbleSeriesNodeEvent<TEvent extends string = SeriesNodeEventTypes> extends CartesianSeriesNodeEvent<TEvent> {
    readonly sizeKey?: string;

    constructor(type: TEvent, nativeEvent: Event, datum: BubbleNodeDatum, series: BubbleSeries) {
        super(type, nativeEvent, datum, series);
        this.sizeKey = series.properties.sizeKey;
    }
}

export class BubbleSeries extends CartesianSeries<Group, BubbleSeriesProperties, BubbleNodeDatum> {
    static readonly className = 'BubbleSeries';
    static readonly type = 'bubble' as const;

    protected override readonly NodeEvent = BubbleSeriesNodeEvent;

    override properties = new BubbleSeriesProperties();

    private readonly sizeScale = new LinearScale();

    private readonly colorScale = new ColorScale();

    override get pickModeAxis() {
        return 'main-category' as const;
    }

    constructor(moduleCtx: ModuleContext) {
        super({
            moduleCtx,
            directionKeys: DEFAULT_CARTESIAN_DIRECTION_KEYS,
            directionNames: DEFAULT_CARTESIAN_DIRECTION_NAMES,
            pickModes: [
                SeriesNodePickMode.AXIS_ALIGNED,
                SeriesNodePickMode.NEAREST_NODE,
                SeriesNodePickMode.EXACT_SHAPE_MATCH,
            ],
            pathsPerSeries: [],
            hasMarkers: true,
            markerSelectionGarbageCollection: false,
            animationResetFns: {
                label: resetLabelFn,
                marker: resetMarkerFn,
            },
        });
    }

    override async processData(dataController: DataController) {
        if (!this.properties.isValid() || this.data == null || !this.visible) return;

        const xScale = this.axes[ChartAxisDirection.X]?.scale;
        const yScale = this.axes[ChartAxisDirection.Y]?.scale;
        const { xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });
        const colorScaleType = this.colorScale.type;
        const sizeScaleType = this.sizeScale.type;
        const {
            xKey,
            yKey,
            sizeKey,
            xFilterKey,
            yFilterKey,
            sizeFilterKey,
            labelKey,
            colorDomain,
            colorRange,
            colorKey,
            marker,
        } = this.properties;
        const { dataModel, processedData } = await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                valueProperty(xKey, xScaleType, { id: `xValue` }),
                valueProperty(yKey, yScaleType, { id: `yValue` }),
                ...(xFilterKey != null ? [valueProperty(xFilterKey, xScaleType, { id: `xFilterValue` })] : []),
                ...(yFilterKey != null ? [valueProperty(yFilterKey, yScaleType, { id: `yFilterValue` })] : []),
                ...(sizeFilterKey != null
                    ? [valueProperty(sizeFilterKey, sizeScaleType, { id: `sizeFilterValue` })]
                    : []),
                valueProperty(sizeKey, sizeScaleType, { id: `sizeValue` }),
                ...(colorKey ? [valueProperty(colorKey, colorScaleType, { id: `colorValue` })] : []),
                ...(labelKey ? [valueProperty(labelKey, 'band', { id: `labelValue` })] : []),
            ],
        });

        const sizeKeyIdx = dataModel.resolveProcessedDataIndexById(this, `sizeValue`);
        const processedSize = processedData.domain.values[sizeKeyIdx] ?? [];
        this.sizeScale.domain = marker.domain ? marker.domain : processedSize;

        if (colorKey) {
            const colorKeyIdx = dataModel.resolveProcessedDataIndexById(this, `colorValue`);
            this.colorScale.domain = colorDomain ?? processedData.domain.values[colorKeyIdx] ?? [];
            this.colorScale.range = colorRange;
            this.colorScale.update();
        }

        this.animationState.transition('updateData');
    }

    override getSeriesDomain(direction: ChartAxisDirection): any[] {
        const { dataModel, processedData } = this;
        if (!processedData || !dataModel) return [];

        const id = direction === ChartAxisDirection.X ? `xValue` : `yValue`;
        const dataDef = dataModel.resolveProcessedDataDefById(this, id);
        const domain = dataModel.getDomain(this, id, 'value', processedData);
        if (dataDef?.def.type === 'value' && dataDef?.def.valueType === 'category') {
            return domain;
        }
        return fixNumericExtent(extent(domain));
    }

    override createNodeData() {
        const { axes, dataModel, processedData, colorScale, sizeScale } = this;
        const {
            xKey,
            yKey,
            sizeKey,
            xFilterKey,
            yFilterKey,
            sizeFilterKey,
            labelKey,
            xName,
            yName,
            sizeName,
            labelName,
            label,
            colorKey,
            marker,
            visible,
        } = this.properties;
        const markerShape = getMarker(marker.shape);
        const { placement } = label;

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (!(dataModel && processedData?.rawData.length && visible && xAxis && yAxis)) {
            return;
        }

        const xDataValues = dataModel.resolveColumnById(this, `xValue`, processedData);
        const yDataValues = dataModel.resolveColumnById(this, `yValue`, processedData);
        const sizeDataValues =
            sizeKey != null ? dataModel.resolveColumnById<number>(this, `sizeValue`, processedData) : undefined;
        const colorDataValues =
            colorKey != null ? dataModel.resolveColumnById<number>(this, `colorValue`, processedData) : undefined;
        const labelDataValues =
            labelKey != null ? dataModel.resolveColumnById(this, `labelValue`, processedData) : undefined;
        const xFilterDataValues =
            xFilterKey != null ? dataModel.resolveColumnById(this, `xFilterValue`, processedData) : undefined;
        const yFilterDataValues =
            yFilterKey != null ? dataModel.resolveColumnById(this, `yFilterValue`, processedData) : undefined;
        const sizeFilterDataValues =
            sizeFilterKey != null
                ? dataModel.resolveColumnById<number>(this, `sizeFilterValue`, processedData)
                : undefined;

        const xScale = xAxis.scale;
        const yScale = yAxis.scale;
        const xOffset = (xScale.bandwidth ?? 0) / 2;
        const yOffset = (yScale.bandwidth ?? 0) / 2;
        const nodeData: BubbleNodeDatum[] = [];

        sizeScale.range = [marker.size, marker.maxSize];

        const font = label.getFont();
        const textMeasurer = CachedTextMeasurerPool.getMeasurer({ font });
        processedData.rawData.forEach((datum, datumIndex) => {
            const xDatum = xDataValues[datumIndex];
            const yDatum = yDataValues[datumIndex];
            const sizeValue = sizeDataValues?.[datumIndex];
            const x = xScale.convert(xDatum) + xOffset;
            const y = yScale.convert(yDatum) + yOffset;

            let selected: boolean | undefined;
            if (xFilterDataValues != null && yFilterDataValues != null) {
                selected = xFilterDataValues[datumIndex] === xDatum && yFilterDataValues[datumIndex] === yDatum;

                if (sizeFilterDataValues != null) {
                    selected &&= sizeFilterDataValues[datumIndex] === sizeValue;
                }
            }

            const labelText = this.getLabelText(label, {
                value: labelDataValues != null ? labelDataValues[datumIndex] : yDatum,
                datum,
                xKey,
                yKey,
                sizeKey,
                labelKey,
                xName,
                yName,
                sizeName,
                labelName,
            });

            const size = textMeasurer.measureText(String(labelText));
            const markerSize = sizeValue != null ? sizeScale.convert(sizeValue) : marker.size;
            const fill = colorDataValues != null ? colorScale.convert(colorDataValues[datumIndex]) : undefined;

            nodeData.push({
                series: this,
                itemId: yKey,
                yKey,
                xKey,
                datum,
                xValue: xDatum,
                yValue: yDatum,
                sizeValue,
                point: { x, y, size: markerSize },
                midPoint: { x, y },
                fill,
                label: { text: labelText, ...size },
                marker: markerShape,
                placement,
                selected,
            });
        });

        return {
            itemId: yKey,
            nodeData,
            labelData: nodeData,
            scales: this.calculateScaling(),
            visible: this.visible,
        };
    }

    protected override isPathOrSelectionDirty(): boolean {
        return this.properties.marker.isDirty();
    }

    override getLabelData(): PointLabelDatum[] {
        return this.contextNodeData?.labelData ?? [];
    }

    protected override markerFactory() {
        const { shape } = this.properties.marker;
        const MarkerShape = getMarker(shape);
        return new MarkerShape();
    }

    protected override updateMarkerSelection(opts: {
        nodeData: BubbleNodeDatum[];
        markerSelection: Selection<Marker, BubbleNodeDatum>;
    }) {
        const { nodeData, markerSelection } = opts;

        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }

        const data = this.properties.marker.enabled ? nodeData : [];
        return markerSelection.update(data, undefined, (datum) =>
            createDatumId([datum.xValue, datum.yValue, datum.label.text])
        );
    }

    protected override updateMarkerNodes(opts: {
        markerSelection: Selection<Marker, BubbleNodeDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight: highlighted } = opts;
        const { xKey, yKey, sizeKey, labelKey, marker } = this.properties;
        const { size, shape, fill, fillOpacity, stroke, strokeWidth, strokeOpacity } = mergeDefaults(
            highlighted && this.properties.highlightStyle.item,
            marker.getStyle()
        );
        const baseStyle = { size, shape, fill, fillOpacity, stroke, strokeWidth, strokeOpacity };

        this.sizeScale.range = [marker.size, marker.maxSize];

        markerSelection.each((node, datum) => {
            this.updateMarkerStyle(node, marker, { datum, highlighted, xKey, yKey, sizeKey, labelKey }, baseStyle, {
                selected: datum.selected,
            });
        });

        if (!highlighted) {
            this.properties.marker.markClean();
        }
    }

    protected updateLabelSelection(opts: {
        labelData: BubbleNodeDatum[];
        labelSelection: Selection<Text, BubbleNodeDatum>;
    }) {
        const placedLabels = this.properties.label.enabled ? this.chart?.placeLabels().get(this) ?? [] : [];
        return opts.labelSelection.update(
            placedLabels.map((v) => ({
                ...(v.datum as BubbleNodeDatum),
                point: {
                    x: v.x,
                    y: v.y,
                    size: v.datum.point.size,
                },
            }))
        );
    }

    protected updateLabelNodes(opts: { labelSelection: Selection<Text, BubbleNodeDatum> }) {
        const { label } = this.properties;

        opts.labelSelection.each((text, datum) => {
            text.text = datum.label.text;
            text.fill = label.color;
            text.x = datum.point?.x ?? 0;
            text.y = datum.point?.y ?? 0;
            text.fontStyle = label.fontStyle;
            text.fontWeight = label.fontWeight;
            text.fontSize = label.fontSize;
            text.fontFamily = label.fontFamily;
            text.textAlign = 'left';
            text.textBaseline = 'top';
        });
    }

    getTooltipHtml(nodeDatum: BubbleNodeDatum): TooltipContent {
        const xAxis = this.axes[ChartAxisDirection.X];
        const yAxis = this.axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !xAxis || !yAxis) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const { xKey, yKey, sizeKey, labelKey, xName, yName, sizeName, labelName, marker, tooltip } = this.properties;
        const title = this.properties.title ?? yName;

        const baseStyle = mergeDefaults(
            { fill: nodeDatum.fill, strokeWidth: this.getStrokeWidth(marker.strokeWidth) },
            marker.getStyle()
        );

        const { fill: color = 'gray' } = this.getMarkerStyle(
            marker,
            { datum: nodeDatum, highlighted: false, xKey, yKey, sizeKey, labelKey },
            baseStyle
        );

        const {
            datum,
            xValue,
            yValue,
            sizeValue,
            label: { text: labelText },
            itemId,
        } = nodeDatum;
        const xString = sanitizeHtml(xAxis.formatDatum(xValue));
        const yString = sanitizeHtml(yAxis.formatDatum(yValue));

        let content =
            `<b>${sanitizeHtml(xName ?? xKey)}</b>: ${xString}<br>` +
            `<b>${sanitizeHtml(yName ?? yKey)}</b>: ${yString}`;

        if (sizeKey) {
            content += `<br><b>${sanitizeHtml(sizeName ?? sizeKey)}</b>: ${sanitizeHtml(String(sizeValue))}`;
        }

        if (labelKey) {
            content = `<b>${sanitizeHtml(labelName ?? labelKey)}</b>: ${sanitizeHtml(labelText)}<br>` + content;
        }

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                datum,
                itemId,
                xKey,
                xName,
                yKey,
                yName,
                sizeKey,
                sizeName,
                labelKey,
                labelName,
                title,
                color,
                seriesId: this.id,
            }
        );
    }

    getLegendData(): CategoryLegendDatum[] {
        if (!this.properties.isValid()) {
            return [];
        }

        const {
            id: seriesId,
            ctx: { legendManager },
            visible,
        } = this;

        const { yKey: itemId, yName, title, marker } = this.properties;
        const { shape, fill, stroke, fillOpacity, strokeOpacity, strokeWidth } = marker;

        return [
            {
                legendType: 'category',
                id: seriesId,
                itemId,
                seriesId,
                enabled: visible && legendManager.getItemEnabled({ seriesId, itemId }),
                label: {
                    text: title ?? yName ?? itemId,
                },
                symbols: [
                    {
                        marker: {
                            shape,
                            fill: fill ?? 'rgba(0, 0, 0, 0)',
                            stroke: stroke ?? 'rgba(0, 0, 0, 0)',
                            fillOpacity: fillOpacity ?? 1,
                            strokeOpacity: strokeOpacity ?? 1,
                            strokeWidth: strokeWidth ?? 0,
                        },
                    },
                ],
            },
        ];
    }

    override animateEmptyUpdateReady({ markerSelection, labelSelection }: BubbleAnimationData) {
        markerScaleInAnimation(this, this.ctx.animationManager, markerSelection);
        seriesLabelFadeInAnimation(this, 'labels', this.ctx.animationManager, labelSelection);
    }

    protected isLabelEnabled() {
        return this.properties.label.enabled;
    }

    protected nodeFactory() {
        return new Group();
    }

    public getFormattedMarkerStyle(datum: BubbleNodeDatum): AgSeriesMarkerStyle & { size: number } {
        const { xKey, yKey, sizeKey, labelKey } = this.properties;
        return this.getMarkerStyle(this.properties.marker, {
            datum,
            xKey,
            yKey,
            sizeKey,
            labelKey,
            highlighted: false,
        });
    }

    protected computeFocusBounds(opts: PickFocusInputs): BBox | undefined {
        return computeMarkerFocusBounds(this, opts);
    }
}
