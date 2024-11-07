import { setAttribute, setElementStyle } from '../util/attributeUtil';
import { getDocument } from '../util/dom';
import { RovingTabContainerWidget } from './rovingTabContainerWidget';

type TChildWidget = Parameters<RovingTabContainerWidget['appendChildToDOM']>[0];

export class ListWidget extends RovingTabContainerWidget {
    private listitems: HTMLDivElement[] = [];

    constructor() {
        super('both', 'list');
    }

    protected override destructor(): void {
        this.listitems.forEach((listitem) => listitem.remove());
        this.listitems.length = 0;
    }

    protected override appendChildToDOM(child: TChildWidget) {
        const listitem: HTMLDivElement = getDocument().createElement('div');
        setAttribute(listitem, 'role', 'list');
        setElementStyle(listitem, 'position', 'absolute');
        listitem.replaceChildren(child.getElement());
        this.elem.appendChild(listitem);
    }

    protected override removeChildFromDOM(child: TChildWidget) {
        const listitem: HTMLDivElement = this.listitems[child.index];
        this.listitems.splice(child.index, 1);
        this.elem.removeChild(listitem);
    }

    getListItemElement(index: number): HTMLDivElement | undefined {
        return this.listitems[index];
    }
}
