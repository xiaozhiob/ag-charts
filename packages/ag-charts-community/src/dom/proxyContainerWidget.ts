import { getDocument } from '../util/dom';
import { Widget } from '../widget/widget';

export class ProxyContainerWidget extends Widget<HTMLDivElement> {
    public get div(): HTMLDivElement {
        return this.elem;
    }

    constructor() {
        super(getDocument().createElement('div'));
    }

    protected override destructor() {
        this.div.remove();
    }
}
