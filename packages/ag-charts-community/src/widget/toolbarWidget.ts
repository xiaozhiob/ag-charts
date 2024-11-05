import { getDocument } from '../util/dom';
import type { SliderWidget } from './sliderWidget';
import { Widget } from './widget';

export class ToolbarWidget extends Widget<HTMLDivElement, SliderWidget> {
    constructor() {
        super(getDocument().createElement('div'));
    }

    protected override destructor() {}
}
