import { _ModuleSupport } from 'ag-charts-community';

import { PolarCrossLine, PolarCrossLineLabel } from './polarCrossLine';

const {
    ChartAxisDirection,
    Validate,
    DEGREE,
    validateCrossLineValues,
    clamp,
    normalizeAngle360,
    toRadians,
    isNumberEqual,
    Group,
    Path,
    Sector,
    RotatableText,
} = _ModuleSupport;

class RadiusCrossLineLabel extends PolarCrossLineLabel {
    @Validate(DEGREE, { optional: true })
    positionAngle?: number = undefined;
}

export class RadiusCrossLine extends PolarCrossLine {
    static readonly className = 'RadiusCrossLine';

    override direction: _ModuleSupport.ChartAxisDirection = ChartAxisDirection.Y;
    gridAngles?: number[];

    override label = new RadiusCrossLineLabel();

    private readonly polygonNode = new Path();
    private readonly sectorNode = new Sector();
    private readonly crossLineRange = new Group();
    private readonly labelNode = new RotatableText();

    private outerRadius = 0;
    private innerRadius = 0;

    constructor() {
        super();

        this.crossLineRange.append(this.polygonNode);
        this.crossLineRange.append(this.sectorNode);
        this.labelGroup.append(this.labelNode);
    }

    update(visible: boolean) {
        const { scale, type, value, range } = this;
        if (!scale || !type || !validateCrossLineValues(type, value, range, scale)) {
            this.rangeGroup.visible = false;
            this.lineGroup.visible = false;
            this.labelGroup.visible = false;
            return;
        }

        if (type === 'line' && scale instanceof _ModuleSupport.BandScale) {
            this.type = 'range';
            this.range = [value, value];
        }

        this.updateRadii();

        const { innerRadius, outerRadius } = this;
        visible &&= innerRadius >= this.axisInnerRadius && outerRadius <= this.axisOuterRadius;

        this.rangeGroup.visible = visible;
        this.lineGroup.visible = visible;
        this.labelGroup.visible = visible;

        this.updatePolygonNode(visible);
        this.updateSectorNode(visible);
        this.updateLabelNode(visible);

        this.assignCrossLineGroup(this.type === 'range', this.crossLineRange);
    }

    private updateRadii() {
        const { range, scale, type, axisInnerRadius, axisOuterRadius } = this;

        if (!scale) return { innerRadius: 0, outerRadius: 0 };

        const getRadius = (value: number) => axisOuterRadius + axisInnerRadius - value;

        let outerRadius = 0;
        let innerRadius = 0;

        if (type === 'line') {
            outerRadius = getRadius(scale.convert(this.value));
            innerRadius = outerRadius;
        } else {
            const bandwidth = Math.abs(scale?.bandwidth ?? 0);
            const convertedRange = range!.map((r) => scale.convert(r));
            outerRadius = getRadius(Math.max(...convertedRange));
            innerRadius = getRadius(Math.min(...convertedRange)) + bandwidth;
        }

        this.outerRadius = outerRadius;
        this.innerRadius = innerRadius;
    }

    private drawPolygon(radius: number, angles: number[], polygon: _ModuleSupport.Path) {
        angles.forEach((angle, index) => {
            const x = radius * Math.cos(angle);
            const y = radius * Math.sin(angle);
            if (index === 0) {
                polygon.path.moveTo(x, y);
            } else {
                polygon.path.lineTo(x, y);
            }
        });
        polygon.path.closePath();
    }

    private updatePolygonNode(visible: boolean) {
        const { gridAngles, polygonNode: polygon, scale, shape, type, innerRadius, outerRadius } = this;
        if (!visible || shape !== 'polygon' || !scale || !gridAngles) {
            polygon.visible = false;
            return;
        }

        polygon.visible = true;

        const padding = this.getPadding();

        polygon.path.clear(true);
        this.drawPolygon(outerRadius - padding, gridAngles, polygon);

        const reversedAngles = gridAngles.slice().reverse();
        const innerPolygonRadius = type === 'line' ? outerRadius - padding : innerRadius + padding;
        this.drawPolygon(innerPolygonRadius, reversedAngles, polygon);

        this.setSectorNodeProps(polygon);
    }

    private updateSectorNode(visible: boolean) {
        const { axisInnerRadius, axisOuterRadius, scale, sectorNode: sector, shape, innerRadius, outerRadius } = this;
        if (!visible || shape !== 'circle' || !scale) {
            sector.visible = false;
            return;
        }

        sector.visible = true;

        sector.startAngle = 0;
        sector.endAngle = 2 * Math.PI;

        const padding = this.getPadding();
        const r0 = clamp(axisInnerRadius, innerRadius + padding, axisOuterRadius);
        const r1 = clamp(axisInnerRadius, outerRadius - padding, axisOuterRadius);
        sector.innerRadius = Math.min(r0, r1);
        sector.outerRadius = Math.max(r0, r1);

        this.setSectorNodeProps(sector);
    }

    private updateLabelNode(visible: boolean) {
        const { innerRadius, label, labelNode: node, scale, shape, type } = this;
        if (!visible || label.enabled === false || !label.text || !scale) {
            node.visible = false;
            return;
        }

        const angle = normalizeAngle360(toRadians((label.positionAngle ?? 0) - 90));
        const isBottomSide = (isNumberEqual(angle, 0) || angle > 0) && angle < Math.PI;
        const rotation = isBottomSide ? angle - Math.PI / 2 : angle + Math.PI / 2;

        let distance = 0;
        const angles = this.gridAngles ?? [];
        if (type === 'line') {
            distance = innerRadius + label.padding;
        } else if (shape === 'circle' || angles.length < 3) {
            distance = innerRadius - label.padding;
        } else {
            distance = innerRadius * Math.cos(Math.PI / angles.length) - label.padding;
        }

        const labelX = distance * Math.cos(angle);
        const labelY = distance * Math.sin(angle);

        let textBaseline: CanvasTextBaseline;
        if (type === 'line') {
            textBaseline = isBottomSide ? 'top' : 'bottom';
        } else {
            textBaseline = isBottomSide ? 'bottom' : 'top';
        }

        this.setLabelNodeProps(node, labelX, labelY, textBaseline, rotation);
    }

    private getPadding() {
        const { scale } = this;

        if (!scale) return 0;

        const bandwidth = Math.abs(scale.bandwidth ?? 0);
        const step = Math.abs(scale.step ?? 0);
        return scale instanceof _ModuleSupport.BandScale ? (step - bandwidth) / 2 : 0;
    }
}
