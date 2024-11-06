import type { Direction } from 'ag-charts-types';

import { getDocument } from '../util/dom';
import { PREV_NEXT_KEYS, hasNoModifiers } from '../util/keynavUtil';
import type { SliderWidget } from './sliderWidget';
import { Widget } from './widget';

type TChildWidget = SliderWidget;

export class ToolbarWidget extends Widget<HTMLDivElement, TChildWidget> {
    private focusedChildIndex = 0;

    private _orientation = undefined as unknown as Direction;

    public get orientation() {
        return this._orientation;
    }
    public set orientation(orientation: Direction) {
        this._orientation = orientation;
        this.elem.setAttribute('aria-orientation', orientation);
    }

    constructor() {
        super(getDocument().createElement('div'));
        this.orientation = 'horizontal';
    }

    override focus() {
        this.children[this.focusedChildIndex]?.focus();
    }

    protected override destructor() {}

    protected override onChildAdded(child: TChildWidget): void {
        child.addListener('focus', this.onChildFocus);
        child.addListener('keydown', this.onChildKeyDown);
    }

    protected override onChildRemoved(child: TChildWidget): void {
        child.removeListener('focus', this.onChildFocus);
        child.removeListener('keydown', this.onChildKeyDown);
    }

    private onChildFocus = (child: TChildWidget, _event: FocusEvent): void => {
        const oldFocus = this.children[this.focusedChildIndex];
        this.focusedChildIndex = child.index;
        oldFocus?.setTabIndex(-1);
        child.setTabIndex(0);
    };

    private readonly onChildKeyDown = (child: TChildWidget, event: KeyboardEvent): void => {
        const keys = PREV_NEXT_KEYS[this._orientation];
        let targetIndex = -1;
        if (hasNoModifiers(event)) {
            if (event.key === keys.nextKey) {
                targetIndex = child.index + 1;
            } else if (event.key === keys.prevKey) {
                targetIndex = child.index - 1;
            }
        }
        this.children[targetIndex]?.focus();
    };
}
