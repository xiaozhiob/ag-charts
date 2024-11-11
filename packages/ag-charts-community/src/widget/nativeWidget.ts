import { Widget } from './widget';

export class NativeWidget<TElem extends HTMLElement = HTMLElement> extends Widget<TElem> {
    constructor(elem: TElem) {
        super(elem);
    }
    protected destructor() {} // NOSONAR
}
