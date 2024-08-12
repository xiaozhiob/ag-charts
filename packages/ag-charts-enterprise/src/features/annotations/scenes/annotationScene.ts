import { _ModuleSupport, _Scene } from 'ag-charts-community';

import { Handle } from './handle';

const { Layers, isObject } = _ModuleSupport;

export abstract class AnnotationScene extends _Scene.Group {
    static isCheck(value: unknown, type: string) {
        return isObject(value) && Object.hasOwn(value, 'type') && value.type === type;
    }

    override zIndex = Layers.CHART_ANNOTATION_ZINDEX;

    public abstract type: string;
    public abstract activeHandle?: string;

    private cachedBBoxWithoutHandles?: _Scene.BBox;

    abstract override containsPoint(x: number, y: number): boolean;

    public abstract toggleHandles(show: boolean | Record<string, boolean>): void;
    public abstract toggleActive(active: boolean): void;
    public abstract stopDragging(): void;
    public abstract getAnchor(): { x: number; y: number; position?: 'right' | 'above' | 'above-left' };
    public abstract getCursor(): string | undefined;

    public toggleHovered(hovered: boolean) {
        this.toggleHandles(hovered);
    }

    protected getCachedBBoxWithoutHandles() {
        return this.cachedBBoxWithoutHandles ?? _Scene.BBox.zero;
    }

    protected computeBBoxWithoutHandles() {
        return _Scene.TransformableNode.toCanvas(
            this,
            _Scene.Group.computeChildrenBBox(this.children.filter((node) => !(node instanceof Handle)))
        );
    }

    override render(renderCtx: _Scene.RenderContext) {
        super.render(renderCtx);
        this.cachedBBoxWithoutHandles = this.computeBBoxWithoutHandles();
    }
}
