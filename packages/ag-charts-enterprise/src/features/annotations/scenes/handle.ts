import { _ModuleSupport } from 'ag-charts-community';

type InvariantHandleStyles = { x: number; y: number } & {
    [K in keyof _ModuleSupport.Circle]?: _ModuleSupport.Circle[K];
};
type UnivariantHandleStyles = { x: number; y: number } & { [K in keyof _ModuleSupport.Rect]?: _ModuleSupport.Rect[K] };
type DivariantHandleStyles = { x: number; y: number } & {
    [K in keyof _ModuleSupport.Circle]?: _ModuleSupport.Circle[K];
};

export abstract class Handle extends _ModuleSupport.Group {
    public static readonly HANDLE_SIZE: number;
    public static readonly GLOW_SIZE: number;
    public static readonly INACTIVE_STROKE_WIDTH = 2;

    abstract handle: _ModuleSupport.Rect | _ModuleSupport.Circle;
    protected abstract glow: _ModuleSupport.Rect | _ModuleSupport.Circle;
    protected active = false;
    protected locked = false;

    override visible = false;
    override zIndex = 1;

    public abstract update(styles: {
        [K in keyof (_ModuleSupport.Rect | _ModuleSupport.Circle)]?: (_ModuleSupport.Rect | _ModuleSupport.Circle)[K];
    }): void;

    public drag(target: _ModuleSupport.Vec2): { point: _ModuleSupport.Vec2; offset: _ModuleSupport.Vec2 } {
        const { handle, locked } = this;

        if (locked) {
            return { point: { x: handle.x, y: handle.y }, offset: { x: 0, y: 0 } };
        }
        return {
            point: target,
            offset: { x: target.x - handle.x, y: target.y - handle.y },
        };
    }

    public toggleActive(active: boolean) {
        this.active = active;
        if (!active) {
            this.handle.strokeWidth = Handle.INACTIVE_STROKE_WIDTH;
        }
    }

    public toggleHovered(hovered: boolean) {
        this.glow.visible = !this.locked && hovered;
        this.glow.dirtyPath = true;
    }

    public toggleDragging(dragging: boolean): void {
        if (this.locked) return;

        this.handle.visible = !dragging;
        this.glow.visible = this.glow.visible && !dragging;
        this.handle.dirtyPath = true;
        this.glow.dirtyPath = true;
    }

    public toggleLocked(locked: boolean) {
        this.locked = locked;
    }

    public getCursor(): string | undefined {
        return undefined;
    }

    override containsPoint(x: number, y: number) {
        return this.handle.containsPoint(x, y);
    }
}

class InvariantHandle extends Handle {
    static override readonly HANDLE_SIZE = 7;
    static override readonly GLOW_SIZE = 9;

    override handle = new _ModuleSupport.Circle();
    override glow = new _ModuleSupport.Circle();

    constructor() {
        super();
        this.append([this.handle]);

        this.handle.size = InvariantHandle.HANDLE_SIZE;
        this.handle.strokeWidth = Handle.INACTIVE_STROKE_WIDTH;
        this.handle.zIndex = 2;
    }

    override update(styles: InvariantHandleStyles) {
        this.handle.setProperties({ ...styles, strokeWidth: Handle.INACTIVE_STROKE_WIDTH });
    }

    override drag(target: _ModuleSupport.Vec2): { point: _ModuleSupport.Vec2; offset: _ModuleSupport.Vec2 } {
        return { point: target, offset: { x: 0, y: 0 } };
    }
}

export class UnivariantHandle extends Handle {
    static override readonly HANDLE_SIZE = 12;
    static override readonly GLOW_SIZE = 16;
    static readonly CORNER_RADIUS = 4;

    override handle = new _ModuleSupport.Rect();
    override glow = new _ModuleSupport.Rect();

    public gradient: 'horizontal' | 'vertical' = 'horizontal';

    private cachedStyles?: UnivariantHandleStyles;

    constructor() {
        super();
        this.append([this.glow, this.handle]);

        this.handle.cornerRadius = UnivariantHandle.CORNER_RADIUS;
        this.handle.width = UnivariantHandle.HANDLE_SIZE;
        this.handle.height = UnivariantHandle.HANDLE_SIZE;
        this.handle.strokeWidth = Handle.INACTIVE_STROKE_WIDTH;
        this.handle.zIndex = 2;

        this.glow.cornerRadius = UnivariantHandle.CORNER_RADIUS;
        this.glow.width = UnivariantHandle.GLOW_SIZE;
        this.glow.height = UnivariantHandle.GLOW_SIZE;
        this.glow.strokeWidth = 0;
        this.glow.fillOpacity = 0.2;
        this.glow.zIndex = 1;
        this.glow.visible = false;
    }

    override toggleLocked(locked: boolean): void {
        super.toggleLocked(locked);

        if (locked) {
            const offset = (UnivariantHandle.HANDLE_SIZE - InvariantHandle.HANDLE_SIZE) / 2;
            this.handle.cornerRadius = 1;
            this.handle.fill = this.handle.stroke;
            this.handle.strokeWidth = 0;
            this.handle.x += offset;
            this.handle.y += offset;
            this.handle.width = InvariantHandle.HANDLE_SIZE;
            this.handle.height = InvariantHandle.HANDLE_SIZE;
            this.glow.width = InvariantHandle.GLOW_SIZE;
            this.glow.height = InvariantHandle.GLOW_SIZE;
        } else {
            this.handle.cornerRadius = UnivariantHandle.CORNER_RADIUS;
            this.handle.width = UnivariantHandle.HANDLE_SIZE;
            this.handle.height = UnivariantHandle.HANDLE_SIZE;
            this.glow.width = UnivariantHandle.GLOW_SIZE;
            this.glow.height = UnivariantHandle.GLOW_SIZE;
            if (this.cachedStyles) {
                this.handle.setProperties(this.cachedStyles);
            }
        }
    }

    override update(styles: UnivariantHandleStyles) {
        this.cachedStyles = { ...styles };

        if (!this.active) {
            delete styles.strokeWidth;
        }

        if (this.locked) {
            delete styles.fill;
            delete styles.strokeWidth;

            const offset = (UnivariantHandle.HANDLE_SIZE - InvariantHandle.HANDLE_SIZE) / 2;
            styles.x -= offset;
            styles.y -= offset;
            this.cachedStyles.x -= offset;
            this.cachedStyles.y -= offset;
        }

        this.handle.setProperties(styles);
        this.glow.setProperties({
            ...styles,
            x: (styles.x ?? this.glow.x) - 2,
            y: (styles.y ?? this.glow.y) - 2,
            strokeWidth: 0,
            fill: styles.stroke,
        });
    }

    override drag(target: _ModuleSupport.Vec2) {
        if (this.locked) {
            return { point: target, offset: { x: 0, y: 0 } };
        }

        if (this.gradient === 'vertical') {
            return {
                point: { x: target.x, y: this.handle.y },
                offset: { x: target.x - this.handle.x, y: 0 },
            };
        }
        return {
            point: { x: this.handle.x, y: target.y },
            offset: { x: 0, y: target.y - this.handle.y },
        };
    }

    override getCursor() {
        if (this.locked) return;
        return this.gradient === 'vertical' ? 'col-resize' : 'row-resize';
    }
}

export class DivariantHandle extends Handle {
    static override readonly HANDLE_SIZE = 11;
    static override readonly GLOW_SIZE = 17;

    override handle = new _ModuleSupport.Circle();
    override glow = new _ModuleSupport.Circle();

    private cachedStyles?: DivariantHandleStyles;

    constructor() {
        super();
        this.append([this.glow, this.handle]);

        this.handle.size = DivariantHandle.HANDLE_SIZE;
        this.handle.strokeWidth = Handle.INACTIVE_STROKE_WIDTH;
        this.handle.zIndex = 2;

        this.glow.size = DivariantHandle.GLOW_SIZE;
        this.glow.strokeWidth = 0;
        this.glow.fillOpacity = 0.2;
        this.glow.zIndex = 1;
        this.glow.visible = false;
    }

    override toggleLocked(locked: boolean): void {
        super.toggleLocked(locked);

        if (locked) {
            this.handle.fill = this.handle.stroke;
            this.handle.strokeWidth = 0;
            this.handle.size = InvariantHandle.HANDLE_SIZE;
            this.glow.size = InvariantHandle.GLOW_SIZE;
        } else {
            this.handle.size = DivariantHandle.HANDLE_SIZE;
            this.glow.size = DivariantHandle.GLOW_SIZE;
            if (this.cachedStyles) {
                this.handle.setProperties(this.cachedStyles);
            }
        }
    }

    override update(styles: DivariantHandleStyles) {
        this.cachedStyles = { ...styles };

        if (!this.active) {
            delete styles.strokeWidth;
        }

        if (this.locked) {
            delete styles.fill;
            delete styles.strokeWidth;
        }

        this.handle.setProperties(styles);
        this.glow.setProperties({ ...styles, strokeWidth: 0, fill: styles.stroke });
    }

    override getCursor() {
        return 'pointer';
    }
}
