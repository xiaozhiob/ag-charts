import type { Feature, FeatureCollection, Geometry } from 'geojson';

import type { ModuleContext } from '../../../module/moduleContext';
import { fromToMotion } from '../../../motion/fromToMotion';
import { StateMachine } from '../../../motion/states';
import type { AgMapSeriesStyle } from '../../../options/series/topology/mapOptions';
import { ColorScale } from '../../../scale/colorScale';
import { LinearScale } from '../../../scale/linearScale';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import { Selection } from '../../../scene/selection';
import { Text } from '../../../scene/shape/text';
import type { PlacedLabel, PointLabelDatum } from '../../../scene/util/labelPlacement';
import { sanitizeHtml } from '../../../util/sanitize';
import type { ChartAnimationPhase } from '../../chartAnimationPhase';
import type { DataController } from '../../data/dataController';
import { getMissCount } from '../../data/dataModel';
import { createDatumId } from '../../data/processors';
import type { LegendItemClickChartEvent, LegendItemDoubleClickChartEvent } from '../../interaction/chartEventManager';
import type { CategoryLegendDatum, ChartLegendType, GradientLegendDatum } from '../../legendDatum';
import type { Marker } from '../../marker/marker';
import { getMarker } from '../../marker/util';
import { DataModelSeries } from '../dataModelSeries';
import type { SeriesNodeDataContext } from '../series';
import { SeriesNodePickMode, valueProperty } from '../series';
import type { LatLongBBox } from './LatLongBBox';
import { GeoGeometry } from './geoGeometry';
import { geometryBbox, geometryCenter, markerCenters, projectGeometry } from './geometryUtil';
import {
    MapNodeDatum,
    MapNodeDatumType,
    MapNodeLabelDatum,
    MapNodeMarkerDatum,
    MapSeriesProperties,
} from './mapSeriesProperties';
import { prepareMapMarkerAnimationFunctions } from './mapUtil';
import type { MercatorScale } from './mercatorScale';

export interface MapNodeDataContext extends SeriesNodeDataContext<MapNodeDatum, MapNodeLabelDatum> {
    markerData: MapNodeMarkerDatum[];
    projectedBackgroundGeometry: Geometry | undefined;
    visible: boolean;
}

type MapAnimationState = 'empty' | 'ready' | 'waiting' | 'clearing';
type MapAnimationEvent = 'update' | 'updateData' | 'highlight' | 'resize' | 'clear' | 'reset' | 'skip';

const isLineString = (geometry: Geometry) => {
    switch (geometry.type) {
        case 'GeometryCollection':
            return geometry.geometries.some(isLineString);
        case 'MultiLineString':
        case 'LineString':
            return true;
        case 'MultiPolygon':
        case 'Polygon':
        case 'MultiPoint':
        case 'Point':
            return false;
    }
};

export class MapSeries extends DataModelSeries<
    MapNodeDatum,
    MapSeriesProperties,
    MapNodeLabelDatum,
    MapNodeDataContext
> {
    scale: MercatorScale | undefined;

    public topologyBounds: LatLongBBox | undefined;

    override properties = new MapSeriesProperties();

    private _topology: FeatureCollection | undefined;
    private projectedGeomerties = new Map<string, Geometry>();

    private readonly colorScale = new ColorScale();
    private readonly sizeScale = new LinearScale();

    private backgroundNode = this.contentGroup.appendChild(new GeoGeometry());

    private itemGroup = this.contentGroup.appendChild(new Group({ name: 'itemGroup' }));
    private markerGroup = this.contentGroup.appendChild(new Group({ name: 'markerGroup' }));
    private highlightMarkerGroup = this.contentGroup.appendChild(new Group({ name: 'highlightMarkerGroup' }));

    private datumSelection: Selection<GeoGeometry, MapNodeDatum> = Selection.select(
        this.itemGroup,
        () => this.nodeFactory(),
        false
    );
    private labelSelection: Selection<Text, PlacedLabel<PointLabelDatum>> = Selection.select(
        this.labelGroup,
        Text,
        false
    );
    private markerSelection: Selection<Marker, MapNodeMarkerDatum> = Selection.select(
        this.markerGroup,
        () => this.markerFactory(),
        false
    );
    private highlightDatumSelection: Selection<GeoGeometry, MapNodeDatum> = Selection.select(this.highlightNode, () =>
        this.nodeFactory()
    );
    private highlightMarkerSelection: Selection<Marker, MapNodeMarkerDatum> = Selection.select(
        this.highlightMarkerGroup,
        () => this.markerFactory()
    );

    private contextNodeData: MapNodeDataContext[] = [];

    private animationState: StateMachine<MapAnimationState, MapAnimationEvent>;

    constructor(moduleCtx: ModuleContext) {
        super({
            moduleCtx,
            contentGroupVirtual: false,
            useLabelLayer: true,
            pickModes: [SeriesNodePickMode.EXACT_SHAPE_MATCH],
        });

        this.animationState = new StateMachine<MapAnimationState, MapAnimationEvent>(
            'empty',
            {
                empty: {
                    update: {
                        target: 'ready',
                        action: () => this.animateMarkers(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                ready: {
                    updateData: 'waiting',
                    clear: 'clearing',
                    resize: () => this.resetAllAnimation(),
                    reset: 'empty',
                    skip: 'ready',
                },
                waiting: {
                    update: {
                        target: 'ready',
                        action: () => this.animateMarkers(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                clearing: {
                    update: {
                        target: 'empty',
                        action: () => this.resetAllAnimation(),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
            },
            () => this.checkProcessedDataAnimatable()
        );
    }

    override addChartEventListeners(): void {
        this.destroyFns.push(
            this.ctx.chartEventManager.addListener('legend-item-click', (event) => {
                this.onLegendItemClick(event);
            }),
            this.ctx.chartEventManager.addListener('legend-item-double-click', (event) => {
                this.onLegendItemDoubleClick(event);
            })
        );
    }

    private isLabelEnabled() {
        return this.properties.labelKey != null && this.properties.label.enabled;
    }

    private isMarkerEnabled() {
        return this.properties.marker.enabled;
    }

    private nodeFactory(): GeoGeometry {
        return new GeoGeometry();
    }

    private markerFactory(): Marker {
        const { shape } = this.properties.marker;
        const MarkerShape = getMarker(shape);
        return new MarkerShape();
    }

    override async processData(dataController: DataController): Promise<void> {
        if (this.data == null || !this.properties.isValid()) {
            return;
        }

        const { data } = this;
        const { idKey, sizeKey, colorKey, labelKey, colorRange, marker, topology, background } = this.properties;

        const featureById = new Map<string, Feature>();
        topology.features.forEach((feature) => {
            const name = feature.properties?.name;
            if (name == null) return;
            featureById.set(name, feature);
        });

        const { dataModel, processedData } = await this.requestDataModel<any, any, true>(dataController, data, {
            props: [
                valueProperty(this, idKey, false, { id: 'idValue' }),
                valueProperty(this, idKey, false, {
                    id: 'featureValue',
                    processor: () => (datum) => featureById.get(datum),
                }),
                ...(labelKey ? [valueProperty(this, labelKey, false, { id: 'labelValue' })] : []),
                ...(sizeKey ? [valueProperty(this, sizeKey, true, { id: 'sizeValue' })] : []),
                ...(colorKey ? [valueProperty(this, colorKey, true, { id: 'colorValue' })] : []),
            ],
        });

        const featureIdx = dataModel.resolveProcessedDataIndexById(this, `featureValue`).index;
        let bbox = (processedData.data as any[]).reduce<LatLongBBox | undefined>((current, { values }) => {
            const feature: Feature | undefined = values[featureIdx];
            if (feature == null) return current;
            return geometryBbox(feature.geometry, current);
        }, undefined);

        const { id: backgroundId } = background;
        const backgroundTopology = background.topology ?? topology;
        const backgroundGeometry =
            backgroundId != null
                ? backgroundTopology.features.find((feature) => feature.properties?.name === backgroundId)?.geometry
                : undefined;

        if (backgroundGeometry != null) {
            bbox = geometryBbox(backgroundGeometry, bbox);
        }

        this.topologyBounds = bbox;

        if (sizeKey != null) {
            const sizeIdx = dataModel.resolveProcessedDataIndexById(this, `sizeValue`).index;
            const processedSize = processedData.domain.values[sizeIdx] ?? [];
            this.sizeScale.domain = marker.domain ?? processedSize;
        }

        if (colorRange != null && this.isColorScaleValid()) {
            const colorKeyIdx = dataModel.resolveProcessedDataIndexById(this, 'colorValue').index;
            this.colorScale.domain = processedData.domain.values[colorKeyIdx];
            this.colorScale.range = colorRange;
            this.colorScale.update();
        }

        this.animationState.transition('updateData');
    }

    private isColorScaleValid() {
        const { colorKey } = this.properties;
        if (!colorKey) {
            return false;
        }

        const { dataModel, processedData } = this;
        if (!dataModel || !processedData) {
            return false;
        }

        const colorIdx = dataModel.resolveProcessedDataIndexById(this, 'colorValue').index;
        const dataCount = processedData.data.length;
        const missCount = getMissCount(this, processedData.defs.values[colorIdx].missing);
        const colorDataMissing = dataCount === 0 || dataCount === missCount;
        return !colorDataMissing;
    }

    override async createNodeData(): Promise<MapNodeDataContext[]> {
        const {
            id: seriesId,
            dataModel,
            processedData,
            colorScale,
            sizeScale,
            properties,
            scale,
            projectedGeomerties,
        } = this;
        const {
            topology,
            idKey,
            sizeKey,
            sizeName,
            colorKey,
            colorName,
            labelKey,
            label,
            marker,
            background,
            fill: fillProperty,
        } = properties;

        if (dataModel == null || processedData == null) return [];

        const colorScaleValid = this.isColorScaleValid();

        const idIdx = dataModel.resolveProcessedDataIndexById(this, `idValue`).index;
        const featureIdx = dataModel.resolveProcessedDataIndexById(this, `featureValue`).index;
        const labelIdx = labelKey ? dataModel.resolveProcessedDataIndexById(this, `labelValue`).index : undefined;
        const sizeIdx = sizeKey ? dataModel.resolveProcessedDataIndexById(this, `sizeValue`).index : undefined;
        const colorIdx = colorKey ? dataModel.resolveProcessedDataIndexById(this, `colorValue`).index : undefined;

        sizeScale.range = [marker.size, marker.maxSize ?? marker.size];
        const font = label.getFont();

        if (this._topology !== topology) {
            projectedGeomerties.clear();
            processedData.data.forEach(({ values }) => {
                const id: string | undefined = values[idIdx];
                const geometry = (values[featureIdx] as Feature | undefined)?.geometry;
                const projectedGeometry =
                    geometry != null && scale != null ? projectGeometry(geometry, scale) : undefined;
                if (id != null && projectedGeometry != null) {
                    projectedGeomerties.set(id, projectedGeometry);
                }
            });
        }

        const nodeData: MapNodeDatum[] = [];
        const labelData: MapNodeLabelDatum[] = [];
        const markerData: MapNodeMarkerDatum[] = [];
        processedData.data.forEach(({ datum, values }) => {
            const idValue = values[idIdx];
            const colorValue: number | undefined = colorIdx != null ? values[colorIdx] : undefined;
            const sizeValue: number | undefined = sizeIdx != null ? values[sizeIdx] : undefined;
            const color: string | undefined =
                colorScaleValid && colorValue != null ? colorScale.convert(colorValue) : undefined;

            const projectedGeometry = projectedGeomerties.get(idValue);

            const labelValue = labelIdx != null ? values[labelIdx] : undefined;
            const labelText =
                labelValue != null
                    ? this.getLabelText(this.properties.label, {
                          value: labelValue,
                          datum,
                          idKey,
                          sizeKey,
                          sizeName,
                          colorKey,
                          colorName,
                      })
                    : undefined;
            const labelCenter =
                projectedGeometry != null && labelText != null ? geometryCenter(projectedGeometry, 1) : undefined;
            let labelDatum: MapNodeLabelDatum | undefined;
            if (labelText != null && labelCenter != null) {
                const [x, y] = labelCenter;
                const { width, height } = Text.getTextSize(String(labelText), font);
                labelDatum = {
                    point: { x, y, size: 0 },
                    label: { width, height, text: labelText },
                };
                labelData.push(labelDatum);
            }

            const nodeDatum: MapNodeDatum = {
                type: MapNodeDatumType.Node,
                series: this,
                itemId: idKey,
                datum,
                label: labelDatum,
                idValue: idValue,
                fill: color ?? fillProperty,
                sizeValue,
                colorValue,
                projectedGeometry,
            };

            nodeData.push(nodeDatum);

            const markers = projectedGeometry?.type === 'Point' ? markerCenters(projectedGeometry) : undefined;
            markers?.forEach(([x, y], index) => {
                const size = sizeValue != null ? sizeScale.convert(sizeValue) : 0;
                const point = { x, y, size };
                markerData.push({
                    ...nodeDatum,
                    type: MapNodeDatumType.Marker,
                    fill: color ?? marker.fill ?? fillProperty,
                    index,
                    point,
                });
            });
        });

        const { id: backgroundId } = background;
        const backgroundTopology = background.topology ?? properties.topology;
        const backgroundGeometry =
            backgroundId != null
                ? backgroundTopology.features.find((feature) => feature.properties?.name === backgroundId)?.geometry
                : undefined;
        const projectedBackgroundGeometry =
            backgroundGeometry != null && scale != null ? projectGeometry(backgroundGeometry, scale) : undefined;

        return [
            {
                itemId: seriesId,
                nodeData,
                labelData,
                markerData,
                projectedBackgroundGeometry,
                visible: true,
            },
        ];
    }

    async updateSelections(): Promise<void> {
        if (this.nodeDataRefresh) {
            this.contextNodeData = await this.createNodeData();
            this.nodeDataRefresh = false;
        }
    }

    override async update({ seriesRect }: { seriesRect?: BBox }): Promise<void> {
        const { datumSelection, labelSelection, markerSelection, highlightDatumSelection, highlightMarkerSelection } =
            this;

        await this.updateSelections();

        this.contentGroup.visible = this.visible;

        let highlightedDatum: MapNodeDatum | MapNodeMarkerDatum | undefined =
            this.ctx.highlightManager?.getActiveHighlight() as any;
        if (highlightedDatum != null && highlightedDatum.series !== this) {
            highlightedDatum = undefined;
        }

        const { nodeData, markerData, projectedBackgroundGeometry } = this.contextNodeData[0];

        this.updateBackground(projectedBackgroundGeometry);

        this.datumSelection = await this.updateDatumSelection({ nodeData, datumSelection });
        await this.updateDatumNodes({ datumSelection, isHighlight: false });

        this.labelSelection = await this.updateLabelSelection({ labelSelection });
        await this.updateLabelNodes({ labelSelection });

        this.markerSelection = await this.updateMarkerSelection({ markerData, markerSelection });
        await this.updateMarkerNodes({ markerSelection, isHighlight: false });

        this.highlightDatumSelection = await this.updateDatumSelection({
            nodeData: highlightedDatum?.type === MapNodeDatumType.Node ? [highlightedDatum] : [],
            datumSelection: highlightDatumSelection,
        });
        await this.updateDatumNodes({ datumSelection: highlightDatumSelection, isHighlight: true });

        this.highlightMarkerSelection = await this.updateMarkerSelection({
            markerData: highlightedDatum?.type === MapNodeDatumType.Marker ? [highlightedDatum] : [],
            markerSelection: highlightMarkerSelection,
        });
        await this.updateMarkerNodes({ markerSelection: highlightMarkerSelection, isHighlight: true });

        const resize = this.checkResize(seriesRect);
        if (resize) {
            this.animationState.transition('resize');
        }
        this.animationState.transition('update');
    }

    private updateBackground(projectedGeometry: Geometry | undefined) {
        const { backgroundNode, properties } = this;
        const { fill, fillOpacity, stroke, strokeWidth, strokeOpacity, lineDash, lineDashOffset } =
            properties.background;

        if (projectedGeometry == null) {
            backgroundNode.projectedGeometry = undefined;
            backgroundNode.visible = false;
            return;
        }

        backgroundNode.visible = true;
        backgroundNode.projectedGeometry = projectedGeometry;
        backgroundNode.fill = fill;
        backgroundNode.fillOpacity = fillOpacity;
        backgroundNode.stroke = stroke;
        backgroundNode.strokeWidth = strokeWidth;
        backgroundNode.strokeOpacity = strokeOpacity;
        backgroundNode.lineDash = lineDash;
        backgroundNode.lineDashOffset = lineDashOffset;
    }

    private async updateDatumSelection(opts: {
        nodeData: MapNodeDatum[];
        datumSelection: Selection<GeoGeometry, MapNodeDatum>;
    }) {
        return opts.datumSelection.update(opts.nodeData, undefined, (datum) => createDatumId(datum.idValue));
    }

    private async updateDatumNodes(opts: {
        datumSelection: Selection<GeoGeometry, MapNodeDatum>;
        isHighlight: boolean;
    }) {
        const { datumSelection, isHighlight } = opts;
        const { properties } = this;
        const highlightStyle = isHighlight ? this.properties.highlightStyle.item : undefined;

        datumSelection.each((geoGeometry, datum) => {
            const { projectedGeometry } = datum;
            if (projectedGeometry == null) {
                geoGeometry.projectedGeometry = undefined;
                geoGeometry.visible = false;
                return;
            }

            geoGeometry.projectedGeometry = projectedGeometry;
            geoGeometry.fill = highlightStyle?.fill ?? datum.fill;
            geoGeometry.fillOpacity = highlightStyle?.fillOpacity ?? properties.fillOpacity;
            geoGeometry.stroke =
                highlightStyle?.stroke ??
                properties.stroke ??
                (isLineString(projectedGeometry) ? properties.__LINE_STRING_STROKE : properties.__POLYGON_STROKE);
            geoGeometry.strokeWidth = highlightStyle?.strokeWidth ?? properties.strokeWidth;
            geoGeometry.strokeOpacity = highlightStyle?.strokeOpacity ?? properties.strokeOpacity;
            geoGeometry.lineDash = highlightStyle?.lineDash ?? properties.lineDash;
            geoGeometry.lineDashOffset = highlightStyle?.lineDashOffset ?? properties.lineDashOffset;

            geoGeometry.lineJoin = 'round';
        });
    }

    private async updateLabelSelection(opts: { labelSelection: Selection<Text, PlacedLabel<PointLabelDatum>> }) {
        const placedLabels = (this.isLabelEnabled() ? this.chart?.placeLabels().get(this) : undefined) ?? [];
        return opts.labelSelection.update(placedLabels);
    }

    private async updateLabelNodes(opts: { labelSelection: Selection<Text, PlacedLabel<PointLabelDatum>> }) {
        const { labelSelection } = opts;
        const { color: fill, fontStyle, fontWeight, fontSize, fontFamily } = this.properties.label;

        labelSelection.each((label, { x, y, width, height, text }) => {
            label.visible = true;
            label.x = x + width / 2;
            label.y = y + height / 2;
            label.text = text;
            label.fill = fill;
            label.fontStyle = fontStyle;
            label.fontWeight = fontWeight;
            label.fontSize = fontSize;
            label.fontFamily = fontFamily;
            label.textAlign = 'center';
            label.textBaseline = 'middle';
        });
    }

    private async updateMarkerSelection(opts: {
        markerData: MapNodeMarkerDatum[];
        markerSelection: Selection<Marker, MapNodeMarkerDatum>;
    }) {
        const { markerData, markerSelection } = opts;

        if (this.properties.marker.isDirty()) {
            markerSelection.clear();
            markerSelection.cleanup();
        }

        const data = this.isMarkerEnabled() ? markerData : [];
        return markerSelection.update(data, undefined, (datum) => createDatumId([datum.idValue, datum.index]));
    }

    private async updateMarkerNodes(opts: {
        markerSelection: Selection<Marker, MapNodeMarkerDatum>;
        isHighlight: boolean;
    }) {
        const { markerSelection, isHighlight } = opts;
        const { fillOpacity, stroke, strokeWidth, strokeOpacity, size } = this.properties.marker;
        const highlightStyle = isHighlight ? this.properties.highlightStyle.item : undefined;

        markerSelection.each((marker, markerDatum) => {
            const { point } = markerDatum;

            marker.size = point.size > 0 ? point.size : size;
            marker.fill = highlightStyle?.fill ?? markerDatum.fill;
            marker.fillOpacity = highlightStyle?.fillOpacity ?? fillOpacity;
            marker.stroke = highlightStyle?.stroke ?? stroke;
            marker.strokeWidth = highlightStyle?.strokeWidth ?? strokeWidth;
            marker.strokeOpacity = highlightStyle?.strokeOpacity ?? strokeOpacity;
            marker.translationX = point.x;
            marker.translationY = point.y;
        });

        if (!isHighlight) {
            this.properties.marker.markClean();
        }
    }

    onLegendItemClick(event: LegendItemClickChartEvent) {
        const { legendItemName } = this.properties;
        const { enabled, itemId, series } = event;

        const matchedLegendItemName = legendItemName != null && legendItemName === event.legendItemName;
        if (series.id === this.id || matchedLegendItemName) {
            this.toggleSeriesItem(itemId, enabled);
        }
    }

    onLegendItemDoubleClick(event: LegendItemDoubleClickChartEvent) {
        const { enabled, itemId, series, numVisibleItems } = event;
        const { legendItemName } = this.properties;

        const matchedLegendItemName = legendItemName != null && legendItemName === event.legendItemName;
        if (series.id === this.id || matchedLegendItemName) {
            // Double-clicked item should always become visible.
            this.toggleSeriesItem(itemId, true);
        } else if (enabled && numVisibleItems === 1) {
            // Other items should become visible if there is only one existing visible item.
            this.toggleSeriesItem(itemId, true);
        } else {
            // Disable other items if not exactly one enabled.
            this.toggleSeriesItem(itemId, false);
        }
    }

    override isProcessedDataAnimatable() {
        return true;
    }

    override resetAnimation(phase: ChartAnimationPhase): void {
        if (phase === 'initial') {
            this.animationState.transition('reset');
        } else if (phase === 'ready') {
            this.animationState.transition('skip');
        }
    }

    private resetAllAnimation() {
        // Stop any running animations by prefix convention.
        this.ctx.animationManager.stopByAnimationGroupId(this.id);
        this.ctx.animationManager.skipCurrentBatch();

        this.datumSelection.cleanup();
        this.labelSelection.cleanup();
        this.markerSelection.cleanup();
        this.highlightDatumSelection.cleanup();
        this.highlightMarkerSelection.cleanup();
    }

    private animateMarkers() {
        const { animationManager } = this.ctx;
        const fns = prepareMapMarkerAnimationFunctions();
        fromToMotion(this.id, 'markers', animationManager, [this.markerSelection, this.highlightMarkerSelection], fns);
    }

    override getLabelData(): PointLabelDatum[] {
        return this.contextNodeData.flatMap(({ labelData }) => labelData);
    }

    override getSeriesDomain() {
        return [NaN, NaN];
    }

    override getLegendData(legendType: ChartLegendType): CategoryLegendDatum[] | GradientLegendDatum[] {
        const { processedData, dataModel } = this;
        if (processedData == null || dataModel == null) return [];
        const {
            legendItemName,
            idKey,
            fill,
            fillOpacity,
            stroke,
            strokeWidth,
            strokeOpacity,
            colorKey,
            colorName,
            colorRange,
            visible,
        } = this.properties;

        if (legendType === 'gradient' && colorKey != null && colorRange != null) {
            const colorDomain =
                processedData.domain.values[dataModel.resolveProcessedDataIndexById(this, 'colorValue').index];
            const legendDatum: GradientLegendDatum = {
                legendType: 'gradient',
                enabled: visible,
                seriesId: this.id,
                colorName,
                colorRange,
                colorDomain,
            };
            return [legendDatum];
        } else if (legendType === 'category') {
            const legendDatum: CategoryLegendDatum = {
                legendType: 'category',
                id: this.id,
                itemId: legendItemName ?? idKey,
                seriesId: this.id,
                enabled: visible,
                label: { text: legendItemName ?? idKey },
                marker: {
                    fill,
                    fillOpacity,
                    stroke,
                    strokeWidth,
                    strokeOpacity,
                },
                legendItemName,
            };
            return [legendDatum];
        } else {
            return [];
        }
    }

    override getTooltipHtml(nodeDatum: MapNodeDatum): string {
        const {
            id: seriesId,
            processedData,
            ctx: { callbackCache },
        } = this;

        if (!processedData || !this.properties.isValid()) {
            return '';
        }

        const { idKey, sizeKey, sizeName, colorKey, colorName, stroke, strokeWidth, formatter, tooltip } =
            this.properties;
        const { datum, fill, idValue, sizeValue, colorValue } = nodeDatum;

        const title = sanitizeHtml(idValue);
        const contentLines: string[] = [];
        if (sizeValue != null) {
            contentLines.push(sanitizeHtml((sizeName ?? sizeKey) + ': ' + sizeValue));
        }
        if (colorValue != null) {
            contentLines.push(sanitizeHtml((colorName ?? colorKey) + ': ' + colorValue));
        }
        const content = contentLines.join('<br>');

        let format: AgMapSeriesStyle | undefined;

        if (formatter) {
            format = callbackCache.call(formatter, {
                seriesId,
                datum,
                idKey,
                fill,
                stroke,
                strokeWidth: this.getStrokeWidth(strokeWidth),
                highlighted: false,
            });
        }

        const color = format?.fill ?? fill;

        return tooltip.toTooltipHtml(
            { title, content, backgroundColor: color },
            {
                seriesId,
                datum,
                idKey,
                title,
                color,
                ...this.getModuleTooltipParams(),
            }
        );
    }
}
