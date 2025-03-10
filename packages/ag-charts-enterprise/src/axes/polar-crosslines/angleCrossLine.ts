import { _ModuleSupport } from 'ag-charts-community';

import { PolarCrossLine } from './polarCrossLine';

const {
    ChartAxisDirection,
    validateCrossLineValues,
    normalizeAngle360,
    isNumberEqual,
    Group,
    Path,
    Sector,
    RotatableText,
    ContinuousScale,
} = _ModuleSupport;

export class AngleCrossLine extends PolarCrossLine {
    static readonly className = 'AngleCrossLine';

    override direction: _ModuleSupport.ChartAxisDirection = ChartAxisDirection.X;

    private readonly polygonNode = new Path();
    private readonly sectorNode = new Sector();
    private readonly lineNode = new Path();
    private readonly crossLineRange = new Group();
    private readonly labelNode = new RotatableText();

    constructor() {
        super();

        this.crossLineRange.append(this.polygonNode);
        this.crossLineRange.append(this.sectorNode);
        this.crossLineRange.append(this.lineNode);
        this.labelGroup.append(this.labelNode);
    }

    update(visible: boolean) {
        const { scale, shape, type, value, range } = this;

        const visibilityCheck = () => {
            if (!ContinuousScale.is(scale)) {
                return true;
            }

            const [start, end] = range ?? [value, undefined];
            const domain = scale.getDomain?.() ?? scale.domain;
            // TODO support clipping if only end is out-of-bounds
            return start >= domain[0] && start <= domain[1] && (type === 'line' || (end >= start && end <= domain[1]));
        };

        if (!scale || !type || !validateCrossLineValues(type, value, range, scale, visibilityCheck)) {
            this.rangeGroup.visible = false;
            this.lineGroup.visible = false;
            this.labelGroup.visible = false;
            return;
        }

        this.rangeGroup.visible = visible;
        this.lineGroup.visible = visible;
        this.labelGroup.visible = visible;

        if (type === 'line' && shape === 'circle' && scale instanceof _ModuleSupport.BandScale) {
            this.type = 'range';
            this.range = [value, value];
        }

        this.updateLineNode(visible);
        this.updatePolygonNode(visible);
        this.updateSectorNode(visible);
        this.updateLabelNode(visible);
    }

    private updateLineNode(visible: boolean) {
        const { scale, type, value, lineNode: line } = this;

        if (!visible || type !== 'line' || !scale) {
            line.visible = false;
            return;
        }

        const angle = scale.convert(value);
        if (isNaN(angle)) {
            line.visible = false;
            return;
        }

        const { axisInnerRadius, axisOuterRadius } = this;

        line.visible = true;
        line.stroke = this.stroke;
        line.strokeOpacity = this.strokeOpacity ?? 1;
        line.strokeWidth = this.strokeWidth ?? 1;
        line.fill = undefined;
        line.lineDash = this.lineDash;

        const x = axisOuterRadius * Math.cos(angle);
        const y = axisOuterRadius * Math.sin(angle);
        const x0 = axisInnerRadius * Math.cos(angle);
        const y0 = axisInnerRadius * Math.sin(angle);
        line.path.clear(true);
        line.path.moveTo(x0, y0);
        line.path.lineTo(x, y);

        this.assignCrossLineGroup(false, this.crossLineRange);
    }

    private updatePolygonNode(visible: boolean) {
        const { polygonNode: polygon, range, scale, shape, type } = this;
        if (!visible || type !== 'range' || shape !== 'polygon' || !scale || !range) {
            polygon.visible = false;
            return;
        }

        const ticks = scale.ticks?.();
        if (!ticks) {
            polygon.visible = false;
            return;
        }

        const { axisInnerRadius, axisOuterRadius } = this;
        const startIndex = ticks.indexOf(range[0]);
        const endIndex = ticks.indexOf(range[1]);
        const stops =
            startIndex <= endIndex
                ? ticks.slice(startIndex, endIndex + 1)
                : ticks.slice(startIndex).concat(ticks.slice(0, endIndex + 1));
        const angles = stops.map((value: unknown) => scale.convert(value));

        polygon.visible = true;
        this.setSectorNodeProps(polygon);

        const { path } = polygon;
        path.clear(true);
        angles.forEach((angle: number, index: number) => {
            const x = axisOuterRadius * Math.cos(angle);
            const y = axisOuterRadius * Math.sin(angle);
            if (index === 0) {
                path.moveTo(x, y);
            } else {
                path.lineTo(x, y);
            }
        });
        if (axisInnerRadius === 0) {
            path.lineTo(0, 0);
        } else {
            angles
                .slice()
                .reverse()
                .forEach((angle: number) => {
                    const x = axisInnerRadius * Math.cos(angle);
                    const y = axisInnerRadius * Math.sin(angle);
                    path.lineTo(x, y);
                });
        }
        polygon.path.closePath();

        this.assignCrossLineGroup(true, this.crossLineRange);
    }

    private updateSectorNode(visible: boolean) {
        const { sectorNode: sector, range, scale, shape, type } = this;
        if (!visible || type !== 'range' || shape !== 'circle' || !scale || !range) {
            sector.visible = false;
            return;
        }

        const { axisInnerRadius, axisOuterRadius } = this;
        const angles = range.map((value) => scale.convert(value));

        const step = scale.step ?? 0;
        const padding = scale instanceof _ModuleSupport.BandScale ? step / 2 : 0;

        sector.visible = true;
        this.setSectorNodeProps(sector);

        sector.centerX = 0;
        sector.centerY = 0;
        sector.innerRadius = axisInnerRadius;
        sector.outerRadius = axisOuterRadius;
        sector.startAngle = angles[0] - padding;
        sector.endAngle = angles[1] + padding;

        this.assignCrossLineGroup(true, this.crossLineRange);
    }

    private updateLabelNode(visible: boolean) {
        const { label, labelNode: node, range, scale, type } = this;
        if (!visible || label.enabled === false || !label.text || !scale || (type === 'range' && !range)) {
            node.visible = true;
            return;
        }

        const { axisInnerRadius, axisOuterRadius } = this;

        let labelX: number;
        let labelY: number;
        let rotation: number;
        let textBaseline: CanvasTextBaseline;

        if (type === 'line') {
            const angle = normalizeAngle360(scale.convert(this.value));
            const angle270 = 1.5 * Math.PI;
            const isRightSide = isNumberEqual(angle, angle270) || angle > angle270 || angle < Math.PI / 2;
            const midX = ((axisInnerRadius + axisOuterRadius) / 2) * Math.cos(angle);
            const midY = ((axisInnerRadius + axisOuterRadius) / 2) * Math.sin(angle);

            labelX = midX + label.padding * Math.cos(angle + Math.PI / 2);
            labelY = midY + label.padding * Math.sin(angle + Math.PI / 2);
            textBaseline = isRightSide ? 'top' : 'bottom';
            rotation = isRightSide ? angle : angle - Math.PI;
        } else {
            const [startAngle, endAngle] = range!.map((value) => normalizeAngle360(scale.convert(value)));
            let angle = (startAngle + endAngle) / 2;
            if (startAngle > endAngle) {
                angle -= Math.PI;
            }
            angle = normalizeAngle360(angle);
            const isBottomSide = (isNumberEqual(angle, 0) || angle > 0) && angle < Math.PI;

            let distance: number;
            const ticks = scale.ticks?.() ?? [];
            if (this.shape === 'circle' || ticks.length < 3) {
                distance = axisOuterRadius - label.padding;
            } else {
                distance = axisOuterRadius * Math.cos(Math.PI / ticks.length) - label.padding;
            }

            labelX = distance * Math.cos(angle);
            labelY = distance * Math.sin(angle);
            textBaseline = isBottomSide ? 'bottom' : 'top';
            rotation = isBottomSide ? angle - Math.PI / 2 : angle + Math.PI / 2;
        }

        this.setLabelNodeProps(node, labelX, labelY, textBaseline, rotation);
    }
}
