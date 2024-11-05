import { getDocument } from '../util/dom';
import { Widget } from './widget';

export class SliderWidget extends Widget<HTMLInputElement> {
    constructor() {
        super(getDocument().createElement('input'));
    }

    protected override destructor() {}
}
