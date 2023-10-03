import type { ProcessedOutputDiff } from '../chart/data/processors';
import type { AnimationManager } from '../chart/interaction/animationManager';
import type { Node } from '../scene/node';
import type { Selection } from '../scene/selection';
import { zipObject } from '../util/zip';
import type { AdditionalAnimationOptions, AnimationOptions, AnimationValue } from './animation';
import * as easing from './easing';

export type NodeUpdateState = 'added' | 'removed' | 'updated' | 'moved';

/**
 * Implements a per-node "to/from" animation, with support for detection of added/moved/removed
 * nodes.
 *
 * @param id prefix for all animation ids generated by this call
 * @param animationManager used to schedule generated animations
 * @param selections contains nodes to be animated
 * @param fromFn callback to determine per-node starting properties
 * @param toFn callback to determine per-node final properties
 * @param extraOpts optional additional animation properties to pass to AnimationManager#animate.
 * @param getDatumId optional per-datum 'id' generation function for diff calculation - must be
 *                   specified iff diff is specified
 * @param diff optional diff from a DataModel to use to detect added/moved/removed cases
 */
export function fromToMotion<N extends Node, T extends AnimationValue & Partial<N>, D>(
    id: string,
    animationManager: AnimationManager,
    selections: Selection<N, D>[],
    fromFn: (node: N, datum: D, state: NodeUpdateState) => T,
    toFn: (node: N, datum: D, state: NodeUpdateState) => T,
    extraOpts: Partial<AnimationOptions<T> & AdditionalAnimationOptions> = {},
    getDatumId?: (node: N, datum: D) => string,
    diff?: ProcessedOutputDiff
) {
    // Dynamic case with varying add/update/remove behavior.
    const ids = { added: {}, removed: {} };
    if (getDatumId && diff) {
        ids.added = zipObject(diff.added, true);
        ids.removed = zipObject(diff.removed, true);
    }

    let selectionIndex = 0;
    for (const selection of selections) {
        let cleanup = false;

        for (const node of selection.nodes()) {
            let status: NodeUpdateState = 'added';
            if (getDatumId && diff) {
                status = calculateStatus(node, node.datum, getDatumId, ids);
            }

            cleanup ||= status === 'removed';

            const from = fromFn(node, node.datum, status);
            const to = toFn(node, node.datum, status);

            animationManager.animate({
                id: `${id}_${node.id}`,
                from: from,
                to: to,
                ease: easing.easeOut,
                onUpdate(props) {
                    node.setProperties(props);
                },
                onStop() {
                    node.setProperties(to);
                },
                ...extraOpts,
            });
        }

        // Only perform selection cleanup once.
        if (cleanup) {
            animationManager.animate({
                id: `${id}_selection_${selectionIndex}`,
                from: 0 as T,
                to: 1 as T,
                ease: easing.easeOut,
                onComplete() {
                    selection.cleanup();
                },
                ...extraOpts,
            });
        }
        selectionIndex++;
    }
}

/**
 * Implements a batch "to/from" animation.
 *
 * @param id prefix for all animation ids generated by this call
 * @param animationManager used to schedule generated animations
 * @param selections contains nodes to be animated
 * @param from node starting properties
 * @param to node final properties
 * @param extraOpts optional additional animation properties to pass to AnimationManager#animate.
 */
export function staticFromToMotion<N extends Node, T extends AnimationValue & Partial<N>, D>(
    id: string,
    animationManager: AnimationManager,
    selections: Selection<N, D>[],
    from: T,
    to: T,
    extraOpts: Partial<AnimationOptions<T> & AdditionalAnimationOptions> = {}
) {
    // Simple static to/from case, we can batch updates.
    animationManager.animate({
        id: `${id}_batch`,
        from,
        to,
        ease: easing.easeOut,
        onUpdate(props) {
            for (const selection of selections) {
                for (const node of selection.nodes()) {
                    node.setProperties(props);
                }
            }
        },
        onStop() {
            for (const selection of selections) {
                for (const node of selection.nodes()) {
                    node.setProperties(to);
                }
            }
        },
        ...extraOpts,
    });
}

function calculateStatus<N extends Node, D>(
    node: N,
    datum: D,
    getDatumId: (node: N, datum: D) => string,
    ids: {
        added: Record<string, true>;
        removed: Record<string, true>;
    }
): NodeUpdateState {
    const id = getDatumId(node, datum);

    if (ids.added[id]) {
        return 'added';
    } else if (ids.removed[id]) {
        return 'removed';
    }

    return 'updated';
}
