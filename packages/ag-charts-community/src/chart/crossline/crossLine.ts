import type { AgBaseCrossLineLabelOptions, AgCrossLineLabelPosition } from '../../options/agChartOptions';
import type { Scale } from '../../scale/scale';
import type { BBox } from '../../scene/bbox';
import type { Group } from '../../scene/group';
import type { ChartAxisDirection } from '../chartAxisDirection';

export type CrossLineType = 'line' | 'range';

export interface CrossLine<LabelType = AgBaseCrossLineLabelOptions> {
    calculateLayout(visible: boolean): BBox | undefined;
    calculatePadding(padding: Partial<Record<AgCrossLineLabelPosition, number>>): void;
    clippedRange: [number, number];
    direction: ChartAxisDirection;
    enabled?: boolean;
    fill?: string;
    fillOpacity?: number;
    gridLength: number;
    group: Group;
    id: string;
    label: LabelType;
    lineDash?: number[];
    parallelFlipRotation: number;
    range?: [any, any];
    regularFlipRotation: number;
    scale?: Scale<any, number>;
    sideFlag: 1 | -1;
    stroke?: string;
    strokeOpacity?: number;
    strokeWidth?: number;
    type?: CrossLineType;
    update(visible: boolean): void;
    value?: any;
}
