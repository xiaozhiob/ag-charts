export type FocusWidgetEvent = {
    sourceEvent: FocusEvent;
};

export type KeyboardWidgetEvent = {
    sourceEvent: KeyboardEvent;
};

export type WidgetEventMap = {
    focus: FocusWidgetEvent;
    keydown: KeyboardWidgetEvent;
};

export type WidgetSourceEventMap = {
    [K in keyof WidgetEventMap]: WidgetEventMap[K]['sourceEvent'];
};

const WidgetAllocators: { [K in keyof WidgetEventMap]: (sourceEvent: WidgetSourceEventMap[K]) => WidgetEventMap[K] } = {
    focus: (sourceEvent: FocusEvent): FocusWidgetEvent => {
        return { sourceEvent };
    },
    keydown: (sourceEvent: KeyboardEvent): KeyboardWidgetEvent => {
        return { sourceEvent };
    },
};

export const WidgetEvent = {
    alloc<K extends keyof WidgetEventMap>(type: K, sourceEvent: WidgetSourceEventMap[K]): WidgetEventMap[K] {
        return WidgetAllocators[type](sourceEvent);
    },
};
