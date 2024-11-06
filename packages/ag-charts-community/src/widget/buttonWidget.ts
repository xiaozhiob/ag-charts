import { getDocument } from '../util/dom';
import { Widget } from './widget';

export class ButtonWidget extends Widget<HTMLButtonElement> {
    constructor() {
        super(getDocument().createElement('button'));
    }

    protected override destructor() {} // NOSONAR
}
