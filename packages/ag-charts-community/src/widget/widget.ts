class DestroyableArray<T extends { destroy(): void }> {
    private array: T[] = [];

    destroy() {
        this.array.forEach((e) => e.destroy());
        this.array.length = 0;
    }
}

export abstract class Widget {
    private children = new DestroyableArray<Widget>();

    constructor() {}

    protected abstract destructor(): void;

    destroy() {
        this.children.destroy();
        this.destructor();
    }
}
