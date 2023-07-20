import type { Group } from '../../scene/group';
import type { Scale } from '../../scale/scale';
import type { ChartAxisDirection } from '../chartAxisDirection';
import type { AgBaseCrossLineLabelOptions, AgCrossLineLabelPosition } from '../agChartOptions';

export type CrossLineType = 'line' | 'range';

export interface CrossLine<LabelType = AgBaseCrossLineLabelOptions> {
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
