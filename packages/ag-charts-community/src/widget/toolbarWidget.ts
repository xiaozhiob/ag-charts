import { getDocument } from '../util/dom';
import { RovingTabContainerWidget } from './rovingTabContainerWidget';
import type { SliderWidget } from './sliderWidget';

export class ToolbarWidget extends RovingTabContainerWidget<HTMLDivElement, SliderWidget> {
    constructor() {
        super(getDocument().createElement('div'));
    }
}
