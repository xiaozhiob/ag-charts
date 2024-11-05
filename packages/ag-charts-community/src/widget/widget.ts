import { type BaseAttributeTypeMap, type BaseStyleTypeMap, setAttribute, setElementStyle } from '../util/attributeUtil';
import type { BBoxValues } from '../util/bboxinterface';
import { getElementBBox, getWindow, setElementBBox } from '../util/dom';

interface IWidget<TElement extends HTMLElement> {
    destroy(): void;
    getElement(): TElement;
}

export abstract class Widget<
    TElement extends HTMLElement = HTMLElement,
    TChildWidget extends IWidget<HTMLElement> = IWidget<HTMLElement>,
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

    isHidden(): boolean {
        return getWindow()?.getComputedStyle?.(this.elem).display === 'none';
    }

    setBounds(bounds: BBoxValues): void {
        setElementBBox(this.elem, bounds);
    }

    getBounds(): BBoxValues {
        return getElementBBox(this.elem);
    }

    setCursor(cursor: BaseStyleTypeMap['cursor'] | undefined) {
        setElementStyle(this.elem, 'cursor', cursor);
    }

    setAttribute<A extends keyof BaseAttributeTypeMap>(qualifiedName: A, value: BaseAttributeTypeMap[A] | undefined) {
        setAttribute(this.elem, qualifiedName, value);
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
