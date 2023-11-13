import type { ModuleContext } from '../../../module/moduleContext';
import type { AnimationValue } from '../../../motion/animation';
import { resetMotion } from '../../../motion/resetMotion';
import { StateMachine } from '../../../motion/states';
import type { BBox } from '../../../scene/bbox';
import { Group } from '../../../scene/group';
import type { Node } from '../../../scene/node';
import { Selection } from '../../../scene/selection';
import { Text } from '../../../scene/shape/text';
import type { PointLabelDatum } from '../../../util/labelPlacement';
import { ChartAxisDirection } from '../../chartAxisDirection';
import { DataModelSeries } from '../dataModelSeries';
import { SeriesNodePickMode } from '../series';
import type { SeriesNodeDatum } from '../seriesTypes';

export type PolarAnimationState = 'empty' | 'ready' | 'waiting' | 'clearing';
export type PolarAnimationEvent = 'update' | 'updateData' | 'highlight' | 'highlightMarkers' | 'resize' | 'clear';
export type PolarAnimationData = { duration?: number };

export abstract class PolarSeries<TDatum extends SeriesNodeDatum, TNode extends Node> extends DataModelSeries<TDatum> {
    protected sectorGroup = this.contentGroup.appendChild(new Group());

    protected itemSelection: Selection<TNode, TDatum> = Selection.select(
        this.sectorGroup,
        () => this.nodeFactory(),
        false
    );
    protected labelSelection: Selection<Text, TDatum> = Selection.select(this.labelGroup, Text, false);
    protected highlightSelection: Selection<TNode, TDatum> = Selection.select(this.highlightGroup, () =>
        this.nodeFactory()
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
        pickModes = [SeriesNodePickMode.EXACT_SHAPE_MATCH],
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
            contentGroupVirtual: false,
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

        this.sectorGroup.zIndexSubOrder = [() => this._declarationOrder, 1];
        this.animationResetFns = animationResetFns;

        this.animationState = new StateMachine<PolarAnimationState, PolarAnimationEvent>(
            'empty',
            {
                empty: {
                    update: {
                        target: 'ready',
                        action: (data) => this.animateEmptyUpdateReady(data),
                    },
                },
                ready: {
                    updateData: 'waiting',
                    clear: 'clearing',
                    update: (data) => this.animateReadyUpdate(data),
                    highlight: (data) => this.animateReadyHighlight(data),
                    highlightMarkers: (data) => this.animateReadyHighlightMarkers(data),
                    resize: (data) => this.animateReadyResize(data),
                },
                waiting: {
                    update: {
                        target: 'ready',
                        action: (data) => this.animateWaitingUpdateReady(data),
                    },
                },
                clearing: {
                    update: {
                        target: 'empty',
                        action: (data) => this.animateClearingUpdateEmpty(data),
                    },
                },
            },
            () => this.checkProcessedDataAnimatable()
        );
    }

    protected abstract nodeFactory(): TNode;

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
            resetMotion([this.labelSelection], label);
        }
        this.itemSelection.cleanup();
        this.labelSelection.cleanup();
        this.highlightSelection.cleanup();
    }

    protected animateEmptyUpdateReady(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animateReadyUpdate(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animateWaitingUpdateReady(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animateReadyHighlight(_data: unknown) {
        const { item } = this.animationResetFns ?? {};
        if (item) {
            resetMotion([this.highlightSelection], item);
        }
    }

    protected animateReadyHighlightMarkers(_data: unknown) {
        // Override point for sub-classes.
    }

    protected animateReadyResize(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animateClearingUpdateEmpty(_data: PolarAnimationData) {
        this.resetAllAnimation();
    }

    protected animationTransitionClear() {
        this.animationState.transition('clear', this.getAnimationData());
    }

    private getAnimationData(seriesRect?: BBox) {
        return { seriesRect };
    }
}
