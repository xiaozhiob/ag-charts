import { Group } from '../../../scene/group';
import { Path } from '../../../scene/shape/path';
import { getMarker } from '../../marker/util';
import { Selection } from '../../../scene/selection';
import { BandScale } from '../../../scale/bandScale';
import { LinearScale } from '../../../scale/linearScale';
import { BBox } from '../../../scene/bbox';
import { SeriesNodeDatum, HighlightStyle, SeriesTooltip, SeriesNodeBaseClickEvent, valueProperty } from '../series';
import { RedrawType, SceneChangeDetection } from '../../../scene/node';
import { toFixed } from '../../../util/number';
import { ChartLegendDatum, CategoryLegendDatum } from '../../legendDatum';
import { PolarSeries } from './polarSeries';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { toTooltipHtml } from '../../tooltip/tooltip';
import { sanitizeHtml } from '../../../util/sanitize';
import { interpolate } from '../../../util/string';
import {
    NUMBER,
    OPT_COLOR_STRING,
    OPT_FUNCTION,
    OPT_LINE_DASH,
    OPT_STRING,
    STRING,
    Validate,
} from '../../../util/validation';
import {
    AgPieSeriesTooltipRendererParams,
    AgRadarLineSeriesMarkerFormat,
    AgRadarLineSeriesMarkerFormatterParams,
    AgTooltipRendererResult,
    AgPieSeriesFormat,
    AgPieSeriesFormatterParams,
} from '../../agChartOptions';
import { LegendItemClickChartEvent, LegendItemDoubleClickChartEvent } from '../../interaction/chartEventManager';
import { StateMachine } from '../../../motion/states';
import { DataModel } from '../../data/dataModel';
import { SeriesMarker } from '../seriesMarker';
import { Marker } from '../../marker/marker';

class RadarLineSeriesNodeBaseClickEvent extends SeriesNodeBaseClickEvent<any> {
    readonly angleKey: string;
    readonly radiusKey: string;

    constructor(
        angleKey: string,
        radiusKey: string,
        nativeEvent: MouseEvent,
        datum: RadarLineNodeDatum,
        series: RadarLineSeries
    ) {
        super(nativeEvent, datum, series);
        this.angleKey = angleKey;
        this.radiusKey = radiusKey;
    }
}

class RadarLineSeriesNodeClickEvent extends RadarLineSeriesNodeBaseClickEvent {
    readonly type = 'nodeClick';
}

class RadarLineSeriesNodeDoubleClickEvent extends RadarLineSeriesNodeBaseClickEvent {
    readonly type = 'nodeDoubleClick';
}

interface RadarLineNodeDatum extends SeriesNodeDatum {
    readonly label?: {
        text: string;
    };
}

class RadarLineSeriesTooltip extends SeriesTooltip {
    @Validate(OPT_FUNCTION)
    renderer?: (params: AgPieSeriesTooltipRendererParams) => string | AgTooltipRendererResult = undefined;
    @Validate(OPT_STRING)
    format?: string = undefined;
}

export class RadarLineSeriesMarker extends SeriesMarker {
    @Validate(OPT_FUNCTION)
    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    formatter?: (params: AgRadarLineSeriesMarkerFormatterParams<any>) => AgRadarLineSeriesMarkerFormat = undefined;
}

type RadarLineAnimationState = 'empty' | 'ready';
type RadarLineAnimationEvent = 'update';
class RadarLineStateMachine extends StateMachine<RadarLineAnimationState, RadarLineAnimationEvent> {}

export class RadarLineSeries extends PolarSeries<RadarLineNodeDatum> {
    static className = 'RadarLineSeries';
    static type = 'radar-line' as const;

    readonly marker = new RadarLineSeriesMarker();

    private radiusScale: LinearScale = new LinearScale();

    private pathSelection: Selection<Path, boolean>;
    private markerSelection: Selection<Marker, RadarLineNodeDatum>;
    private angleAxisSelection: Selection<Path, RadarLineNodeDatum>;
    private radiusAxisSelection: Selection<Path, boolean>;

    private animationState: RadarLineStateMachine;

    private nodeData: RadarLineNodeDatum[] = [];
    private angleScale: BandScale<string>;

    // When a user toggles a series item (e.g. from the legend), its boolean state is recorded here.
    seriesItemEnabled: boolean[] = [];

    tooltip: RadarLineSeriesTooltip = new RadarLineSeriesTooltip();

    set data(input: any[] | undefined) {
        this._data = input;
        this.processSeriesItemEnabled();
    }
    get data() {
        return this._data;
    }

    /**
     * The key of the numeric field to use to determine the angle (for example,
     * a pie sector angle).
     */
    @Validate(STRING)
    angleKey = '';

    @Validate(OPT_STRING)
    angleName?: string = undefined;

    /**
     * The key of the numeric field to use to determine the radii of pie sectors.
     * The largest value will correspond to the full radius and smaller values to
     * proportionally smaller radii.
     */
    @Validate(STRING)
    radiusKey: string = '';

    @Validate(OPT_STRING)
    radiusName?: string = undefined;

    @Validate(OPT_COLOR_STRING)
    stroke?: string = 'black';

    @Validate(NUMBER(0, 1))
    strokeOpacity = 1;

    @Validate(OPT_LINE_DASH)
    lineDash?: number[] = [0];

    @Validate(NUMBER(0))
    lineDashOffset: number = 0;

    @Validate(OPT_FUNCTION)
    formatter?: (params: AgPieSeriesFormatterParams<any>) => AgPieSeriesFormat = undefined;

    /**
     * The series rotation in degrees.
     */
    @Validate(NUMBER(-360, 360))
    rotation = 0;

    @Validate(NUMBER(0))
    strokeWidth = 1;

    readonly highlightStyle = new HighlightStyle();

    constructor() {
        super({});

        this.angleScale = new BandScale();
        // Each sector is a ratio of the whole, where all ratios add up to 1.
        this.angleScale.domain = [];
        // Add 90 deg to start the chart at 12 o'clock.
        this.angleScale.range = [-Math.PI / 2, (3 * Math.PI) / 2];

        const angleAxisGroup = new Group();
        this.contentGroup.append(angleAxisGroup);
        this.angleAxisSelection = Selection.select(angleAxisGroup, Path);

        const radiusAxisGroup = new Group();
        this.contentGroup.append(radiusAxisGroup);
        this.radiusAxisSelection = Selection.select(radiusAxisGroup, Path);

        const pathGroup = new Group();
        this.contentGroup.append(pathGroup);
        this.pathSelection = Selection.select(pathGroup, Path);

        const markerGroup = new Group();
        this.contentGroup.append(markerGroup);
        this.markerSelection = Selection.select(markerGroup, () => {
            const MarkerShape = getMarker();
            return new MarkerShape();
        });

        this.animationState = new RadarLineStateMachine('empty', {
            empty: {
                on: {
                    update: {
                        target: 'ready',
                        action: () => this.animateEmptyUpdateReady(),
                    },
                },
            },
            ready: {
                on: {
                    update: {
                        target: 'ready',
                        action: () => this.animateUpdateReady(),
                    },
                },
            },
        });
        this.animationState.debug;
    }

    visibleChanged() {
        this.processSeriesItemEnabled();
    }

    private processSeriesItemEnabled() {
        const { data, visible } = this;
        this.seriesItemEnabled = data?.map(() => visible) ?? [];
    }

    getDomain(direction: ChartAxisDirection): any[] {
        if (direction === ChartAxisDirection.X) {
            return this.angleScale.domain;
        } else {
            return this.radiusScale.domain;
        }
    }

    async processData() {
        const { data = [] } = this;
        const { angleKey, radiusKey } = this;

        if (!angleKey || !radiusKey) return;

        this.dataModel = new DataModel<any, any, true>({
            props: [
                valueProperty(angleKey, false, { id: 'angleValue' }),
                valueProperty(radiusKey, false, { id: 'radiusValue', invalidValue: undefined }),
            ],
        });
        this.processedData = this.dataModel.processData(data ?? []);

        const angleValueIdx = this.dataModel.resolveProcessedDataIndexById('angleValue')?.index ?? -1;
        const radiusValueIdx = this.dataModel.resolveProcessedDataIndexById('radiusValue')?.index ?? -1;
        this.angleScale.domain = this.processedData!.domain.values[angleValueIdx];
        this.radiusScale.domain = [0, Math.max(...this.processedData!.domain.values[radiusValueIdx])];
    }

    maybeRefreshNodeData() {
        if (!this.nodeDataRefresh) return;
        const [{ nodeData = [] } = {}] = this._createNodeData();
        this.nodeData = nodeData;
        this.nodeDataRefresh = false;
    }

    async createNodeData() {
        return this._createNodeData();
    }

    private _createNodeData() {
        const { processedData, dataModel, angleKey, radiusKey } = this;

        if (!processedData || !dataModel || !angleKey || !radiusKey) {
            return [];
        }

        const angleIdx = dataModel.resolveProcessedDataIndexById(`angleValue`)?.index ?? -1;
        const radiusIdx = dataModel.resolveProcessedDataIndexById(`radiusValue`)?.index ?? -1;

        const { angleScale, radiusScale } = this;
        const { size: markerSize } = this.marker;

        const nodeData = processedData.data.map((group): RadarLineNodeDatum => {
            const { datum, values } = group;

            const angleDatum = values[angleIdx];
            const radiusDatum = values[radiusIdx];

            const angle = angleScale.convert(angleDatum);
            const radius = radiusScale.convert(radiusDatum);

            const x = this.centerX + Math.cos(angle) * radius;
            const y = this.centerY + Math.sin(angle) * radius;

            return {
                series: this,
                datum,
                point: { x, y, size: markerSize },
                nodeMidPoint: { x, y },
            };
        });

        return [{ itemId: radiusKey, nodeData, labelData: nodeData }];
    }

    updateRadiusScale(bbox: BBox) {
        const radius = Math.min(bbox.width, bbox.height) / 2;
        this.radiusScale.range = [0, radius];
    }

    async update({ seriesRect }: { seriesRect: BBox }) {
        this.updateRadiusScale(seriesRect);
        this.maybeRefreshNodeData();

        this.drawTempAxis();
        this.updatePath();
        this.updateMarkers();
    }

    private drawTempAxis() {
        const radius = this.radiusScale.range[1];
        const cx = this.centerX;
        const cy = this.centerY;
        this.angleAxisSelection.update(this.nodeData).each((node, nodeDatum) => {
            node.path.clear();
            const angle = this.angleScale.convert(nodeDatum.datum[this.angleKey]);
            node.path.moveTo(cx, cy);
            node.path.lineTo(cx + radius * Math.cos(angle), cy + radius * Math.sin(angle));
            node.stroke = 'gray';
            node.strokeWidth = 1;
        });
        this.radiusAxisSelection.update(this.seriesItemEnabled ? [true] : []).each((node) => {
            node.path.clear();
            node.path.moveTo(this.centerX + radius, this.centerY);
            node.path.arc(this.centerX, this.centerY, radius, 0, 2 * Math.PI);
            node.path.closePath();
            node.stroke = 'gray';
            node.strokeWidth = 1;
            node.fill = 'transparent';
        });
    }

    private updatePath() {
        this.pathSelection.update(this.seriesItemEnabled ? [true] : []).each((node) => {
            const { path } = node;
            path.clear();
            this.nodeData.forEach((nodeDatum, index) => {
                const point = nodeDatum.point!;
                if (index === 0) {
                    path.moveTo(point.x, point.y);
                } else {
                    path.lineTo(point.x, point.y);
                }
            });
            path.closePath();
            node.fill = 'transparent';
            node.stroke = this.stroke;
            node.strokeOpacity = this.strokeOpacity;
            node.strokeWidth = this.strokeWidth;
        });
    }

    private updateMarkers() {
        const { marker, markerSelection } = this;
        const { shape, enabled } = marker;
        const nodeData = shape && enabled ? this.nodeData : [];
        markerSelection.update(nodeData).each((node, nodeDatum) => {
            node.fill = marker.fill;
            node.stroke = marker.stroke;
            node.strokeWidth = marker.strokeWidth ?? 1;
            node.fillOpacity = marker.fillOpacity ?? 1;
            node.strokeOpacity = marker.strokeOpacity ?? 1;
            node.size = marker.size;

            const { x, y } = nodeDatum.point!;
            node.visible = node.size > 0 && !isNaN(x) && !isNaN(y);
        });
    }

    protected getNodeClickEvent(event: MouseEvent, datum: RadarLineNodeDatum): RadarLineSeriesNodeClickEvent {
        return new RadarLineSeriesNodeClickEvent(this.angleKey, this.radiusKey, event, datum, this);
    }

    protected getNodeDoubleClickEvent(
        event: MouseEvent,
        datum: RadarLineNodeDatum
    ): RadarLineSeriesNodeDoubleClickEvent {
        return new RadarLineSeriesNodeDoubleClickEvent(this.angleKey, this.radiusKey, event, datum, this);
    }

    getTooltipHtml(nodeDatum: RadarLineNodeDatum): string {
        const { angleKey, radiusKey } = this;

        if (!angleKey || !radiusKey) {
            return '';
        }

        const { angleName, radiusName, tooltip, marker, id: seriesId } = this;
        const { renderer: tooltipRenderer, format: tooltipFormat } = tooltip;
        const datum = nodeDatum.datum;
        const angleValue = datum[angleKey];
        const radiusValue = datum[radiusKey];
        const formattedAngleValue = typeof angleValue === 'number' ? toFixed(angleValue) : String(angleValue);
        const formattedRadiusValue = typeof radiusValue === 'number' ? toFixed(radiusValue) : String(radiusValue);
        const title = sanitizeHtml(radiusName);
        const content = sanitizeHtml(`${formattedAngleValue}: ${formattedRadiusValue}`);

        const { formatter: markerFormatter, fill, stroke, strokeWidth: markerStrokeWidth, size } = marker;
        const strokeWidth = markerStrokeWidth ?? this.strokeWidth;

        let format: AgRadarLineSeriesMarkerFormat | undefined = undefined;
        if (markerFormatter) {
            format = markerFormatter({
                datum,
                angleKey,
                radiusKey,
                fill,
                stroke,
                strokeWidth,
                size,
                highlighted: false,
                seriesId,
            });
        }

        const color = format?.fill ?? fill;

        const defaults: AgTooltipRendererResult = {
            title,
            backgroundColor: color,
            content,
        };

        if (tooltipFormat || tooltipRenderer) {
            const params = {
                datum,
                angleKey,
                angleValue,
                angleName,
                radiusKey,
                radiusValue,
                radiusName,
                title,
                color,
                seriesId,
            };
            if (tooltipFormat) {
                return toTooltipHtml(
                    {
                        content: interpolate(tooltipFormat, params),
                    },
                    defaults
                );
            }
            if (tooltipRenderer) {
                return toTooltipHtml(tooltipRenderer(params), defaults);
            }
        }

        return toTooltipHtml(defaults);
    }

    getLegendData(): ChartLegendDatum[] {
        const { id, data, angleKey, radiusKey, radiusName, visible, marker, stroke, strokeOpacity } = this;

        if (!(data?.length && angleKey && radiusKey)) {
            return [];
        }

        const legendData: CategoryLegendDatum[] = [
            {
                legendType: 'category',
                id: id,
                itemId: radiusKey,
                seriesId: id,
                enabled: visible,
                label: {
                    text: radiusName ?? radiusKey,
                },
                marker: {
                    shape: marker.shape,
                    fill: marker.fill ?? marker.stroke ?? stroke ?? 'rgba(0, 0, 0, 0)',
                    stroke: marker.stroke ?? stroke ?? 'rgba(0, 0, 0, 0)',
                    fillOpacity: marker.fillOpacity ?? 1,
                    strokeOpacity: marker.strokeOpacity ?? strokeOpacity ?? 1,
                },
            },
        ];
        return legendData;
    }

    onLegendItemClick(event: LegendItemClickChartEvent) {
        const { enabled, itemId, series } = event;

        if (series.id === this.id) {
            this.toggleSeriesItem(itemId, enabled);
        }
    }

    onLegendItemDoubleClick(event: LegendItemDoubleClickChartEvent) {
        const { enabled, itemId, series, numVisibleItems } = event;

        if (series.id !== this.id) return;
        const totalVisibleItems = Object.values(numVisibleItems).reduce((p, v) => p + v, 0);

        const wasClicked = series.id === this.id;
        const newEnabled = wasClicked || (enabled && totalVisibleItems === 1);

        this.toggleSeriesItem(itemId, newEnabled);
    }

    protected toggleSeriesItem(itemId: number, enabled: boolean): void {
        this.seriesItemEnabled[itemId] = enabled;
        this.nodeDataRefresh = true;
    }

    animateEmptyUpdateReady() {}

    animateUpdateReady() {}
}
