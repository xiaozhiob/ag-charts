import type { AgErrorBoundSeriesTooltipRendererParams } from 'ag-charts-types';

import type { ModuleContext } from '../../../module/moduleContext';
import { ColorScale } from '../../../scale/colorScale';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import { PointerEvents } from '../../../scene/node';
import type { Selection } from '../../../scene/selection';
import { Text } from '../../../scene/shape/text';
import type { PointLabelDatum } from '../../../scene/util/labelPlacement';
import { extent } from '../../../util/array';
import { mergeDefaults } from '../../../util/object';
import { sanitizeHtml } from '../../../util/sanitize';
import { CachedTextMeasurerPool } from '../../../util/textMeasurer';
import type { RequireOptional } from '../../../util/types';
import { ChartAxisDirection } from '../../chartAxisDirection';
import type { DataController } from '../../data/dataController';
import { fixNumericExtent } from '../../data/dataModel';
import { valueProperty } from '../../data/processors';
import type { CategoryLegendDatum, ChartLegendType } from '../../legend/legendDatum';
import type { Marker } from '../../marker/marker';
import { getMarker } from '../../marker/util';
import { EMPTY_TOOLTIP_CONTENT, type TooltipContent } from '../../tooltip/tooltip';
import { type PickFocusInputs, SeriesNodePickMode } from '../series';
import { resetLabelFn, seriesLabelFadeInAnimation } from '../seriesLabelUtil';
import type { CartesianAnimationData } from './cartesianSeries';
import {
    CartesianSeries,
    DEFAULT_CARTESIAN_DIRECTION_KEYS,
    DEFAULT_CARTESIAN_DIRECTION_NAMES,
} from './cartesianSeries';
import { computeMarkerFocusBounds, markerScaleInAnimation, resetMarkerFn } from './markerUtil';
import { type ScatterNodeDatum, ScatterSeriesProperties } from './scatterSeriesProperties';

type ScatterAnimationData = CartesianAnimationData<Group, ScatterNodeDatum>;

export class ScatterSeries extends CartesianSeries<Group, ScatterSeriesProperties, ScatterNodeDatum> {
    static readonly className = 'ScatterSeries';
    static readonly type = 'scatter' as const;

    override properties = new ScatterSeriesProperties();

    readonly colorScale = new ColorScale();

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
                marker: resetMarkerFn,
                label: resetLabelFn,
            },
        });
    }

    override async processData(dataController: DataController) {
        if (!this.properties.isValid() || this.data == null || !this.visible) return;

        const xScale = this.axes[ChartAxisDirection.X]?.scale;
        const yScale = this.axes[ChartAxisDirection.Y]?.scale;
        const { xScaleType, yScaleType } = this.getScaleInformation({ xScale, yScale });
        const colorScaleType = this.colorScale.type;
        const { xKey, yKey, xFilterKey, yFilterKey, labelKey, colorKey, colorDomain, colorRange } = this.properties;

        const { dataModel, processedData } = await this.requestDataModel<any, any, true>(dataController, this.data, {
            props: [
                valueProperty(xKey, xScaleType, { id: `xValue` }),
                valueProperty(yKey, yScaleType, { id: `yValue` }),
                ...(xFilterKey != null ? [valueProperty(xFilterKey, xScaleType, { id: 'xFilterValue' })] : []),
                ...(yFilterKey != null ? [valueProperty(yFilterKey, yScaleType, { id: 'yFilterValue' })] : []),
                ...(colorKey ? [valueProperty(colorKey, colorScaleType, { id: `colorValue` })] : []),
                ...(labelKey ? [valueProperty(labelKey, 'band', { id: `labelValue` })] : []),
            ],
        });

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
        const { axes, dataModel, processedData, colorScale } = this;
        const {
            xKey,
            yKey,
            xFilterKey,
            yFilterKey,
            labelKey,
            colorKey,
            xName,
            yName,
            labelName,
            marker,
            label,
            visible,
        } = this.properties;
        const { placement } = label;
        const markerShape = getMarker(marker.shape);

        const xAxis = axes[ChartAxisDirection.X];
        const yAxis = axes[ChartAxisDirection.Y];

        if (!(dataModel && processedData?.rawData.length && visible && xAxis && yAxis)) {
            return;
        }

        const xDataValues = dataModel.resolveColumnById(this, `xValue`, processedData);
        const yDataValues = dataModel.resolveColumnById(this, `yValue`, processedData);
        const colorDataValues =
            colorKey != null ? dataModel.resolveColumnById<number>(this, `colorValue`, processedData) : undefined;
        const labelDataValues =
            labelKey != null ? dataModel.resolveColumnById<string>(this, `labelValue`, processedData) : undefined;
        const xFilterDataValues =
            xFilterKey != null ? dataModel.resolveColumnById(this, `xFilterValue`, processedData) : undefined;
        const yFilterDataValues =
            yFilterKey != null ? dataModel.resolveColumnById(this, `yFilterValue`, processedData) : undefined;

        const xScale = xAxis.scale;
        const yScale = yAxis.scale;
        const xOffset = (xScale.bandwidth ?? 0) / 2;
        const yOffset = (yScale.bandwidth ?? 0) / 2;
        const nodeData: ScatterNodeDatum[] = [];

        const font = label.getFont();
        const textMeasurer = CachedTextMeasurerPool.getMeasurer({ font });
        processedData.rawData.forEach((datum, datumIndex) => {
            const xDatum = xDataValues[datumIndex];
            const yDatum = yDataValues[datumIndex];
            const x = xScale.convert(xDatum) + xOffset;
            const y = yScale.convert(yDatum) + yOffset;
            const selected =
                xFilterDataValues != null && yFilterDataValues != null
                    ? xFilterDataValues[datumIndex] === xDatum && yFilterDataValues[datumIndex] === yDatum
                    : undefined;

            const labelText = this.getLabelText(label, {
                value: labelDataValues != null ? labelDataValues?.[datumIndex] : yDatum,
                datum,
                xKey,
                yKey,
                labelKey,
                xName,
                yName,
                labelName,
            });

            const size = textMeasurer.measureText(labelText);
            const fill = colorDataValues != null ? colorScale.convert(colorDataValues[datumIndex]) : undefined;

            nodeData.push({
                series: this,
                itemId: yKey,
                yKey,
                xKey,
                datum,
                xValue: xDatum,
                yValue: yDatum,
                capDefaults: { lengthRatioMultiplier: marker.getDiameter(), lengthMax: Infinity },
                point: { x, y, size: marker.size },
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
        nodeData: ScatterNodeDatum[];
        markerSelection: Selection<Marker, ScatterNodeDatum>;
    }) {
        const { nodeData, markerSelection } = opts;

        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }

        return markerSelection.update(this.properties.marker.enabled ? nodeData : []);
    }

    protected override updateMarkerNodes(opts: {
        markerSelection: Selection<Marker, ScatterNodeDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight: highlighted } = opts;
        const { xKey, yKey, labelKey, marker, highlightStyle } = this.properties;
        const baseStyle = mergeDefaults(highlighted && highlightStyle.item, marker.getStyle());

        markerSelection.each((node, datum) => {
            this.updateMarkerStyle(node, marker, { datum, highlighted, xKey, yKey, labelKey }, baseStyle, {
                selected: datum.selected,
            });
        });

        if (!highlighted) {
            marker.markClean();
        }
    }

    protected updateLabelSelection(opts: {
        labelData: ScatterNodeDatum[];
        labelSelection: Selection<Text, ScatterNodeDatum>;
    }) {
        const placedLabels = this.isLabelEnabled() ? this.chart?.placeLabels().get(this) ?? [] : [];
        return opts.labelSelection.update(
            placedLabels.map(({ datum, x, y }) => ({
                ...(datum as ScatterNodeDatum),
                point: { x, y, size: datum.point.size },
                placement: 'top',
            })),
            (text) => {
                text.pointerEvents = PointerEvents.None;
            }
        );
    }

    protected updateLabelNodes(opts: { labelSelection: Selection<Text, ScatterNodeDatum> }) {
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

    getTooltipHtml(nodeDatum: ScatterNodeDatum): TooltipContent {
        const xAxis = this.axes[ChartAxisDirection.X];
        const yAxis = this.axes[ChartAxisDirection.Y];

        if (!this.properties.isValid() || !xAxis || !yAxis) {
            return EMPTY_TOOLTIP_CONTENT;
        }

        const { xKey, yKey, labelKey, xName, yName, labelName, title = yName, marker, tooltip } = this.properties;
        const { datum, xValue, yValue, label, itemId } = nodeDatum;

        const baseStyle = mergeDefaults(
            { fill: nodeDatum.fill, strokeWidth: this.getStrokeWidth(marker.strokeWidth) },
            marker.getStyle()
        );

        const { fill: color = 'gray' } = this.getMarkerStyle(
            marker,
            { datum: nodeDatum, highlighted: false, xKey, yKey, labelKey },
            baseStyle
        );

        const xString = sanitizeHtml(xAxis.formatDatum(xValue));
        const yString = sanitizeHtml(yAxis.formatDatum(yValue));

        let content =
            `<b>${sanitizeHtml(xName ?? xKey)}</b>: ${xString}<br>` +
            `<b>${sanitizeHtml(yName ?? yKey)}</b>: ${yString}`;

        if (labelKey) {
            content = `<b>${sanitizeHtml(labelName ?? labelKey)}</b>: ${sanitizeHtml(label.text)}<br>` + content;
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
                labelKey,
                labelName,
                title,
                color,
                seriesId: this.id,
                ...(this.getModuleTooltipParams() as RequireOptional<AgErrorBoundSeriesTooltipRendererParams>),
            }
        );
    }

    getLegendData(legendType: ChartLegendType): CategoryLegendDatum[] {
        if (!this.properties.isValid() || legendType !== 'category') {
            return [];
        }

        const { yKey: itemId, yName, title, marker, showInLegend } = this.properties;
        const { fill, stroke, fillOpacity, strokeOpacity, strokeWidth } = marker;

        const {
            id: seriesId,
            ctx: { legendManager },
            visible,
        } = this;

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
                            shape: marker.shape,
                            fill: marker.fill ?? fill ?? 'rgba(0, 0, 0, 0)',
                            stroke: marker.stroke ?? stroke ?? 'rgba(0, 0, 0, 0)',
                            fillOpacity: fillOpacity ?? 1,
                            strokeOpacity: strokeOpacity ?? 1,
                            strokeWidth: strokeWidth ?? 0,
                        },
                    },
                ],
                hideInLegend: !showInLegend,
            },
        ];
    }

    override animateEmptyUpdateReady(data: ScatterAnimationData) {
        const { markerSelection, labelSelection, annotationSelections } = data;
        markerScaleInAnimation(this, this.ctx.animationManager, markerSelection);
        seriesLabelFadeInAnimation(this, 'labels', this.ctx.animationManager, labelSelection);
        seriesLabelFadeInAnimation(this, 'annotations', this.ctx.animationManager, ...annotationSelections);
    }

    protected isLabelEnabled() {
        return this.properties.label.enabled;
    }

    protected nodeFactory() {
        return new Group();
    }

    public getFormattedMarkerStyle(datum: ScatterNodeDatum) {
        const { xKey, yKey, labelKey } = this.properties;
        return this.getMarkerStyle(this.properties.marker, { datum, xKey, yKey, labelKey, highlighted: true });
    }

    protected computeFocusBounds(opts: PickFocusInputs): BBox | undefined {
        return computeMarkerFocusBounds(this, opts);
    }
}
