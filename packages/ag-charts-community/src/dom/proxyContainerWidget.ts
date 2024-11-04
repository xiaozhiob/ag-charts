import { getDocument } from '../util/dom';
import { Widget } from '../widget/widget';

export class ProxyContainerWidget extends Widget {
    public div: HTMLDivElement = getDocument().createElement('div');

    protected override destructor() {
        this.div.remove();
    }
}
