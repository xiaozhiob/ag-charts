import { getDocument } from '../util/dom';
import { Widget } from '../widget/widget';

export class ProxyContainerWidget extends Widget<HTMLDivElement> {
    constructor() {
        super(getDocument().createElement('div'));
    }

    protected override destructor() {
        this.getElement().remove();
    }
}

export class ProxyElementWidget<
    R extends { remove(): void },
    T extends HTMLElement = R extends HTMLElement ? R : HTMLElement,
> extends Widget<T> {
    constructor(
        public readonly remover: R,
        public readonly nativeElement: T
    ) {
        super(nativeElement);
    }

    protected destructor() {
        this.remover.remove();
    }

    public static fromHTML<T extends HTMLElement>(nativeElement: T): ProxyElementWidget<T, T> {
        return new ProxyElementWidget(nativeElement, nativeElement);
    }
}
