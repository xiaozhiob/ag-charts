export type FocusWidgetEvent = {
    sourceEvent: FocusEvent;
};

export type KeyboardWidgetEvent = {
    sourceEvent: KeyboardEvent;
};

export type DragStartWidgetEvent = {
    sourceEvent: MouseEvent | TouchEvent;
};

export type DragMoveWidgetEvent = {
    sourceEvent: MouseEvent | TouchEvent;
};

export type DragEndWidgetEvent = {
    sourceEvent: MouseEvent | TouchEvent;
};

export type WidgetEventMap = {
    'drag-start': DragEndWidgetEvent;
    'drag-move': DragMoveWidgetEvent;
    'drag-end': DragEndWidgetEvent;
    focus: FocusWidgetEvent;
    keydown: KeyboardWidgetEvent;
};

export const WIDGET_HTML_EVENTS: readonly (keyof WidgetEventMap & keyof HTMLElementEventMap)[] = [
    'focus',
    'keydown',
] satisfies (keyof WidgetEventMap & keyof HTMLElementEventMap)[];

export type WidgetSourceEventMap = {
    [K in keyof WidgetEventMap]: WidgetEventMap[K]['sourceEvent'];
};

const WidgetAllocators: { [K in keyof WidgetEventMap]: (sourceEvent: WidgetSourceEventMap[K]) => WidgetEventMap[K] } = {
    'drag-start': (sourceEvent: MouseEvent | TouchEvent): DragStartWidgetEvent => {
        return { sourceEvent };
    },
    'drag-move': (sourceEvent: MouseEvent | TouchEvent): DragMoveWidgetEvent => {
        return { sourceEvent };
    },
    'drag-end': (sourceEvent: MouseEvent | TouchEvent): DragEndWidgetEvent => {
        return { sourceEvent };
    },
    focus: (sourceEvent: FocusEvent): FocusWidgetEvent => {
        return { sourceEvent };
    },
    keydown: (sourceEvent: KeyboardEvent): KeyboardWidgetEvent => {
        return { sourceEvent };
    },
};

export type WidgetEventMap_HTML = Pick<WidgetEventMap, (typeof WIDGET_HTML_EVENTS)[number]>;
export type WidgetEventMap_Internal = Omit<WidgetEventMap, (typeof WIDGET_HTML_EVENTS)[number]>;
export type WidgetSourceEventMap_HTML = Pick<WidgetSourceEventMap, (typeof WIDGET_HTML_EVENTS)[number]>;
export type WidgetSourceEventMap_Internal = Omit<WidgetSourceEventMap, (typeof WIDGET_HTML_EVENTS)[number]>;

export class WidgetEventUtil {
    static alloc<K extends keyof WidgetEventMap_HTML>(
        type: K,
        sourceEvent: WidgetSourceEventMap_HTML[K]
    ): WidgetEventMap_HTML[K];

    static alloc<K extends keyof WidgetEventMap_Internal>(
        type: K,
        sourceEvent: WidgetSourceEventMap_Internal[K]
    ): WidgetEventMap_Internal[K];

    static alloc<K extends keyof WidgetEventMap>(type: K, sourceEvent: WidgetSourceEventMap[K]): WidgetEventMap[K] {
        return WidgetAllocators[type](sourceEvent);
    }

    static isHTMLEvent(type: keyof WidgetEventMap): type is keyof WidgetEventMap & keyof HTMLElementEventMap {
        const htmlTypes: readonly string[] = WIDGET_HTML_EVENTS;
        return htmlTypes.includes(type);
    }
}
