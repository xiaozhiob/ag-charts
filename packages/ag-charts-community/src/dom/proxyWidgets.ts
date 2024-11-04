import { getDocument } from '../util/dom';
import { type IWidget, Widget } from '../widget/widget';

export class ProxyContainerWidget extends Widget<HTMLDivElement> {
    public get div(): HTMLDivElement {
        return this.getElement();
    }

    constructor() {
        super(getDocument().createElement('div'));
    }

    protected override destructor() {
        this.div.remove();
    }
}

export class ProxyElementWidget<
    R extends { remove(): void },
    T extends HTMLElement = R extends HTMLElement ? R : HTMLElement,
> implements IWidget<T>
{
    constructor(
        public readonly remover: R,
        public readonly nativeElement: T
    ) {}

    public destroy() {
        this.remover.remove();
    }

    public getElement() {
        return this.nativeElement;
    }

    public static fromHTML<T extends HTMLElement>(nativeElement: T): ProxyElementWidget<T, T> {
        return new ProxyElementWidget(nativeElement, nativeElement);
    }
}
