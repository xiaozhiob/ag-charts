import { setElementStyle } from '../util/attributeUtil';
import type { BBoxValues } from '../util/bboxinterface';
import { setElementBBox } from '../util/dom';

type Destroyable = { destroy(): void };

class DestroyableArray<T extends Destroyable> implements Destroyable {
    private array: T[] = [];

    destroy(): void {
        this.array.forEach((e) => e.destroy());
        this.array.length = 0;
    }
}

interface IWidget extends Destroyable {
    destroy(): void;
}

export abstract class Widget<TElement extends HTMLElement = HTMLElement, TChild extends IWidget = IWidget>
    implements IWidget
{
    private readonly children = new DestroyableArray<TChild>();

    constructor(protected readonly elem: TElement) {}

    protected abstract destructor(): void;

    destroy(): void {
        this.children.destroy();
        this.destructor();
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
}
