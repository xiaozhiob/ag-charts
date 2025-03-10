import { getAttribute, setAttribute } from './attributeUtil';

function addRemovableEventListener<K extends keyof WindowEventMap>(
    destroyFns: (() => void)[],
    elem: Window,
    type: K,
    listener: (this: Window, ev: WindowEventMap[K]) => any
): () => void;

function addRemovableEventListener<K extends keyof HTMLElementEventMap>(
    destroyFns: (() => void)[],
    elem: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
): () => void;

function addRemovableEventListener<K extends keyof (HTMLElementEventMap | WindowEventMap)>(
    destroyFns: (() => void)[],
    elem: HTMLElement | Window,
    type: K,
    listener: (this: unknown, ev: unknown) => unknown
): () => void {
    elem.addEventListener(type, listener);
    const remover = () => elem.removeEventListener(type, listener);
    destroyFns.push(remover);
    return remover;
}

function addEscapeEventListener(
    destroyFns: (() => void)[],
    elem: HTMLElement,
    onEscape: (event: KeyboardEvent) => void
) {
    addRemovableEventListener(destroyFns, elem, 'keydown', (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            onEscape(event);
        }
    });
}

function addMouseCloseListener(destroyFns: (() => void)[], menu: HTMLElement, hideCallback: () => void): () => void {
    const self = addRemovableEventListener(destroyFns, window, 'mousedown', (event: MouseEvent) => {
        if ([0, 2].includes(event.button) && !containsPoint(menu, event)) {
            hideCallback();
            self();
        }
    });
    return self;
}

function containsPoint(container: Element, event: MouseEvent) {
    if (event.target instanceof Element) {
        const { x, y, width, height } = container.getBoundingClientRect();
        const { clientX: ex, clientY: ey } = event;
        return ex >= x && ey >= y && ex <= x + width && ey <= y + height;
    }
    return false;
}

export function hasNoModifiers(event: KeyboardEvent | MouseEvent): boolean {
    return !(event.shiftKey || event.altKey || event.ctrlKey || event.metaKey);
}

function matchesKey(event: KeyboardEvent, key: string, ...morekeys: string[]): boolean {
    return hasNoModifiers(event) && (event.key === key || morekeys.some((altkey) => event.key === altkey));
}

function linkTwoButtons(destroyFns: (() => void)[], src: HTMLElement, dst: HTMLElement | undefined, key: string) {
    if (!dst) return;

    addRemovableEventListener(destroyFns, src, 'keydown', (event: KeyboardEvent) => {
        if (matchesKey(event, key)) {
            dst.focus();
        }
    });
}

function linkThreeButtons(
    destroyFns: (() => void)[],
    curr: HTMLElement,
    next: HTMLElement | undefined,
    nextKey: string,
    prev: HTMLElement | undefined,
    prevKey: string
) {
    linkTwoButtons(destroyFns, curr, prev, prevKey);
    linkTwoButtons(destroyFns, curr, next, nextKey);
    addRemovableEventListener(destroyFns, curr, 'keydown', (event: KeyboardEvent) => {
        if (matchesKey(event, nextKey, prevKey)) {
            event.preventDefault();
        }
    });
}

export const PREV_NEXT_KEYS = {
    horizontal: { nextKey: 'ArrowRight', prevKey: 'ArrowLeft' },
    vertical: { nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
} as const;

// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role
export function initToolbarKeyNav(
    opts: { toolbar: HTMLElement } & Parameters<typeof initRovingTabIndex>[0]
): ReturnType<typeof initRovingTabIndex> {
    opts.toolbar.role = 'toolbar';
    opts.toolbar.ariaOrientation = opts.orientation;
    opts.toolbar.ariaHidden = (opts.buttons.length === 0).toString();
    return initRovingTabIndex(opts);
}

// https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/#kbd_roving_tabindex
export function initRovingTabIndex(opts: {
    orientation: 'horizontal' | 'vertical';
    buttons: HTMLElement[];
    wrapAround?: boolean;
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    onEscape?: (event: KeyboardEvent) => void;
}) {
    const { orientation, buttons, wrapAround = false, onEscape, onFocus, onBlur } = opts;
    const { nextKey, prevKey } = PREV_NEXT_KEYS[orientation];

    // Assistive Technologies might provide functionality to focus on any element at random.
    // For example, in VoiceOver the user can press Ctrl+Opt+Shift Up to leave the toolbar, and then
    // focus on the first item by pressing Ctrl+Opt+Shift Down to enter the toolbar again.
    // Therefore, we must use brute-force to ensure that there's only one tabIndex=0 in the toolbar.
    const setTabIndices = (event: FocusEvent) => {
        if (event.target && 'tabIndex' in event.target) {
            buttons.forEach((b) => (b.tabIndex = -1));
            event.target.tabIndex = 0;
        }
    };

    // When wrapAround is false, use c,m such that (c+x)%m === x
    const [c, m] = wrapAround ? [buttons.length, buttons.length] : [0, Infinity];
    const destroyFns: (() => void)[] = [];
    for (let i = 0; i < buttons.length; i++) {
        const prev = buttons[(c + i - 1) % m];
        const curr = buttons[i];
        const next = buttons[(c + i + 1) % m];
        addRemovableEventListener(destroyFns, curr, 'focus', setTabIndices);
        if (onFocus) addRemovableEventListener(destroyFns, curr, 'focus', onFocus);
        if (onBlur) addRemovableEventListener(destroyFns, curr, 'blur', onBlur);
        if (onEscape) addEscapeEventListener(destroyFns, curr, onEscape);
        linkThreeButtons(destroyFns, curr, next, nextKey, prev, prevKey);
        curr.tabIndex = i === 0 ? 0 : -1;
    }

    return destroyFns;
}

export interface MenuCloser {
    close(): void;
    finishClosing(): void;
}

class MenuCloserImp implements MenuCloser {
    public readonly destroyFns: (() => void)[] = [];

    constructor(
        menu: HTMLElement,
        private lastFocus: HTMLElement | undefined,
        public readonly closeCallback: () => void
    ) {
        this.destroyFns.push(addMouseCloseListener(this.destroyFns, menu, () => this.close()));
    }

    close() {
        this.destroyFns.forEach((d) => d());
        this.destroyFns.length = 0;
        this.closeCallback();
        this.finishClosing();
    }

    finishClosing() {
        this.destroyFns.forEach((d) => d());
        this.destroyFns.length = 0;
        setAttribute(this.lastFocus, 'aria-expanded', false);
        this.lastFocus?.focus();
        this.lastFocus = undefined;
    }
}

// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role
export function initMenuKeyNav(opts: {
    orientation: 'vertical';
    sourceEvent: Event;
    menu: HTMLElement;
    buttons: HTMLElement[];
    // CRT-481 Automatically close the context menu when change focus with TAB / Shift+TAB
    autoCloseOnBlur?: boolean;
    closeCallback: () => void;
}): MenuCloser {
    const { sourceEvent, orientation, menu, buttons, closeCallback, autoCloseOnBlur = false } = opts;
    const { nextKey, prevKey } = PREV_NEXT_KEYS[orientation];

    const lastFocus = getLastFocus(sourceEvent);
    setAttribute(lastFocus, 'aria-expanded', true);

    const menuCloser = new MenuCloserImp(menu, lastFocus, closeCallback);
    const onEscape = () => menuCloser.close();
    const { destroyFns } = menuCloser;

    menu.role = 'menu';
    menu.ariaOrientation = orientation;
    destroyFns.push(...initRovingTabIndex({ orientation, buttons, onEscape, wrapAround: true }));

    // Add handlers for the menu element itself.
    menu.tabIndex = -1;
    addEscapeEventListener(destroyFns, menu, onEscape);
    addRemovableEventListener(destroyFns, menu, 'keydown', (ev: KeyboardEvent) => {
        if (ev.target === menu && (ev.key === nextKey || ev.key === prevKey)) {
            ev.preventDefault();
            buttons[0]?.focus();
        }
    });

    if (autoCloseOnBlur) {
        const handler = (ev: FocusEvent) => {
            const buttonArray: (EventTarget | null)[] = buttons;
            const isLeavingMenu = !buttonArray.includes(ev.relatedTarget);
            if (isLeavingMenu) {
                onEscape();
            }
        };
        for (const button of buttons) {
            addRemovableEventListener(destroyFns, button, 'blur', handler);
        }
    }

    buttons[0]?.focus();
    return menuCloser;
}

export function makeAccessibleClickListener(element: HTMLElement, onclick: (event: MouseEvent) => unknown) {
    // AG-11385 Ignore clicks disabled elements.
    return (event: MouseEvent) => {
        if (element.ariaDisabled === 'true') {
            return event.preventDefault();
        }
        onclick(event);
    };
}

export function isButtonClickEvent(event: KeyboardEvent | MouseEvent): boolean {
    if ('button' in event) {
        return event.button === 0;
    }
    // AG-12871 Use `key` for Enter to also include the Numpad Enter key.
    return hasNoModifiers(event) && (event.code === 'Space' || event.key === 'Enter');
}

export function getLastFocus(sourceEvent: Event | undefined): HTMLElement | undefined {
    if (sourceEvent?.target instanceof HTMLElement && 'tabindex' in sourceEvent.target.attributes) {
        return sourceEvent.target;
    }
    return undefined;
}

export function stopPageScrolling(element: HTMLElement) {
    const handler = (event: KeyboardEvent) => {
        if (event.defaultPrevented) return;
        const shouldPrevent = getAttribute(event.target, 'data-preventdefault', true);
        if (shouldPrevent && matchesKey(event, 'ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp')) {
            event.preventDefault();
        }
    };
    element.addEventListener('keydown', handler);
    return () => element.removeEventListener('keydown', handler);
}
