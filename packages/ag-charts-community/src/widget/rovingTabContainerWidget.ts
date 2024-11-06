import type { Direction } from 'ag-charts-types';

import { getAttribute, setAttribute } from '../util/attributeUtil';
import { getDocument } from '../util/dom';
import { PREV_NEXT_KEYS, hasNoModifiers } from '../util/keynavUtil';
import type { NativeWidget } from './nativeWidget';
import type { SliderWidget } from './sliderWidget';
import { Widget } from './widget';
import type { FocusWidgetEvent, KeyboardWidgetEvent } from './widgetEvents';

type RovingChildWidgets = SliderWidget | NativeWidget;

export class RovingTabContainerWidget extends Widget<HTMLDivElement, RovingChildWidgets> {
    private focusedChildIndex = 0;

    public get orientation(): Direction {
        return getAttribute(this.elem, 'aria-orientation', 'horizontal');
    }
    public set orientation(orientation: Direction) {
        setAttribute(this.elem, 'aria-orientation', orientation);
    }

    constructor(role: 'toolbar') {
        super(getDocument().createElement('div'));
        setAttribute(this.elem, 'role', role);
    }

    override focus() {
        this.children[this.focusedChildIndex]?.focus();
    }

    protected override destructor() {} // NOSONAR

    protected override onChildAdded(child: RovingChildWidgets): void {
        child.addListener('focus', this.onChildFocus);
        child.addListener('keydown', this.onChildKeyDown);
    }

    protected override onChildRemoved(child: RovingChildWidgets): void {
        child.removeListener('focus', this.onChildFocus);
        child.removeListener('keydown', this.onChildKeyDown);
    }

    private readonly onChildFocus = (child: RovingChildWidgets, _event: FocusWidgetEvent): void => {
        const oldFocus = this.children[this.focusedChildIndex];
        this.focusedChildIndex = child.index;
        oldFocus?.setTabIndex(-1);
        child.setTabIndex(0);
    };

    private readonly onChildKeyDown = (child: RovingChildWidgets, event: KeyboardWidgetEvent): void => {
        const keys = PREV_NEXT_KEYS[this.orientation];
        let targetIndex = -1;
        if (hasNoModifiers(event.sourceEvent)) {
            if (event.sourceEvent.key === keys.nextKey) {
                targetIndex = child.index + 1;
            } else if (event.sourceEvent.key === keys.prevKey) {
                targetIndex = child.index - 1;
            }
        }
        this.children[targetIndex]?.focus();
    };
}
