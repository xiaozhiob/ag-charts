import { _ModuleSupport } from 'ag-charts-community';

import { type AnnotationLineStyle, type AnnotationOptionsColorPickerType, AnnotationType } from './annotationTypes';
import { annotationConfigs, getTypedDatum } from './annotationsConfig';
import type {
    AnnotationProperties,
    AnnotationScene,
    AnnotationsStateMachineContext,
    AnnotationsStateMachineHelperFns,
} from './annotationsSuperTypes';
import type { LinearSettingsDialogTextChangeProps } from './settings-dialog/settingsDialog';
import type { AnnotationStateEvents } from './states/stateTypes';
import { guardCancelAndExit, guardSaveAndExit } from './states/textualStateUtils';
import { wrapText } from './text/util';
import { hasLineStyle, hasLineText } from './utils/has';
import { setColor, setLineStyle } from './utils/styles';
import { isChannelType, isEphemeralType, isTextType } from './utils/types';

const { ActionOnSet, ParallelStateMachine, StateMachine, StateMachineProperty, Debug } = _ModuleSupport;

enum States {
    Idle = 'idle',
    Dragging = 'dragging',
    TextInput = 'text-input',
}

/**
 * - AnnotationsStateMachine (runs children in parallel, distributes properties across children)
 *     - SnappingStateMachine (changes `snapping` property with shift key)
 *     - UpdateStateMachine (ensures the active `node` is set after renders)
 *     - AnnotationsMainStateMachine
 *         - Idle (most interactions, with child machine per annotation type for creating annotations)
 *         - Dragging (entered on `dragStart`, dragging interactions with child machine per annotation type)
 *         - TextInput (entered on `click` of active text node, text input interactions)
 */
export class AnnotationsStateMachine extends ParallelStateMachine<States, AnnotationStateEvents> {
    // TODO: remove this leak
    private active?: number;

    @StateMachineProperty()
    protected snapping: boolean = false;

    @StateMachineProperty()
    protected datum?: AnnotationProperties;

    @StateMachineProperty()
    protected node?: AnnotationScene;

    constructor(ctx: AnnotationsStateMachineContext) {
        super(
            new SnappingStateMachine((snapping) => {
                this.snapping = snapping;
            }),
            new UpdateMachine(() => {
                this.node = this.active == null ? undefined : ctx.node(this.active);
            }),
            new AnnotationsMainStateMachine(ctx, (index) => {
                this.active = index;
                this.datum = this.active == null ? undefined : ctx.datum(this.active);
                this.node = this.active == null ? undefined : ctx.node(this.active);
            })
        );
    }

    // TODO: remove this leak
    public getActive() {
        return this.active;
    }

    // TODO: remove this leak
    public isActive(index: number) {
        return index === this.active;
    }
}

class SnappingStateMachine extends StateMachine<States, AnnotationStateEvents> {
    constructor(setSnapping: (snapping: boolean) => void) {
        super(States.Idle, {
            [States.Idle]: {
                hover: ({ shiftKey }) => setSnapping(shiftKey),
                keyDown: ({ shiftKey }) => setSnapping(shiftKey),
                keyUp: ({ shiftKey }) => setSnapping(shiftKey),
                click: ({ shiftKey }) => setSnapping(shiftKey),
                drag: ({ shiftKey }) => setSnapping(shiftKey),
            },
            [States.Dragging]: {},
            [States.TextInput]: {},
        });
    }
}

class UpdateMachine extends StateMachine<States, AnnotationStateEvents> {
    constructor(update: () => void) {
        super(States.Idle, {
            [States.Idle]: {
                onEnter: update,
                render: update,
            },
            [States.Dragging]: {
                onEnter: update,
                render: update,
            },
            [States.TextInput]: {
                render: update,
            },
        });
    }
}

class AnnotationsMainStateMachine extends StateMachine<States, AnnotationStateEvents> {
    override debug = Debug.create(true, 'annotations');

    @ActionOnSet<AnnotationsMainStateMachine>({
        changeValue(newValue?: number) {
            this.setActive(newValue);
        },
    })
    @StateMachineProperty()
    protected active?: number;

    @StateMachineProperty()
    protected hovered?: number;

    @StateMachineProperty()
    protected hoverCoords?: _ModuleSupport.Vec2;

    @StateMachineProperty()
    protected copied?: AnnotationProperties;

    @StateMachineProperty()
    protected snapping: boolean = false;

    @StateMachineProperty()
    protected datum?: AnnotationProperties;

    @StateMachineProperty()
    protected node?: AnnotationScene;

    constructor(
        ctx: AnnotationsStateMachineContext,
        private readonly setActive: (index?: number) => void
    ) {
        const createDatum =
            <T extends AnnotationProperties>(type: AnnotationType) =>
            (datum: T) => {
                ctx.create(type, datum);
                this.active = ctx.selectLast();
            };

        const deleteDatum = () => {
            if (this.active != null) ctx.delete(this.active);
            this.active = undefined;
            ctx.select();
        };

        const stateMachineHelpers: AnnotationsStateMachineHelperFns = {
            createDatum,
        };

        const createStateMachineContext = {
            ...ctx,
            delete: deleteDatum,
            showTextInput: () => {
                if (this.active != null) ctx.showTextInput(this.active);
            },
            deselect: () => {
                const prevActive = this.active;
                this.active = undefined;
                this.hovered = undefined;
                ctx.select(this.active, prevActive);
            },
            showAnnotationOptions: () => {
                if (this.active != null) ctx.showAnnotationOptions(this.active);
            },
        };
        const createStateMachines = Object.fromEntries(
            Object.entries(annotationConfigs).map(([type, config]) => [
                type,
                config.createState(createStateMachineContext, stateMachineHelpers),
            ])
        ) as Record<AnnotationType, _ModuleSupport.StateMachine<any, any>>;

        const dragStateMachines = Object.fromEntries(
            Object.entries(annotationConfigs).map(([type, config]) => [
                type,
                config.dragState(ctx, stateMachineHelpers),
            ])
        ) as Record<Partial<AnnotationType>, _ModuleSupport.StateMachine<any, any>>;

        const actionColor = ({
            colorPickerType,
            colorOpacity,
            color,
            opacity,
        }: {
            colorPickerType: AnnotationOptionsColorPickerType;
            colorOpacity: string;
            color: string;
            opacity: number;
        }) => {
            if (!this.datum) return;

            if (colorPickerType === 'text-color') {
                ctx.updateTextInputColor(color);
            }
            setColor(this.datum, colorPickerType, colorOpacity, color, opacity);
            ctx.update();
        };

        const actionFontSize = (fontSize: number) => {
            const { datum, node } = this;
            if (!datum || !node) return;

            if (isTextType(datum)) {
                datum.fontSize = fontSize;
                ctx.updateTextInputFontSize(fontSize);
            } else if (hasLineText(datum)) {
                datum.text.fontSize = fontSize;
            }

            ctx.update();
        };

        const actionLineStyle = (lineStyle: AnnotationLineStyle) => {
            const { datum, node } = this;
            if (!datum || !node || !hasLineStyle(datum)) return;

            setLineStyle(datum, lineStyle);
            ctx.update();
        };

        const actionUpdateTextInputBBox = (bbox?: _ModuleSupport.BBox) => {
            const { node } = this;
            if (!node || !('setTextInputBBox' in node)) return;
            node.setTextInputBBox(bbox);
            ctx.update();
        };

        const actionSaveText = ({ textInputValue, bbox }: { textInputValue?: string; bbox?: _ModuleSupport.BBox }) => {
            const { datum } = this;
            if (bbox != null && textInputValue != null && textInputValue.length > 0) {
                if (!isTextType(datum)) {
                    return;
                }

                const wrappedText = wrapText(datum, textInputValue, bbox.width);
                datum.set({ text: wrappedText });

                ctx.update();
                ctx.recordAction(`Change ${datum.type} annotation text`);
            } else {
                ctx.delete(this.active!);
                ctx.recordAction(`Delete ${datum?.type} annotation`);
            }
        };

        const actionCancel = () => {
            ctx.updateTextInputBBox(undefined);
        };

        const guardActive = () => this.active != null;
        const guardCopied = () => this.copied != null;
        const guardActiveHasLineText = () => {
            const { active, datum } = this;
            if (active == null) return false;
            if (!datum) return false;
            return hasLineText(datum) && !datum.locked;
        };
        const guardActiveNotEphemeral = () => this.active != null && !isEphemeralType(this.datum);
        const guardHovered = () => this.hovered != null;

        super(States.Idle, {
            [States.Idle]: {
                onEnter: () => {
                    ctx.select(this.active, this.active);

                    if (this.hoverCoords) {
                        this.hovered = ctx.hoverAtCoords(this.hoverCoords, this.active);
                    }
                },

                hover: ({ offset }) => {
                    this.hovered = ctx.hoverAtCoords(offset, this.active);
                    this.hoverCoords = offset;
                },

                translate: {
                    guard: guardActive,
                    action: ({ translation }) => {
                        ctx.startInteracting();
                        ctx.translate(this.active!, translation);
                        ctx.update();
                    },
                },

                translateEnd: {
                    guard: guardActive,
                    action: () => {
                        ctx.stopInteracting();
                    },
                },

                copy: {
                    guard: guardActiveNotEphemeral,
                    action: () => {
                        this.copied = ctx.copy(this.active!);
                    },
                },

                cut: {
                    guard: guardActiveNotEphemeral,
                    action: () => {
                        this.copied = ctx.copy(this.active!);
                        deleteDatum();
                    },
                },

                paste: {
                    guard: guardCopied,
                    action: () => {
                        ctx.paste(this.copied!);
                    },
                },

                selectLast: () => {
                    const previousActive = this.active;
                    this.active = ctx.selectLast();
                    ctx.select(this.active, previousActive);
                },

                click: [
                    {
                        guard: () => {
                            const { active, hovered, datum } = this;
                            if (active == null || hovered !== active) return false;
                            if (!datum) return false;
                            return isTextType(datum) && !datum.locked;
                        },
                        target: States.TextInput,
                    },
                    {
                        action: () => {
                            const prevActive = this.active;
                            this.active = this.hovered;
                            ctx.select(this.active, prevActive);
                        },
                    },
                ],

                dblclick: {
                    guard: guardActiveHasLineText,
                    action: ({ offset }) => {
                        const nodeAtCoords = ctx.getNodeAtCoords(offset, this.active!) === 'text' ? 'text' : 'line';
                        ctx.showAnnotationSettings(this.active!, undefined, nodeAtCoords);
                    },
                },

                dragStart: [
                    {
                        guard: guardHovered,
                        target: States.Dragging,
                        action: () => {
                            const prevActive = this.active;
                            this.active = this.hovered;
                            ctx.select(this.active, prevActive);
                            ctx.startInteracting();
                        },
                    },
                    {
                        action: () => {
                            const prevActive = this.active;
                            this.active = this.hovered;
                            ctx.select(this.active, prevActive);
                        },
                    },
                ],

                color: {
                    guard: guardActive,
                    action: actionColor,
                },

                fontSize: {
                    guard: guardActive,
                    action: actionFontSize,
                },

                lineProps: {
                    guard: guardActive,
                    action: (props) => {
                        const datum = getTypedDatum(this.datum);
                        datum?.set(props);
                        ctx.update();
                        ctx.recordAction(
                            `Change ${datum?.type} ${Object.entries(props)
                                .map(([key, value]) => `${key} to ${value}`)
                                .join(', ')}`
                        );
                    },
                },

                lineStyle: {
                    guard: guardActive,
                    action: actionLineStyle,
                },

                lineText: {
                    guard: guardActive,
                    action: (props: LinearSettingsDialogTextChangeProps) => {
                        const datum = getTypedDatum(this.datum);
                        if (!hasLineText(datum)) return;
                        if (isChannelType(datum) && props.position === 'center') {
                            props.position = 'inside';
                        }
                        datum.text.set(props);
                        ctx.update();
                    },
                },

                updateTextInputBBox: {
                    guard: guardActive,
                    action: actionUpdateTextInputBBox,
                },

                toolbarPressSettings: {
                    guard: guardActiveHasLineText,
                    action: (sourceEvent: Event) => {
                        ctx.showAnnotationSettings(this.active!, sourceEvent);
                    },
                },

                reset: () => {
                    if (this.active != null) {
                        this.node?.toggleActive(false);
                    }

                    this.hovered = undefined;
                    this.active = undefined;

                    ctx.select(this.active, this.active);

                    ctx.resetToIdle();
                },

                delete: () => {
                    if (this.active == null) return;
                    ctx.delete(this.active);
                    if (isEphemeralType(this.datum)) return;
                    ctx.recordAction(`Delete ${this.datum?.type} annotation`);
                },

                deleteAll: () => {
                    ctx.deleteAll();
                },

                ...createStateMachines,
            },

            [States.Dragging]: {
                onEnter: (_, data: any) => {
                    if (this.active == null) return;

                    const type = ctx.getAnnotationType(this.active);
                    if (!type) return;

                    this.transitionRoot(type);
                    this.transitionRoot('dragStart', data);
                },

                ...dragStateMachines,
            },

            [States.TextInput]: {
                onEnter: () => {
                    if (this.active == null) return;

                    const datum = getTypedDatum(this.datum);
                    if (!datum || !('getTextInputCoords' in datum)) return;

                    ctx.startInteracting();
                    ctx.showTextInput(this.active);
                    datum.visible = false;

                    ctx.update();
                },

                updateTextInputBBox: {
                    guard: guardActive,
                    action: actionUpdateTextInputBBox,
                },

                resize: {
                    target: States.Idle,
                    action: actionSaveText,
                },

                click: {
                    target: States.Idle,
                    action: actionSaveText,
                },

                drag: {
                    target: States.Idle,
                    action: actionSaveText,
                },

                textInput: [
                    {
                        guard: guardCancelAndExit,
                        target: States.Idle,
                        action: actionCancel,
                    },
                    {
                        guard: guardSaveAndExit,
                        target: States.Idle,
                        action: actionSaveText,
                    },
                ],

                color: {
                    guard: guardActive,
                    action: actionColor,
                },

                fontSize: {
                    guard: guardActive,
                    action: actionFontSize,
                },

                cancel: {
                    target: States.Idle,
                    action: actionCancel,
                },

                onExit: () => {
                    ctx.stopInteracting();
                    ctx.hideTextInput();

                    const wasActive = this.active;
                    this.active = this.hovered = undefined;
                    ctx.select(this.active, wasActive);

                    if (wasActive == null) return;

                    const datum = ctx.datum(wasActive);
                    const node = ctx.node(wasActive);
                    if (!datum || !node) return;

                    datum.visible = true;
                },
            },
        });
    }
}
