import type { Direction } from 'ag-charts-types';

import type { LocaleManager } from '../locale/localeManager';
import { type BaseStyleTypeMap, setAttribute, setElementStyle } from '../util/attributeUtil';
import { createElement, getWindow } from '../util/dom';
import { BoundedTextWidget } from '../widget/boundedTextWidget';
import { ButtonWidget } from '../widget/buttonWidget';
import { GroupWidget } from '../widget/groupWidget';
import { ListWidget } from '../widget/listWidget';
import { NativeWidget } from '../widget/nativeWidget';
import { SliderWidget } from '../widget/sliderWidget';
import { SwitchWidget } from '../widget/switchWidget';
import { ToolbarWidget } from '../widget/toolbarWidget';
import type { Widget } from '../widget/widget';
import type { DOMManager } from './domManager';

type IWidget = { getElement(): HTMLElement };

type ParentProperties<T = NativeWidget<HTMLDivElement>> =
    | { readonly parent: T }
    | { readonly domManagerId: string; readonly where: 'beforebegin' | 'afterend' };

type ElemParams<T extends ProxyElementType> = {
    readonly type: T;
    readonly id?: string;
    readonly cursor?: BaseStyleTypeMap['cursor'];
};

type InteractParams<T extends ProxyElementType> = ElemParams<T> & {
    readonly tabIndex?: number;
    readonly onclick?: (ev: MouseEvent) => void;
    readonly ondblclick?: (ev: MouseEvent) => void;
    readonly onmouseenter?: (ev: MouseEvent) => void;
    readonly onmouseleave?: (ev: MouseEvent) => void;
    readonly oncontextmenu?: (ev: MouseEvent) => void;
    readonly onchange?: (ev: Event) => void;
    readonly onfocus?: (ev: FocusEvent) => void;
    readonly onblur?: (ev: FocusEvent) => void;
};

type TranslationKey = { id: string; params?: Record<string, any> };

type ContainerParams<T extends ProxyContainerType> = {
    readonly type: T;
    readonly domManagerId: string;
    readonly classList: string[];
    readonly ariaLabel: TranslationKey;
};

type ProxyMeta = {
    // Elements
    button: {
        params: ParentProperties<GroupWidget> &
            InteractParams<'button'> & {
                readonly textContent: string | TranslationKey;
            };
        result: ButtonWidget;
    };
    slider: {
        params: ParentProperties<ToolbarWidget> &
            InteractParams<'slider'> & {
                readonly ariaLabel: TranslationKey;
                readonly ariaOrientation: Direction;
            };
        result: SliderWidget;
    };
    text: {
        params: ParentProperties & ElemParams<'text'>;
        result: BoundedTextWidget;
    };
    listswitch: {
        params: ParentProperties<ListWidget> &
            InteractParams<'listswitch'> & {
                readonly textContent: string;
                readonly ariaChecked: boolean;
                readonly ariaDescribedBy: string;
            };
        result: SwitchWidget;
    };
    region: {
        params: ParentProperties & ElemParams<'region'>;
        result: NativeWidget<HTMLDivElement>;
    };

    // Containers
    toolbar: {
        params: ContainerParams<'toolbar'> & { readonly orientation: Direction };
        result: ToolbarWidget;
    };
    group: {
        params: ContainerParams<'group'> & { readonly ariaOrientation: Direction };
        result: GroupWidget;
    };
    list: {
        params: ContainerParams<'list'>;
        result: ListWidget;
    };
};

type ProxyElementType = 'button' | 'slider' | 'text' | 'listswitch' | 'region';
type ProxyContainerType = 'toolbar' | 'group' | 'list';

export type ProxyDragHandlerEvent = {
    offsetX: number;
    offsetY: number;
    // `originDelta` is the offset relative to position of the HTML element when the drag initiated.
    // This is helpful for elements that move during drag actions, like navigator sliders.
    originDeltaX: number;
    originDeltaY: number;
};
type ProxyDragHandler = (event: ProxyDragHandlerEvent) => void;

function checkType<T extends keyof ProxyMeta>(type: T, meta: ProxyMeta[keyof ProxyMeta]): meta is ProxyMeta[T] {
    return meta.params?.type === type;
}

function allocateResult<T extends keyof ProxyMeta>(type: T): ProxyMeta[T]['result'] {
    if ('button' === type) {
        return new ButtonWidget();
    } else if ('slider' === type) {
        return new SliderWidget();
    } else if ('toolbar' === type) {
        return new ToolbarWidget();
    } else if ('group' === type) {
        return new GroupWidget();
    } else if ('list' === type) {
        return new ListWidget();
    } else if ('region' === type) {
        return new NativeWidget<HTMLDivElement>(createElement('div'));
    } else if ('text' === type) {
        return new BoundedTextWidget();
    } else if ('listswitch' === type) {
        return new SwitchWidget();
    } else {
        throw Error('AG Charts - error allocating meta');
    }
}

function allocateMeta<T extends keyof ProxyMeta>(params: ProxyMeta[T]['params']): ProxyMeta[T] {
    const meta = { params, result: undefined } as unknown as ProxyMeta[T];
    meta.result = allocateResult(meta.params.type);
    return meta;
}

export class ProxyInteractionService {
    private readonly destroyFns: Array<() => void> = [];

    private dragState?: {
        target: HTMLElement;
        start: {
            offsetX: number;
            offsetY: number;
            pageX: number;
            pageY: number;
        };
    };

    constructor(
        private readonly localeManager: LocaleManager,
        private readonly domManager: DOMManager
    ) {}

    destroy() {
        this.destroyFns.forEach((fn) => fn());
    }

    private addLocalisation(fn: () => void) {
        fn();
        // FIXME(olegat) The result of `addListener` must be freed when the HTMLElement goes out of scope.
        this.destroyFns.push(this.localeManager.addListener('locale-changed', fn));
    }

    createProxyContainer<T extends ProxyContainerType>(
        args: { type: T } & ProxyMeta[T]['params']
    ): ProxyMeta[T]['result'] {
        const meta: ProxyMeta[T] = allocateMeta(args);
        const { params, result } = meta;
        const div = result.getElement();

        this.domManager.addChild('canvas-proxy', params.domManagerId, div);
        div.classList.add(...params.classList, 'ag-charts-proxy-container');
        div.role = params.type;
        if ('ariaOrientation' in params) {
            div.ariaOrientation = params.ariaOrientation;
        }

        if (checkType('toolbar', meta)) {
            meta.result.orientation = meta.params.orientation;
        }

        this.addLocalisation(() => {
            div.ariaLabel = this.localeManager.t(params.ariaLabel.id, params.ariaLabel.params);
        });

        return result;
    }

    createProxyElement<T extends ProxyElementType>(args: { type: T } & ProxyMeta[T]['params']): ProxyMeta[T]['result'] {
        const meta: ProxyMeta[T] = allocateMeta(args);

        if (checkType('button', meta)) {
            const { params, result } = meta;
            const button = result.getElement();
            this.initInteract(params, result);

            if (typeof params.textContent === 'string') {
                button.textContent = params.textContent;
            } else {
                const { textContent } = params;
                this.addLocalisation(() => {
                    button.textContent = this.localeManager.t(textContent.id, textContent.params);
                });
            }
            this.setParent(meta.params, meta.result);
        }

        if (checkType('slider', meta)) {
            const { params, result } = meta;
            const slider = result.getElement();
            this.initInteract(params, result);
            slider.type = 'range';
            slider.role = 'presentation';
            slider.style.margin = '0px';
            slider.ariaOrientation = params.ariaOrientation;

            this.addLocalisation(() => {
                slider.ariaLabel = this.localeManager.t(params.ariaLabel.id, params.ariaLabel.params);
            });
            this.setParent(meta.params, meta.result);
        }

        if (checkType('text', meta)) {
            const { params, result } = meta;
            this.initElement(params, result);
        }

        if (checkType('listswitch', meta)) {
            const { params, result: button } = meta;
            this.initInteract(params, button);
            button.setTextContent(params.textContent);
            button.setChecked(params.ariaChecked);
            button.setAriaDescribedBy(params.ariaDescribedBy);
            this.setParent(meta.params, meta.result);
        }

        if (checkType('region', meta)) {
            const { params, result } = meta;
            const region = result.getElement();
            this.initInteract(params, result);
            region.role = 'region';
            this.setParent(meta.params, meta.result);
        }

        return meta.result;
    }

    createDragListeners(args: {
        element: HTMLElement;
        onDragStart?: ProxyDragHandler;
        onDrag?: ProxyDragHandler;
        onDragEnd?: ProxyDragHandler;
    }): () => void {
        const { element, onDragStart, onDrag, onDragEnd } = args;

        const mousedown = (sourceEvent: MouseEvent) => {
            const { button, offsetX, offsetY, pageX, pageY } = sourceEvent;
            if (button === 0) {
                this.dragState = { target: element, start: { offsetX, offsetY, pageX, pageY } };
                onDragStart?.(ProxyInteractionService.makeDragEvent(this.dragState, sourceEvent));
            }
        };
        const mousemove = (sourceEvent: MouseEvent) => {
            if (this.dragState?.target === element) {
                onDrag?.(ProxyInteractionService.makeDragEvent(this.dragState, sourceEvent));
            }
        };
        const mouseup = (sourceEvent: MouseEvent) => {
            if (this.dragState?.target === element && sourceEvent.button === 0) {
                onDragEnd?.(ProxyInteractionService.makeDragEvent(this.dragState, sourceEvent));
                this.dragState = undefined;
            }
        };

        // TODO: We only need 1 window listener. Not one per draggable element.
        const window = getWindow();
        element.addEventListener('mousedown', mousedown);
        window.addEventListener('mousemove', mousemove);
        window.addEventListener('mouseup', mouseup);

        return () => {
            element.removeEventListener('mousedown', mousedown);
            window.removeEventListener('mousemove', mousemove);
            window.removeEventListener('mouseup', mouseup);
        };
    }

    private static makeDragEvent(
        { start }: NonNullable<ProxyInteractionService['dragState']>,
        sourceEvent: MouseEvent
    ): ProxyDragHandlerEvent {
        // [offsetX, offsetY] is relative to the sourceEvent.target, which can be another element
        // such as a legend button. Therefore, calculate [offsetX, offsetY] relative to the axis
        // element that fired the 'mousedown' event.
        const originDeltaX = sourceEvent.pageX - start.pageX;
        const originDeltaY = sourceEvent.pageY - start.pageY;
        return {
            offsetX: start.offsetX + originDeltaX,
            offsetY: start.offsetY + originDeltaY,
            originDeltaX,
            originDeltaY,
        };
    }

    private initElement<T extends ProxyElementType>(params: ElemParams<T>, widget: IWidget) {
        const element = widget.getElement();
        setAttribute(element, 'id', params.id);
        setElementStyle(element, 'cursor', params.cursor);
        element.classList.toggle('ag-charts-proxy-elem', true);
        return element;
    }

    private initInteract<T extends ProxyElementType>(params: InteractParams<T>, widget: IWidget) {
        const { onclick, ondblclick, onmouseenter, onmouseleave, oncontextmenu, onchange, onfocus, onblur, tabIndex } =
            params;
        const element = this.initElement(params, widget);

        if (tabIndex !== undefined) {
            element.tabIndex = tabIndex;
        }

        if (onclick) {
            element.addEventListener('click', onclick);
        }
        if (ondblclick) {
            element.addEventListener('dblclick', ondblclick);
        }
        if (onmouseenter) {
            element.addEventListener('mouseenter', onmouseenter);
        }
        if (onmouseleave) {
            element.addEventListener('mouseleave', onmouseleave);
        }
        if (oncontextmenu) {
            element.addEventListener('contextmenu', oncontextmenu);
        }
        if (onfocus) {
            element.addEventListener('focus', onfocus);
        }
        if (onblur) {
            element.addEventListener('blur', onblur);
        }
        if (onchange) {
            element.addEventListener('change', onchange);
        }
    }

    private setParent<TParent extends Widget, TChild extends Widget>(
        params: ParentProperties<TParent>,
        element: TChild
    ) {
        if ('parent' in params) {
            params.parent?.appendChild(element);
        } else {
            const insert = { where: params.where, query: '.ag-charts-series-area' };
            this.domManager.addChild('canvas-proxy', params.domManagerId, element.getElement(), insert);
        }
    }
}
