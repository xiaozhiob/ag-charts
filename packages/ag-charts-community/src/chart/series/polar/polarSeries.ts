import type { ModuleContext } from '../../../module/moduleContext';
import type { AnimationValue } from '../../../motion/animation';
import { resetMotion } from '../../../motion/resetMotion';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import { type Node, PointerEvents } from '../../../scene/node';
import { Selection } from '../../../scene/selection';
import { Path } from '../../../scene/shape/path';
import { Text } from '../../../scene/shape/text';
import type { PointLabelDatum } from '../../../scene/util/labelPlacement';
import { StateMachine } from '../../../util/stateMachine';
import type { ChartAnimationPhase } from '../../chartAnimationPhase';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { DataModelSeries } from '../dataModelSeries';
import { type PickFocusInputs, SeriesNodePickMode } from '../series';
import type { SeriesProperties } from '../seriesProperties';
import type { SeriesNodeDatum } from '../seriesTypes';
import { PolarZIndexMap } from './polarZIndexMap';

export type PolarAnimationState = 'empty' | 'ready' | 'waiting' | 'clearing';
export type PolarAnimationEvent = {
    update: PolarAnimationData;
    updateData: undefined;
    highlight: undefined;
    highlightMarkers: undefined;
    resize: PolarAnimationData;
    clear: { seriesRect?: BBox };
    reset: undefined;
    skip: undefined;
};
export type PolarAnimationData = { duration?: number };

type PolarSeriesProperties = {
    angleKey: string;
    angleName?: string;
    radiusKey?: string;
    radiusName?: string;
};

export abstract class PolarSeries<
    TDatum extends SeriesNodeDatum,
    TProps extends SeriesProperties<any> & PolarSeriesProperties,
    TNode extends Node,
> extends DataModelSeries<TDatum, TProps> {
    protected itemGroup = this.contentGroup.appendChild(new Group());
    public getItemNodes(): TNode[] {
        return [...this.itemGroup.children()] as TNode[];
    }

    protected nodeData: TDatum[] = [];
    public override getNodeData(): TDatum[] | undefined {
        return this.nodeData;
    }

    protected itemSelection: Selection<TNode, TDatum> = Selection.select(
        this.itemGroup,
        () => this.nodeFactory(),
        false
    );
    protected labelSelection: Selection<Text, TDatum> = Selection.select(
        this.labelGroup,
        () => this.labelFactory(),
        false
    );
    protected highlightSelection: Selection<TNode, TDatum> = Selection.select(this.highlightGroup, () =>
        this.nodeFactory()
    );
    protected highlightLabelSelection: Selection<Text, TDatum> = Selection.select(this.highlightLabel, () =>
        this.labelFactory()
    );

    animationResetFns?: {
        item?: (node: TNode, datum: TDatum) => AnimationValue & Partial<TNode>;
        label?: (node: Text, datum: TDatum) => AnimationValue & Partial<Text>;
    };

    /**
     * The center of the polar series (for example, the center of a pie).
     * If the polar chart has multiple series, all of them will have their
     * center set to the same value as a result of the polar chart layout.
     * The center coordinates are not supposed to be set by the user.
     */
    centerX: number = 0;
    centerY: number = 0;

    /**
     * The maximum radius the series can use.
     * This value is set automatically as a result of the polar chart layout
     * and is not supposed to be set by the user.
     */
    radius: number = 0;

    protected animationState: StateMachine<PolarAnimationState, PolarAnimationEvent>;

    constructor({
        useLabelLayer = false,
        pickModes = [SeriesNodePickMode.NEAREST_NODE, SeriesNodePickMode.EXACT_SHAPE_MATCH],
        canHaveAxes = false,
        animationResetFns,
        ...opts
    }: {
        moduleCtx: ModuleContext;
        useLabelLayer?: boolean;
        pickModes?: SeriesNodePickMode[];
        canHaveAxes?: boolean;
        animationResetFns?: {
            item?: (node: TNode, datum: TDatum) => AnimationValue & Partial<TNode>;
            label?: (node: Text, datum: TDatum) => AnimationValue & Partial<Text>;
        };
    }) {
        super({
            ...opts,
            useLabelLayer,
            pickModes,
            directionKeys: {
                [ChartAxisDirection.X]: ['angleKey'],
                [ChartAxisDirection.Y]: ['radiusKey'],
            },
            directionNames: {
                [ChartAxisDirection.X]: ['angleName'],
                [ChartAxisDirection.Y]: ['radiusName'],
            },
            canHaveAxes,
        });

        this.animationResetFns = animationResetFns;

        this.animationState = new StateMachine<PolarAnimationState, PolarAnimationEvent>(
            'empty',
            {
                empty: {
                    update: {
                        target: 'ready',
                        action: (data) => this.animateEmptyUpdateReady(data),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                ready: {
                    updateData: 'waiting',
                    clear: 'clearing',
                    highlight: (data) => this.animateReadyHighlight(data),
                    highlightMarkers: (data) => this.animateReadyHighlightMarkers(data),
                    resize: (data) => this.animateReadyResize(data),
                    reset: 'empty',
                    skip: 'ready',
                },
                waiting: {
                    update: {
                        target: 'ready',
                        action: (data) => this.animateWaitingUpdateReady(data),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
                clearing: {
                    update: {
                        target: 'empty',
                        action: (data) => this.animateClearingUpdateEmpty(data),
                    },
                    reset: 'empty',
                    skip: 'ready',
                },
            },
            () => this.checkProcessedDataAnimatable()
        );
    }

    override setSeriesIndex(index: number) {
        if (!super.setSeriesIndex(index)) return false;

        // Unlike most series, highlights on polars appear on top of all other polar series
        // This is to fix highlights for nightingale
        this.contentGroup.zIndex = [PolarZIndexMap.FOREGROUND, index];
        this.highlightGroup.zIndex = [PolarZIndexMap.HIGHLIGHT, index];

        return true;
    }

    override resetAnimation(phase: ChartAnimationPhase): void {
        if (phase === 'initial') {
            this.animationState.transition('reset');
        } else if (phase === 'ready') {
            this.animationState.transition('skip');
        }
    }

    protected abstract nodeFactory(): TNode;

    protected labelFactory(): Text {
        const text = new Text();
        text.pointerEvents = PointerEvents.None;
        return text;
    }

    override addChartEventListeners(): void {
        this.destroyFns.push(
            this.ctx.chartEventManager?.addListener('legend-item-click', (event) => this.onLegendItemClick(event))
        );
    }

    getInnerRadius(): number {
        return 0;
    }

    surroundingRadius?: number;

    getLabelData(): PointLabelDatum[] {
        return [];
    }

    computeLabelsBBox(_options: { hideWhenNecessary: boolean }, _seriesRect: BBox): BBox | null | Promise<BBox | null> {
        return null;
    }

    protected resetAllAnimation() {
        const { item, label } = this.animationResetFns ?? {};

        this.ctx.animationManager.stopByAnimationGroupId(this.id);

        if (item) {
            resetMotion([this.itemSelection, this.highlightSelection], item);
        }
        if (label) {
            resetMotion([this.labelSelection, this.highlightLabelSelection], label);
        }
        this.itemSelection.cleanup();
        this.labelSelection.cleanup();
        this.highlightSelection.cleanup();
        this.highlightLabelSelection.cleanup();
    }

    protected animateEmptyUpdateReady(_data: PolarAnimationData) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation();
    }

    protected animateWaitingUpdateReady(_data: PolarAnimationData) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation();
    }

    protected animateReadyHighlight(_data: unknown) {
        const { item, label } = this.animationResetFns ?? {};
        if (item) {
            resetMotion([this.highlightSelection], item);
        }
        if (label) {
            resetMotion([this.highlightLabelSelection], label);
        }
    }

    protected animateReadyHighlightMarkers(_data: unknown) {
        // Override point for sub-classes.
    }

    protected animateReadyResize(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animateClearingUpdateEmpty(_data: PolarAnimationData) {
        this.ctx.animationManager.skipCurrentBatch();
        this.resetAllAnimation();
    }

    protected animationTransitionClear() {
        this.animationState.transition('clear', this.getAnimationData());
    }

    private getAnimationData(seriesRect?: BBox) {
        return { seriesRect };
    }

    protected override computeFocusBounds(opts: PickFocusInputs): BBox | Path | undefined {
        const datum = this.getNodeData()?.[opts.datumIndex];
        if (datum !== undefined) {
            return this.itemSelection.select((node): node is Path => node instanceof Path && node.datum === datum)[0];
        }
        return undefined;
    }
}
