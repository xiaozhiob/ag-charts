/* eslint-disable @typescript-eslint/unbound-method */
import { Canvas, Image, CanvasRenderingContext2D as NodeCanvasRenderingContext2D, createCanvas } from 'canvas';

import { ConicGradient } from './conicGradient';
import { mockCanvasText } from './mock-canvas-text';

// node-canvas does not support createImageBitmap() yet (https://github.com/Automattic/node-canvas/issues/876).
// However, the Canvas.drawImage(img,...) method does accept a Canvas-type img parameter. So use as new Canvas
// as an ImageBitmap.
Object.defineProperty(Canvas.prototype, 'transferToImageBitmap', {
    value: function transferToImageBitmap() {
        const { width, height } = this;
        const bitmap = new Canvas(width, height);
        bitmap.getContext('2d').drawImage(this, 0, 0, width, height);
        return bitmap;
    },
    enumerable: false,
    writable: true,
    configurable: true,
});

Object.defineProperty(NodeCanvasRenderingContext2D.prototype, 'createConicGradient', {
    value: function createConicGradient(startAngle: number, x: number, y: number) {
        return new ConicGradient(this, startAngle, x, y);
    },
    enumerable: false,
    writable: true,
    configurable: true,
});

// https://github.com/Automattic/node-canvas/issues/1852
const context2dTransform = NodeCanvasRenderingContext2D.prototype.transform;
Object.defineProperty(NodeCanvasRenderingContext2D.prototype, 'transform', {
    value: function transform(a: number, b: number, c: number, d: number, e: number, f: number) {
        if (a === 0) {
            context2dTransform.call(this, 1e-6, 0, 0, 1e-6, 0, 0);
            return;
        }

        context2dTransform.call(this, a, b, c, d, e, f);
    },
    enumerable: false,
    writable: true,
    configurable: true,
});

export class MockContext {
    document: Document;
    realCreateElement: Document['createElement'];
    ctx: {
        nodeCanvas: Canvas;
        getRenderContext2D: () => CanvasRenderingContext2D;
        getActiveCanvasInstances: () => Canvas[];
    };
    canvasStack: Canvas[];
    canvases: WeakRef<Canvas>[] = [];

    constructor(
        width: number,
        height: number,
        document: Document,
        realCreateElement: Document['createElement'] = document.createElement
    ) {
        this.document = document;

        const nodeCanvas = createCanvas(width, height);

        this.realCreateElement = realCreateElement;
        this.ctx = {
            nodeCanvas,
            getRenderContext2D: () => this.ctx.nodeCanvas.getContext('2d') as unknown as CanvasRenderingContext2D,
            getActiveCanvasInstances: this.getActiveCanvasInstances.bind(this),
        };
        this.canvasStack = [nodeCanvas];
        this.registerCanvasInstance(nodeCanvas);
    }

    registerCanvasInstance(canvas: Canvas) {
        this.canvases.push(new WeakRef(canvas));
    }

    getActiveCanvasInstances() {
        const instances = this.canvases.map((ref) => ref.deref());
        this.canvases = this.canvases.filter((_ref, index) => instances[index] != null);
        return instances.filter((value): value is NonNullable<typeof value> => value != null);
    }

    destroy() {
        (this as any).ctx.nodeCanvas = undefined;
        (this as any).realCreateElement = undefined;
        this.canvasStack = [];
        this.canvases = [];
    }
}

export function setup(opts: {
    width?: number;
    height?: number;
    document?: Document;
    mockCtx?: MockContext;
    mockText?: boolean;
}) {
    const {
        width = 800,
        height = 600,
        document = window.document,
        mockCtx = new MockContext(width, height, document),
        mockText = false,
    } = opts;
    if (mockText) {
        mockCanvasText();
    }
    const nodeCanvas = createCanvas(width, height);
    mockCtx.ctx.nodeCanvas = nodeCanvas;
    mockCtx.canvasStack = [nodeCanvas];

    if (typeof window !== 'undefined') {
        (window as any)['agChartsSceneRenderModel'] = 'composite';
    } else {
        (global as any)['agChartsSceneRenderModel'] = 'composite';
    }

    const realCreateElement = document.createElement;
    mockCtx.realCreateElement = realCreateElement;

    (document as any).createElement = (element: any, options: any) => {
        if (element === 'canvas') {
            const mockedElement = realCreateElement.call(document, element, options) as HTMLCanvasElement;

            let [nextCanvas] = mockCtx.canvasStack.splice(0, 1);
            if (!nextCanvas) {
                nextCanvas = createCanvas(width, height);
            }
            mockCtx.registerCanvasInstance(nextCanvas);

            mockedElement.getContext = (type: any) => {
                const context2d = nextCanvas.getContext(type, { alpha: true });
                context2d.patternQuality = 'good';
                context2d.quality = 'good';
                context2d.textDrawingMode = 'path';
                context2d.antialias = 'subpixel';

                return context2d as any;
            };

            mockedElement.toDataURL = (mimeType?: 'image/png') => {
                return nextCanvas.toDataURL(mimeType ?? 'image/png');
            };

            return mockedElement;
        } else if (element === 'img') {
            return new Image();
        }

        return realCreateElement.call(document, element, options);
    };

    return mockCtx;
}

export function teardown(mockContext: MockContext) {
    mockContext.document.createElement = mockContext.realCreateElement!;
    mockContext.destroy();
}
