type Destroyable = { destroy(): void };

class DestroyableArray<T extends Destroyable> {
    private array: T[] = [];

    destroy() {
        this.array.forEach((e) => e.destroy());
        this.array.length = 0;
    }
}

interface IWidget extends Destroyable {
    destroy(): void;
}

export abstract class Widget<TChild extends IWidget = IWidget> implements IWidget {
    private readonly children = new DestroyableArray<TChild>();

    public constructor(protected readonly elem: Element & ElementCSSInlineStyle) {}

    protected abstract destructor(): void;

    destroy() {
        this.children.destroy();
        this.destructor();
    }
}
