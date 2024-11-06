import { setElementStyle } from '../util/attributeUtil';
import type { BBoxValues } from '../util/bboxinterface';
import { setElementBBox } from '../util/dom';

interface IWidget<TElement extends HTMLElement> {
    destroy(): void;
    getElement(): TElement;
}

export abstract class Widget<
    TElement extends HTMLElement = HTMLElement,
    TChildElement extends HTMLElement = HTMLElement,
    TChildWidget extends IWidget<TChildElement> = IWidget<TChildElement>,
> implements IWidget<TElement>
{
    private readonly children: TChildWidget[] = [];

    constructor(private readonly elem: TElement) {}

    protected abstract destructor(): void;

    getElement(): TElement {
        return this.elem;
    }

    destroy(): void {
        this.children.forEach((child) => child.destroy());
        this.destructor();
        this.elem.remove();
    }

    setHidden(hidden: boolean): void {
        setElementStyle(this.elem, 'display', hidden ? 'none' : undefined);
    }

    setBounds(bounds: BBoxValues): void {
        setElementBBox(this.elem, bounds);
    }

    cssLeft(): number {
        return parseFloat(this.elem.style.left);
    }
    cssTop(): number {
        return parseFloat(this.elem.style.top);
    }

    appendChild(child: TChildWidget) {
        this.elem.appendChild(child.getElement());
        this.children.push(child);
    }
}
