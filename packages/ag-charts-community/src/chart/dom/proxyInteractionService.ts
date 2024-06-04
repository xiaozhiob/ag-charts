import type { Direction } from '../../options/agChartOptions';
import type { BBoxProvider, BBoxValues } from '../../util/bboxinterface';
import { Debug } from '../../util/debug';
import { createElement } from '../../util/dom';
import type { LocaleManager } from '../locale/localeManager';
import type { UpdateService } from '../updateService';
import type { DOMManager } from './domManager';
import type { FocusIndicator } from './focusIndicator';

type ElemParams<T extends ProxyElementType> = {
    readonly type: T;
    readonly id: string;
    readonly parent: HTMLElement;
    readonly focusable: BBoxProvider<BBoxValues>;
    readonly onclick?: (ev: MouseEvent) => void;
    readonly onchange?: (ev: Event) => void;
};

type ContainerParams<T extends ProxyContainerType> = {
    readonly type: T;
    readonly id: string;
    readonly classList: string[];
    readonly ariaLabel: string;
    readonly ariaOrientation: Direction;
};

type ProxyMeta = {
    button: {
        params: ElemParams<'button'> & { readonly textContent: string };
        result: HTMLButtonElement;
    };
    slider: {
        params: ElemParams<'slider'> & { readonly ariaLabel: string; readonly ariaOrientation: Direction };
        result: HTMLInputElement;
    };
    toolbar: {
        params: ContainerParams<'toolbar'>;
        result: HTMLDivElement;
    };
};

type ProxyElementType = 'button' | 'slider';
type ProxyContainerType = 'toolbar';

function checkType<T extends keyof ProxyMeta>(
    type: T,
    meta: Pick<ProxyMeta[keyof ProxyMeta], 'params'>
): meta is Pick<ProxyMeta[T], 'params'> {
    return meta.params?.type === type;
}

function allocateMeta<T extends keyof ProxyMeta>(params: ProxyMeta[T]['params']) {
    const map = { button: 'button', slider: 'input', toolbar: 'div' } as const;
    return { params, result: createElement(map[params.type]) } as ProxyMeta[T];
}

export class ProxyInteractionService {
    // This debug option make the proxies button partially transparent instead of fully transparent.
    // To enabled this option, set window.agChartsDebug = ['showDOMProxies'].
    private readonly debugShowDOMProxies: boolean = Debug.check('showDOMProxies');
    private focusable?: BBoxProvider<BBoxValues>;
    private readonly destroyFns: Array<() => void> = [];

    constructor(
        updateService: UpdateService,
        private readonly localeManager: LocaleManager,
        private readonly domManager: DOMManager,
        private readonly focusIndicator: FocusIndicator
    ) {
        this.destroyFns.push(updateService.addListener('update-complete', () => this.update()));
    }

    destroy() {
        this.destroyFns.forEach((fn) => fn());
    }

    private update() {
        if (this.focusable) {
            this.focusIndicator.updateBBox(this.focusable.getCachedBBox());
        }
    }

    private addLocalisation(fn: () => void) {
        fn();
        this.destroyFns.push(this.localeManager.addListener('locale-changed', fn));
    }

    createProxyContainer<T extends ProxyContainerType>(
        args: { type: T } & ProxyMeta[T]['params']
    ): ProxyMeta[T]['result'] {
        const meta: ProxyMeta[T] = allocateMeta(args);
        const { params, result: div } = meta;

        this.domManager.addChild('canvas-overlay', params.id, div);
        div.classList.add(...params.classList);
        div.style.pointerEvents = 'none';
        div.role = params.type;
        div.ariaOrientation = params.ariaOrientation;

        this.addLocalisation(() => {
            div.ariaLabel = this.localeManager.t(params.ariaLabel);
        });

        return div;
    }

    createProxyElement<T extends ProxyElementType>(args: { type: T } & ProxyMeta[T]['params']): ProxyMeta[T]['result'] {
        const meta: ProxyMeta[T] = allocateMeta(args);

        if (checkType('button', meta)) {
            const { params, result: button } = meta;
            this.initElement(params, button);
            button.textContent = params.textContent;
        }

        if (checkType('slider', meta)) {
            const { params, result: slider } = meta;
            this.initElement(params, slider);
            slider.type = 'range';
            slider.role = 'presentation';
            slider.style.margin = '0px';
            slider.ariaOrientation = params.ariaOrientation;

            this.addLocalisation(() => {
                slider.ariaLabel = this.localeManager.t(params.ariaLabel);
            });
        }

        return meta.result;
    }

    private initElement<T extends ProxyElementType, TElem extends HTMLElement>(
        params: ProxyMeta[T]['params'],
        element: TElem
    ) {
        const { focusable, onclick, onchange, id, parent } = params;

        element.id = id;
        element.style.pointerEvents = 'none';
        element.style.opacity = this.debugShowDOMProxies ? '0.25' : '0';
        element.style.position = 'absolute';

        parent.appendChild(element);

        element.addEventListener('focus', (_event: FocusEvent): any => {
            this.focusable = focusable;
            element.style.setProperty('pointerEvents', null);
            this.focusIndicator.updateBBox(focusable.getCachedBBox());
        });
        element.addEventListener('blur', (_event: FocusEvent): any => {
            this.focusable = undefined;
            element.style.pointerEvents = 'none';
            this.focusIndicator.updateBBox(undefined);
        });
        if (onclick) {
            element.addEventListener('click', onclick);
        }
        if (onchange) {
            element.addEventListener('change', onchange);
        }
    }
}
