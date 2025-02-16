import { Debug } from './debug';
import { addObserverToInstanceProperty, extractDecoratedProperties, listDecoratedProperties } from './decorator';

type StateDefinition<State extends string, Events extends Record<string, any>> = {
    [key in keyof Events]?: Destination<State, Events[key]>;
};
type Destination<State extends string, Data> =
    | Array<StateTransition<State, Data>>
    | StateTransition<State, Data>
    | StateTransitionAction<Data>
    | State
    | HierarchyState
    | StateMachine<any, any>;
type StateUtils<State extends string> = {
    onEnter?: (from?: State, data?: any) => void;
    onExit?: () => void;
};
type StateTransition<State, Data> = {
    /**
     * Return `false` to prevent the action and transition. The FSM will pick the first transition that passes its
     * guard or does not have one.
     */
    guard?: (data: Data) => boolean;
    target?: State | HierarchyState | StateMachine<any, any>;
    action?: StateTransitionAction<Data>;
};
type StateTransitionAction<Data> = (data: Data) => void;
type HierarchyState = '__parent' | '__child';

const debugColor = 'color: green';
const debugQuietColor = 'color: grey';

export function StateMachineProperty() {
    return addObserverToInstanceProperty(() => {
        // do nothing
    });
}

function applyProperties(parentState: AbstractStateMachine<any>, childState: StateMachine<any, any>) {
    const childProperties = listDecoratedProperties(childState);
    if (childProperties.length === 0) return;

    const properties = extractDecoratedProperties(parentState);
    for (const property of childProperties) {
        if (property in properties) {
            (childState as any)[property] = properties[property];
        }
    }
}

abstract class AbstractStateMachine<Events extends Record<string, any>> {
    public parent?: AbstractStateMachine<Events>;

    abstract transition<Event extends keyof Events & string>(event: Event, data?: Events[Event]): void;
    abstract transitionAsync<Event extends keyof Events & string>(event: Event, data?: Events[Event]): void;

    transitionRoot<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        if (this.parent) {
            this.parent.transitionRoot(event, data);
        } else {
            this.transition(event, data);
        }
    }
}

/**
 * A Hierarchical Finite State Machine is a system that must be in exactly one of a list of states, where those states
 * can also be other state machines. It can only transition between one state and another if a transition event is
 * provided between the two states.
 */
export class StateMachine<
    State extends string,
    Events extends Record<string, any>,
> extends AbstractStateMachine<Events> {
    static readonly child = '__child' as const;
    static readonly parent = '__parent' as const;

    protected readonly debug = Debug.create(true, 'animation');
    private state: State | HierarchyState;
    private childState?: StateMachine<any, Events>;

    constructor(
        private readonly defaultState: State,
        private readonly states: Record<State, StateDefinition<State, Events> & StateUtils<State>>,
        private readonly enterEach?: (from: State | HierarchyState, to: State | HierarchyState) => void
    ) {
        super();
        this.state = defaultState;

        this.debug(`%c${this.constructor.name} | init -> ${defaultState}`, debugColor);
    }

    // TODO: handle events which do not require data without requiring `undefined` to be passed as as parameter, while
    // also still requiring data to be passed to those events which do require it.
    transition<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        const shouldTransitionSelf = this.transitionChild(event, data);

        if (!shouldTransitionSelf || this.state === StateMachine.child || this.state === StateMachine.parent) {
            return;
        }

        const currentState = this.state;
        const currentStateConfig = this.states[this.state];
        let destination: Destination<State, Events[Event]> | undefined = currentStateConfig[event];

        const debugPrefix = `%c${this.constructor.name} | ${this.state} -> ${event} ->`;

        if (Array.isArray(destination)) {
            destination = destination.find((transition) => {
                if (!transition.guard) return true;
                const valid = transition.guard(data as Events[Event]);
                if (!valid) {
                    this.debug(`${debugPrefix} (guarded)`, transition.target, debugQuietColor);
                }
                return valid;
            });
        } else if (
            typeof destination === 'object' &&
            !(destination instanceof StateMachine) &&
            destination.guard &&
            !destination.guard(data as Events[Event])
        ) {
            this.debug(`${debugPrefix} (guarded)`, destination.target, debugQuietColor);
            return;
        }

        if (!destination) {
            this.debug(`${debugPrefix} ${this.state}`, debugQuietColor);
            return;
        }

        const destinationState = this.getDestinationState(destination);
        const exitFn = destinationState === this.state ? undefined : currentStateConfig.onExit;

        this.debug(`${debugPrefix} ${destinationState}`, debugColor);

        // Change the state before calling the transition action to allow the action to trigger a subsequent transition
        this.state = destinationState;

        if (typeof destination === 'function') {
            destination(data as Events[Event]);
        } else if (typeof destination === 'object' && !(destination instanceof StateMachine)) {
            destination.action?.(data as Events[Event]);
        }

        exitFn?.();

        this.enterEach?.(currentState, destinationState);
        if (
            destinationState !== currentState &&
            destinationState !== StateMachine.child &&
            destinationState !== StateMachine.parent
        ) {
            this.states[destinationState].onEnter?.(currentState, data);
        }
    }

    transitionAsync<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        // TODO: consider merging this with transition
        setTimeout(() => {
            this.transition(event, data);
        }, 0);
    }

    protected is(value: unknown): boolean {
        if (this.state === StateMachine.child && this.childState) {
            return this.childState.is(value);
        }
        return this.state === value;
    }

    protected resetHierarchy() {
        this.debug(
            `%c${this.constructor.name} | ${this.state} -> [resetHierarchy] -> ${this.defaultState}`,
            'color: green'
        );
        this.state = this.defaultState;
    }

    private transitionChild<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        if (this.state !== StateMachine.child || !this.childState) return true;

        applyProperties(this, this.childState);
        this.childState.transition(event, data);

        if (!this.childState.is(StateMachine.parent)) return true;

        this.debug(`%c${this.constructor.name} | ${this.state} -> ${event} -> ${this.defaultState}`, debugColor);
        this.state = this.defaultState;
        this.states[this.state].onEnter?.();
        this.childState.resetHierarchy();

        return false;
    }

    private getDestinationState<Data>(
        destination:
            | StateTransition<State, Data>
            | StateTransitionAction<Data>
            | State
            | HierarchyState
            | StateMachine<any, any>
    ) {
        let state: State | HierarchyState = this.state;

        if (typeof destination === 'string') {
            state = destination as State;
        } else if (destination instanceof StateMachine) {
            this.childState = destination;
            this.childState.parent = this;
            state = StateMachine.child;
        } else if (typeof destination === 'object') {
            if (destination.target instanceof StateMachine) {
                this.childState = destination.target;
                this.childState.parent = this;
                state = StateMachine.child;
            } else if (destination.target != null) {
                state = destination.target;
            }
        }

        return state;
    }
}

export class ParallelStateMachine<
    State extends string,
    Events extends Record<string, any>,
> extends AbstractStateMachine<Events> {
    private readonly stateMachines: Array<StateMachine<State, Events>>;

    constructor(...stateMachines: Array<StateMachine<State, Events>>) {
        super();
        this.stateMachines = stateMachines;

        for (const stateMachine of stateMachines) {
            stateMachine.parent = this;
        }
    }

    transition<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        for (const stateMachine of this.stateMachines) {
            applyProperties(this, stateMachine);
            stateMachine.transition(event, data);
        }
    }

    transitionAsync<Event extends keyof Events & string>(event: Event, data?: Events[Event]) {
        for (const stateMachine of this.stateMachines) {
            applyProperties(this, stateMachine);
            stateMachine.transitionAsync(event, data);
        }
    }
}
