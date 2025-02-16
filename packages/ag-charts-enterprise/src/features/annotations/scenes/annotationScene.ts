import { _ModuleSupport } from 'ag-charts-community';

import { Handle } from './handle';

const { ZIndexMap, isObject } = _ModuleSupport;

export abstract class AnnotationScene extends _ModuleSupport.Group {
    static isCheck(value: unknown, type: string) {
        return isObject(value) && Object.hasOwn(value, 'type') && value.type === type;
    }

    override name = 'AnnotationScene';
    override zIndex = ZIndexMap.CHART_ANNOTATION;

    public abstract type: string;
    public abstract activeHandle?: string;

    abstract override containsPoint(x: number, y: number): boolean;

    public abstract toggleHandles(show: boolean | Record<string, boolean>): void;
    public abstract toggleActive(active: boolean): void;
    public abstract stopDragging(): void;
    public abstract getAnchor(): _ModuleSupport.ToolbarAnchor;
    public abstract getCursor(): string | undefined;
    public abstract getNodeAtCoords(x: number, y: number): string | undefined;

    public toggleHovered(hovered: boolean) {
        this.toggleHandles(hovered);
    }

    private *nonHandleChildren() {
        for (const child of this.children()) {
            if (!(child instanceof Handle)) {
                yield child;
            }
        }
    }

    protected computeBBoxWithoutHandles() {
        return _ModuleSupport.Transformable.toCanvas(
            this,
            _ModuleSupport.Group.computeChildrenBBox(this.nonHandleChildren())
        );
    }
}
