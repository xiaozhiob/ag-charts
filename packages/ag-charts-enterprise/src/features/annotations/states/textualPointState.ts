import { _ModuleSupport } from 'ag-charts-community';

import type { AnnotationOptionsColorPickerType, Point } from '../annotationTypes';
import type { AnnotationsCreateStateMachineContext } from '../annotationsSuperTypes';
import type { TextualPointProperties } from '../properties/textualPointProperties';
import type { TextualPointScene } from '../scenes/textualPointScene';
import { wrapText } from '../text/util';
import { setColor } from '../utils/styles';
import { isTextType } from '../utils/types';
import type { AnnotationStateEvents } from './stateTypes';
import { guardCancelAndExit, guardSaveAndExit } from './textualStateUtils';

const { StateMachine, StateMachineProperty, Debug } = _ModuleSupport;

interface TextualPointStateMachineContext<Datum extends TextualPointProperties>
    extends Omit<AnnotationsCreateStateMachineContext, 'create'> {
    create: (datum: Datum) => void;
}

export abstract class TextualPointStateMachine<
    Datum extends TextualPointProperties,
    Node extends TextualPointScene<Datum>,
> extends StateMachine<
    'start' | 'waiting-first-render' | 'edit',
    Pick<
        AnnotationStateEvents,
        | 'click'
        | 'dragStart'
        | 'resize'
        | 'cancel'
        | 'keyDown'
        | 'textInput'
        | 'updateTextInputBBox'
        | 'color'
        | 'fontSize'
        | 'render'
        | 'reset'
    >
> {
    override debug = Debug.create(true, 'annotations');

    @StateMachineProperty()
    protected datum?: Datum;

    @StateMachineProperty()
    protected node?: Node;

    constructor(ctx: TextualPointStateMachineContext<Datum>) {
        const actionCreate = ({ point }: { point: Point }) => {
            const datum = this.createDatum();
            datum.set({ x: point.x, y: point.y });
            ctx.create(datum);
        };

        const actionFirstRender = () => {
            this.node?.toggleActive(true);
            ctx.showAnnotationOptions();
            ctx.update();
        };

        const onStartEditing = () => {
            ctx.showTextInput();
            if (this.datum) {
                this.datum.visible = false;
            }
        };

        const onStopEditing = () => {
            ctx.hideTextInput();
            if (this.datum) this.datum.visible = true;
            ctx.deselect();
        };

        const actionUpdateTextInputBBox = (bbox?: _ModuleSupport.BBox) => {
            this.node?.setTextInputBBox(bbox);
            ctx.update();
        };

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
            setColor(this.datum as any, colorPickerType, colorOpacity, color, opacity);
            ctx.update();
        };

        const actionFontSize = (fontSize: number) => {
            const { datum, node } = this;
            if (!datum || !node || !isTextType(datum)) return;

            datum.fontSize = fontSize;
            ctx.updateTextInputFontSize(fontSize);
            ctx.update();
        };

        const actionCancel = () => {
            ctx.delete();
        };

        const actionSave = ({ textInputValue, bbox }: { textInputValue?: string; bbox?: _ModuleSupport.BBox }) => {
            if (bbox != null && textInputValue != null && textInputValue.length > 0) {
                const { datum } = this;

                if (!isTextType(datum)) {
                    return;
                }

                const wrappedText = wrapText(datum, textInputValue, bbox.width);
                datum?.set({ text: wrappedText });

                ctx.update();
                ctx.recordAction(`Create ${datum?.type} annotation`);
            } else {
                ctx.delete();
            }
        };

        super('start', {
            start: {
                click: {
                    target: 'waiting-first-render',
                    action: actionCreate,
                },
                dragStart: {
                    target: 'waiting-first-render',
                    action: actionCreate,
                },
                cancel: StateMachine.parent,
                reset: StateMachine.parent,
            },
            'waiting-first-render': {
                render: {
                    target: 'edit',
                    action: actionFirstRender,
                },
            },
            edit: {
                onEnter: onStartEditing,
                updateTextInputBBox: actionUpdateTextInputBBox,
                color: actionColor,
                fontSize: actionFontSize,
                textInput: [
                    {
                        guard: guardCancelAndExit,
                        target: StateMachine.parent,
                        action: actionCancel,
                    },
                    {
                        guard: guardSaveAndExit,
                        target: StateMachine.parent,
                        action: actionSave,
                    },
                ],
                click: {
                    target: StateMachine.parent,
                    action: actionSave,
                },
                dragStart: {
                    target: StateMachine.parent,
                    action: actionSave,
                },
                resize: {
                    target: StateMachine.parent,
                    action: actionSave,
                },
                onExit: onStopEditing,
                cancel: {
                    target: StateMachine.parent,
                    action: actionCancel,
                },
            },
        });
    }

    protected abstract createDatum(): Datum;
}
