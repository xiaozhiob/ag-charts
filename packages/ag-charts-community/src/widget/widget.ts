import {
    type BaseAttributeTypeMap,
    type BaseStyleTypeMap,
    setAttribute,
    setElementStyle,
    setElementStyles,
} from '../util/attributeUtil';
import type { BBoxValues } from '../util/bboxinterface';
import { getElementBBox, getWindow, setElementBBox } from '../util/dom';
import type { WidgetEventMap } from './widgetEvents';
import { WidgetListenerMap } from './widgetListenerMap';

interface IWidget<TElement extends HTMLElement> {
    index: number;
    destroy(): void;
    getElement(): TElement;
}

abstract class WidgetBounds {
    protected readonly elem: HTMLElement;
    protected elemContainer?: HTMLDivElement;
    constructor(elem: HTMLElement) {
        this.elem = elem;
    }

    setBounds(bounds: BBoxValues): void {
        setElementBBox(this.elemContainer ?? this.elem, bounds);
    }

    getBounds(): BBoxValues {
        return getElementBBox(this.elemContainer ?? this.elem);
    }

    protected static setElementContainer(widget: WidgetBounds, elemContainer: HTMLDivElement) {
        const currentBounds = widget.getBounds();
        setElementBBox(elemContainer, currentBounds);
        setElementStyles(widget.elem, { width: '100%', height: '100%' });
        widget.elem.remove();
        widget.elemContainer = elemContainer;
        widget.elemContainer.replaceChildren(widget.elem);
    }
}

export abstract class Widget<
        TElement extends HTMLElement = HTMLElement,
        TChildWidget extends IWidget<HTMLElement> = IWidget<HTMLElement>,
    >
    extends WidgetBounds
    implements IWidget<TElement>
{
    public index: number = NaN;

    protected readonly children: TChildWidget[] = [];

    constructor(protected override readonly elem: TElement) {
        super(elem);
    }

    protected abstract destructor(): void;

    protected setElementContainer(widget: WidgetBounds, elemContainer: HTMLDivElement) {
        WidgetBounds.setElementContainer(widget, elemContainer);
    }

    getElement(): TElement {
        return this.elem;
    }

    destroy(): void {
        this.children.forEach((child) => child.destroy());
        this.destructor();
        this.elem.remove();
        this.elemContainer?.remove();
        this.map?.destroy(this);
    }

    setHidden(hidden: boolean): void {
        setElementStyle(this.elem, 'display', hidden ? 'none' : undefined);
    }

    isHidden(): boolean {
        return getWindow()?.getComputedStyle?.(this.elem).display === 'none';
    }

    setCursor(cursor: BaseStyleTypeMap['cursor'] | undefined) {
        setElementStyle(this.elem, 'cursor', cursor);
    }

    cssLeft(): number {
        return parseFloat(this.elem.style.left);
    }
    cssTop(): number {
        return parseFloat(this.elem.style.top);
    }

    focus(): void {
        this.elem.focus();
    }

    setPreventsDefault(preventDefault: boolean) {
        setAttribute(this.elem, 'data-preventdefault', preventDefault);
    }

    setTabIndex(tabIndex: BaseAttributeTypeMap['tabindex']) {
        setAttribute(this.elem, 'tabindex', tabIndex);
    }

    protected appendChildToDOM(child: TChildWidget) {
        this.elem.appendChild(child.getElement());
    }
    appendChild(child: TChildWidget) {
        this.appendChildToDOM(child);
        this.children.push(child);
        child.index = this.children.length - 1;
        this.onChildAdded(child);
    }
    protected onChildAdded(_child: TChildWidget): void {}

    protected removeChildFromDOM(child: TChildWidget): void {
        this.elem.removeChild(child.getElement());
    }
    protected onChildRemoved(_child: TChildWidget): void {}

    protected map?: WidgetListenerMap<typeof this>;

    addListener<K extends keyof WidgetEventMap>(
        type: K,
        listener: (target: typeof this, ev: WidgetEventMap[K]) => unknown
    ) {
        this.map ??= new WidgetListenerMap();
        this.map.add(type, this, listener);
    }

    removeListener<K extends keyof WidgetEventMap>(
        type: K,
        listener: (target: typeof this, ev: WidgetEventMap[K]) => unknown
    ) {
        this.map?.remove(type, this, listener);
    }
}
