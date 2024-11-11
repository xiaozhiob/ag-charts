import { createElement } from '../util/dom';
import { toIterable } from '../util/iterator';
import type { Node, RenderContext } from './node';

type RenderSpriteOptions = { scale: number; translateX: number; translateY: number };

export type SpriteDimensions = {
    spritePixelRatio: number;
    spriteAAPadding: number;
    spriteWidth: number;
    spriteHeight: number;
    markerWidth: number;
};

export class SpriteRenderer {
    public static offscreenCanvasCount = 0;
    private readonly offscreenCanvas: HTMLCanvasElement | OffscreenCanvas;
    private readonly renderCtx: RenderContext;

    constructor() {
        // Safari 16 support
        this.offscreenCanvas =
            typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(0, 0) : createElement('canvas');
        SpriteRenderer.offscreenCanvasCount++;

        const ctx = this.offscreenCanvas.getContext('2d');
        if (ctx == null) throw new TypeError(`AG Charts - invalid 2d context`);
        this.renderCtx = {
            ctx,
            devicePixelRatio: 1,
            forceRender: true,
            resized: false,
            debugNodes: {},
        };
    }

    resize({ spritePixelRatio, spriteWidth, spriteHeight }: SpriteDimensions) {
        this.offscreenCanvas.width = Math.max(spriteWidth, 0) * spritePixelRatio;
        this.offscreenCanvas.height = Math.max(spriteHeight, 0) * spritePixelRatio;
    }

    renderSprite(nodes: Node | Iterable<Node>, opts?: RenderSpriteOptions) {
        nodes = toIterable(nodes);
        const {
            renderCtx,
            renderCtx: { ctx },
            offscreenCanvas,
        } = this;
        const { scale = 1, translateX = 0, translateY = 0 } = opts ?? {};

        ctx.resetTransform();
        ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);
        ctx.save();
        ctx.beginPath();
        ctx.setTransform(scale, 0, 0, scale, translateX, translateY);
        for (const node of nodes) {
            node.preRender();
            node.render(renderCtx);
        }
        ctx.closePath();
        ctx.restore();

        if ('transferToImageBitmap' in this.offscreenCanvas) {
            return this.offscreenCanvas.transferToImageBitmap();
        }

        // Safari 16 support
        // This is the only synchronous way to provide an argument to drawImage
        // See notes in hdpiCanvas
        const canvas = createElement('canvas');
        canvas.style.display = 'block';
        canvas.style.width = offscreenCanvas.width + 'px';
        canvas.style.height = offscreenCanvas.height + 'px';
        canvas
            .getContext('2d')
            ?.putImageData(ctx.getImageData(0, 0, offscreenCanvas.width, offscreenCanvas.height), 0, 0);
        return canvas;
    }
}
