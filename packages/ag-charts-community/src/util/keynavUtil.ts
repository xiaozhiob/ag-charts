function addRemovableEventListener<K extends keyof HTMLElementEventMap>(
    destroyFns: (() => void)[],
    button: HTMLElement,
    type: K,
    listener: (this: HTMLElement, ev: HTMLElementEventMap[K]) => any
): void {
    button.addEventListener(type, listener);
    destroyFns.push(() => button.removeEventListener(type, listener));
}

function addEscapeEventListener(
    destroyFns: (() => void)[],
    elem: HTMLElement,
    onEscape?: (event: KeyboardEvent) => void
) {
    if (onEscape) {
        addRemovableEventListener(destroyFns, elem, 'keydown', (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onEscape(event);
            }
        });
    }
}

function linkTwoButtons(
    destroyFns: (() => void)[],
    src: HTMLElement,
    dst: HTMLElement | undefined,
    key: string,
    managedTabIndices: boolean
) {
    if (!dst) return;

    let handler: (event: KeyboardEvent) => void;
    if (managedTabIndices) {
        handler = (event: KeyboardEvent) => {
            if (event.key !== key) {
                dst.focus();
                dst.tabIndex = 0;
                src.tabIndex = -1;
            }
        };
    } else {
        handler = (event: KeyboardEvent) => {
            if (event.key === key) {
                dst.focus();
            }
        };
    }

    addRemovableEventListener(destroyFns, src, 'keydown', handler);
}

function linkThreeButtons(
    destroyFns: (() => void)[],
    curr: HTMLElement,
    next: HTMLElement | undefined,
    nextKey: string,
    prev: HTMLElement | undefined,
    prevKey: string,
    managedTabIndices: boolean
) {
    linkTwoButtons(destroyFns, curr, prev, prevKey, managedTabIndices);
    linkTwoButtons(destroyFns, curr, next, nextKey, managedTabIndices);
    addRemovableEventListener(destroyFns, curr, 'keydown', (event: KeyboardEvent) => {
        if (event.key === nextKey || event.key === prevKey) {
            event.preventDefault();
        }
    });
}

const PREV_NEXT_KEYS = {
    horizontal: { nextKey: 'ArrowRight', prevKey: 'ArrowLeft' },
    vertical: { nextKey: 'ArrowDown', prevKey: 'ArrowUp' },
} as const;

// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/toolbar_role
export function initToolbarKeyNav(opts: {
    orientation: 'horizontal' | 'vertical';
    toolbar: HTMLElement;
    buttons: HTMLElement[];
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
    onEscape?: (event: KeyboardEvent) => void;
}): (() => void)[] {
    const { orientation, toolbar, buttons, onEscape, onFocus, onBlur } = opts;
    const { nextKey, prevKey } = PREV_NEXT_KEYS[orientation];

    toolbar.role = 'toolbar';
    toolbar.ariaOrientation = orientation;

    const destroyFns: (() => void)[] = [];
    for (let i = 0; i < buttons.length; i++) {
        const prev = buttons[i - 1];
        const curr = buttons[i];
        const next = buttons[i + 1];
        if (onFocus) addRemovableEventListener(destroyFns, curr, 'focus', onFocus);
        if (onBlur) addRemovableEventListener(destroyFns, curr, 'blur', onBlur);
        addEscapeEventListener(destroyFns, curr, onEscape);
        linkThreeButtons(destroyFns, curr, prev, prevKey, next, nextKey, true);
        curr.tabIndex = i === 0 ? 0 : -1;
    }

    return destroyFns;
}

// https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/menu_role
export function initMenuKeyNav(opts: {
    orientation: 'vertical';
    menu: HTMLElement;
    buttons: HTMLElement[];
    onEscape?: (event: KeyboardEvent) => void;
}): (() => void)[] {
    const { orientation, menu, buttons, onEscape } = opts;
    const { nextKey, prevKey } = PREV_NEXT_KEYS[orientation];

    menu.role = 'menu';
    menu.ariaOrientation = orientation;

    const destroyFns: (() => void)[] = [];
    for (let i = 0; i < buttons.length; i++) {
        // Use modules to wrap around when navigation past the start/end of the menu.
        const prev = buttons[(buttons.length + i - 1) % buttons.length];
        const curr = buttons[i];
        const next = buttons[(buttons.length + i + 1) % buttons.length];
        addEscapeEventListener(destroyFns, curr, onEscape);
        linkThreeButtons(destroyFns, curr, prev, prevKey, next, nextKey, false);
        curr.tabIndex = -1;
    }

    // Add handlers for the menu element itself.
    menu.tabIndex = -1;
    addEscapeEventListener(destroyFns, menu, onEscape);
    addRemovableEventListener(destroyFns, menu, 'keydown', (ev: KeyboardEvent) => {
        if (ev.target === menu && (ev.key === nextKey || ev.key === prevKey)) {
            ev.preventDefault();
            buttons[0]?.focus();
        }
    });

    return destroyFns;
}

export function makeAccessibleClickListener(element: HTMLElement, onclick: (event: MouseEvent) => unknown) {
    return (event: MouseEvent) => {
        if (element.ariaDisabled === 'true') {
            return event.preventDefault();
        }
        onclick(event);
    };
}
