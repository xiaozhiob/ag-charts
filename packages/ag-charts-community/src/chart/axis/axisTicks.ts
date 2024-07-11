import type { AgCartesianAxisPosition, CssColor, FontFamily, FontSize, FontStyle, FontWeight } from 'ag-charts-types';

import { resetMotion } from '../../motion/resetMotion';
import { LinearScale } from '../../scale/linearScale';
import { BBox } from '../../scene/bbox';
import { Group } from '../../scene/group';
import { Matrix } from '../../scene/matrix';
import type { Node } from '../../scene/node';
import { Selection } from '../../scene/selection';
import { Text } from '../../scene/shape/text';
import { toRadians } from '../../util/angle';
import { arraysEqual } from '../../util/array';
import { createId } from '../../util/id';
import { clamp, countFractionDigits, findMinMax, findRangeExtent, round } from '../../util/number';
import { createIdsGenerator } from '../../util/tempUtils';
import { isNumber } from '../../util/type-guards';
import { OBJECT, POSITION, Validate } from '../../util/validation';
import type { ChartAxisLabelFlipFlag } from '../chartAxis';
import { ChartAxisDirection } from '../chartAxisDirection';
import { calculateLabelRotation, getTextAlign, getTextBaseline } from '../label';
import { Layers } from '../layers';
import { AxisInterval } from './axisInterval';
import { AxisLabel } from './axisLabel';
import { resetAxisGroupFn, resetAxisLabelSelectionFn } from './axisUtil';

interface TickDatum {
    tickLabel: string;
    tick: any;
    tickId: string;
    translationY: number;
}

interface LabelNodeDatum {
    tickId: string;
    fill?: CssColor;
    fontFamily?: FontFamily;
    fontSize?: FontSize;
    fontStyle?: FontStyle;
    fontWeight?: FontWeight;
    rotation: number;
    rotationCenterX: number;
    text: string;
    textAlign?: CanvasTextAlign;
    textBaseline: CanvasTextBaseline;
    visible: boolean;
    x: number;
    y: number;
    translationY: number;
    range: number[];
}

interface TickData {
    rawTicks: any[];
    fractionDigits: number;
    ticks: TickDatum[];
}

interface TickGenerationResult {
    tickData: TickData;
    combinedRotation: number;
    textBaseline: CanvasTextBaseline;
    textAlign: CanvasTextAlign;
}

export class AxisTicks {
    static readonly defaultTickCount = 5;
    static readonly defaultMaxTickCount = 6;
    static readonly defaultTickMinSpacing = 50;

    readonly id = createId(this);

    @Validate(OBJECT)
    readonly interval = new AxisInterval();

    @Validate(POSITION)
    position!: AgCartesianAxisPosition;

    get direction() {
        return ['top', 'bottom'].includes(this.position) ? ChartAxisDirection.X : ChartAxisDirection.Y;
    }

    readonly axisGroup = new Group({ name: `${this.id}-axis`, zIndex: Layers.AXIS_ZINDEX });

    protected readonly tickLabelGroup = this.axisGroup.appendChild(
        new Group({ name: `${this.id}-Axis-tick-labels`, zIndex: Layers.AXIS_ZINDEX })
    );

    protected readonly labelGroup = new Group({ name: `${this.id}-Labels`, zIndex: Layers.SERIES_ANNOTATION_ZINDEX });

    protected tickLabelGroupSelection = Selection.select<Text, LabelNodeDatum>(this.tickLabelGroup, Text, false);

    readonly label = new AxisLabel();

    readonly translation = { x: 0, y: 0 };
    rotation: number = 0; // axis rotation angle in degrees

    readonly scale = new LinearScale();

    private updateDirection() {
        switch (this.position) {
            case 'top':
                this.rotation = -90;
                this.label.mirrored = true;
                this.label.parallel = true;
                break;
            case 'right':
                this.rotation = 0;
                this.label.mirrored = true;
                this.label.parallel = false;
                break;
            case 'bottom':
                this.rotation = -90;
                this.label.mirrored = false;
                this.label.parallel = true;
                break;
            case 'left':
                this.rotation = 0;
                this.label.mirrored = false;
                this.label.parallel = false;
                break;
        }
    }

    attachAxis(axisNode: Node) {
        axisNode.appendChild(this.axisGroup);
    }

    range: [number, number] = [0, 1];

    /**
     * Checks if a point or an object is in range.
     * @param x A point (or object's starting point).
     * @param tolerance Expands the range on both ends by this amount.
     */
    private inRange(x: number, tolerance = 0): boolean {
        const [min, max] = findMinMax(this.range);
        return x >= min - tolerance && x <= max + tolerance;
    }

    public padding: number = 0;

    private getTickLabelProps(
        datum: TickDatum,
        params: {
            combinedRotation: number;
            textBaseline: CanvasTextBaseline;
            textAlign: CanvasTextAlign;
            range: number[];
        }
    ): LabelNodeDatum {
        const { label } = this;
        const { combinedRotation, textBaseline, textAlign, range } = params;
        const text = datum.tickLabel;
        const sideFlag = label.getSideFlag();
        const labelX = sideFlag * (label.padding + this.padding);
        return {
            visible: Boolean(text),
            tickId: datum.tickId,
            fill: label.color,
            fontFamily: label.fontFamily,
            fontSize: label.fontSize,
            fontStyle: label.fontStyle,
            fontWeight: label.fontWeight,
            rotation: combinedRotation,
            rotationCenterX: labelX,
            translationY: Math.round(datum.translationY),
            text,
            textAlign,
            textBaseline,
            x: labelX,
            y: 0,
            range,
        };
    }

    calculateLayout(): BBox {
        this.updateDirection();

        const sideFlag = this.label.getSideFlag();

        this.scale.interval = this.interval.step;
        this.scale.range = this.range;
        this.scale.update();

        const { tickData, combinedRotation, textBaseline, textAlign } = this.generateTicks(sideFlag);
        const params = { range: this.range, combinedRotation, textAlign, textBaseline };
        const [r0, r1] = findMinMax(this.range);
        const padding = this.padding;
        const boxes: BBox[] = [];

        boxes.push(new BBox(Math.min(sideFlag * padding, 0), r0, padding, r1 - r0)); // lineBox

        this.axisGroup.datum = this.getAxisTransform();

        this.tickLabelGroupSelection.update(
            tickData.ticks.map((d) => this.getTickLabelProps(d, params)),
            (group) => group.appendChild(new Text()),
            (datum) => datum.tickId
        );

        if (this.label.enabled) {
            // Apply label option values
            this.tickLabelGroupSelection.each((node, datum) => {
                node.setProperties(datum, [
                    'fill',
                    'fontFamily',
                    'fontSize',
                    'fontStyle',
                    'fontWeight',
                    'text',
                    'textAlign',
                    'textBaseline',
                ]);
            });

            const tempText = new Text();
            tickData.ticks.forEach((datum) => {
                if (!datum.tickLabel) return;

                tempText.setProperties(
                    this.getTickLabelProps(datum, {
                        range: this.range,
                        combinedRotation,
                        textAlign,
                        textBaseline,
                    })
                );

                const bbox = tempText.computeTransformedBBox();
                if (bbox) {
                    boxes.push(bbox);
                }
            });
        }

        resetMotion([this.axisGroup], resetAxisGroupFn());
        resetMotion([this.tickLabelGroupSelection], resetAxisLabelSelectionFn());

        this.tickLabelGroup.visible = this.label.enabled;

        const bbox = BBox.merge(boxes);
        return this.getTransformBox(bbox);
    }

    private getTransformBox(bbox: BBox) {
        const matrix = new Matrix();
        const { rotation, translationX, translationY } = this.getAxisTransform();
        Matrix.updateTransformMatrix(matrix, 1, 1, rotation, translationX, translationY);
        return matrix.transformBBox(bbox);
    }

    setDomain(domain: number[]) {
        this.scale.domain = [...domain];
    }

    private calculateRotations() {
        const rotation = toRadians(this.rotation);
        // When labels are parallel to the axis line, the `parallelFlipFlag` is used to
        // flip the labels to avoid upside-down text, when the axis is rotated
        // such that it is in the right hemisphere, i.e. the angle of rotation
        // is in the [0, π] interval.
        // The rotation angle is normalized, so that we have an easier time checking
        // if it's in the said interval. Since the axis is always rendered vertically
        // and then rotated, zero rotation means 12 (not 3) o-clock.
        // -1 = flip
        //  1 = don't flip (default)
        const parallelFlipRotation = rotation;
        const regularFlipRotation = rotation - Math.PI / 2;
        return { parallelFlipRotation, regularFlipRotation };
    }

    private generateTicks(sideFlag: ChartAxisLabelFlipFlag): TickGenerationResult {
        const { parallel, rotation } = this.label;
        const { step, values, minSpacing, maxSpacing } = this.interval;
        const { defaultRotation, configuredRotation, parallelFlipFlag, regularFlipFlag } = calculateLabelRotation({
            ...this.calculateRotations(),
            rotation,
            parallel,
        });

        const { maxTickCount, minTickCount, defaultTickCount } = this.estimateTickCount(minSpacing, maxSpacing);
        const maxIterations = isNaN(maxTickCount) ? 10 : maxTickCount;

        let index = 0;
        let tickData: TickData = { rawTicks: [], fractionDigits: 0, ticks: [] };

        let tickCount = Math.max(defaultTickCount - index, minTickCount);

        const allowMultipleAttempts = step == null && values == null && tickCount > minTickCount;

        for (let hasChanged = false; !hasChanged && index <= maxIterations; index++) {
            const prevTicks = tickData.rawTicks;

            tickCount = Math.max(defaultTickCount - index, minTickCount);

            if (tickCount) {
                this.scale.tickCount = tickCount;
                this.scale.minTickCount = minTickCount ?? 0;
                this.scale.maxTickCount = maxTickCount ?? Infinity;
            }

            tickData = this.getTicksData();

            if (!allowMultipleAttempts) break;

            hasChanged = !arraysEqual(tickData.rawTicks, prevTicks);
        }

        // TODO check label overlap

        const combinedRotation = defaultRotation + configuredRotation;
        const textAlign = getTextAlign(parallel, configuredRotation, 0, sideFlag, regularFlipFlag);
        const textBaseline = getTextBaseline(parallel, configuredRotation, sideFlag, parallelFlipFlag);

        return { tickData, combinedRotation, textBaseline, textAlign };
    }

    private getTicksData() {
        const ticks: TickDatum[] = [];
        const rawTicks = this.scale.ticks();
        const fractionDigits = rawTicks.reduce((max, tick) => Math.max(max, countFractionDigits(tick)), 0);
        const idGenerator = createIdsGenerator();

        const labelFormatter = this.label.format
            ? this.scale.tickFormat({ ticks: rawTicks, specifier: this.label.format })
            : (x: unknown) => (isNumber(x) ? x.toFixed(fractionDigits) : String(x));

        for (let i = 0; i < rawTicks.length; i++) {
            const tick = rawTicks[i];
            const translationY = this.scale.convert(tick);

            // Do not render ticks outside the range with a small tolerance. A clip rect would trim long labels, so
            // instead hide ticks based on their translation.
            if (!this.inRange(translationY, 0.001)) continue;

            const tickLabel =
                this.label.formatter?.({ value: tick, index: i, fractionDigits }) ??
                labelFormatter(tick) ??
                String(tick);

            ticks.push({
                tick,
                tickLabel,
                tickId: idGenerator(tickLabel),
                translationY: Math.floor(translationY),
            });
        }

        return { rawTicks, fractionDigits, ticks };
    }

    private estimateTickCount(
        minSpacing: number,
        maxSpacing: number
    ): {
        minTickCount: number;
        maxTickCount: number;
        defaultTickCount: number;
    } {
        const extentWithBleed = round(findRangeExtent(this.range), 2);
        const defaultMinSpacing = Math.max(
            AxisTicks.defaultTickMinSpacing,
            extentWithBleed / AxisTicks.defaultMaxTickCount
        );

        if (isNaN(minSpacing)) {
            minSpacing = defaultMinSpacing;
        }
        if (isNaN(maxSpacing)) {
            maxSpacing = extentWithBleed;
        }
        if (minSpacing > maxSpacing) {
            if (minSpacing === defaultMinSpacing) {
                minSpacing = maxSpacing;
            } else {
                maxSpacing = minSpacing;
            }
        }

        // Clamps the min spacing between ticks to be no more than the min distance between datums
        const clampMaxTickCount = !isNaN(maxSpacing) && 1 < defaultMinSpacing;

        // TODO: Remove clamping to hardcoded 100 max tick count, this is a temp fix for zooming
        const maxTickCount = clamp(
            1,
            Math.floor(extentWithBleed / minSpacing),
            clampMaxTickCount ? Math.min(Math.floor(extentWithBleed), 100) : 100
        );
        const minTickCount = Math.min(maxTickCount, Math.ceil(extentWithBleed / maxSpacing));
        const defaultTickCount = clamp(minTickCount, AxisTicks.defaultTickCount, maxTickCount);

        return { minTickCount, maxTickCount, defaultTickCount };
    }

    private getAxisTransform() {
        return {
            rotation: toRadians(this.rotation),
            translationX: Math.floor(this.translation.x),
            translationY: Math.floor(this.translation.y),
        };
    }
}
