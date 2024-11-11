import type { RenderContext } from './node';
import { Node, RedrawType, SceneChangeDetection } from './node';

export class Image extends Node {
    constructor(private sourceImage?: HTMLImageElement | ImageBitmap | HTMLCanvasElement) {
        super();
    }

    updateBitmap(
        newBitmap: HTMLImageElement | ImageBitmap | HTMLCanvasElement,
        bitmapPixelRatio: number,
        x: number,
        y: number
    ) {
        this.sourceImage = newBitmap;
        this.width = newBitmap.width / bitmapPixelRatio;
        this.height = newBitmap.height / bitmapPixelRatio;
        this.x = x / bitmapPixelRatio;
        this.y = y / bitmapPixelRatio;
        this.markDirty(RedrawType.MAJOR);
    }

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    x: number = 0;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    y: number = 0;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    width: number = 0;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    height: number = 0;

    @SceneChangeDetection({ redraw: RedrawType.MAJOR })
    opacity: number = 1;

    override render(renderCtx: RenderContext): void {
        const { ctx, forceRender, stats } = renderCtx;

        if (this.dirty === RedrawType.NONE && !forceRender) {
            if (stats) stats.nodesSkipped++;
            return;
        }
        const image = this.sourceImage;
        if (!image) return;

        ctx.globalAlpha = this.opacity;
        ctx.drawImage(image, 0, 0, image.width, image.height, this.x, this.y, this.width, this.height);

        super.render(renderCtx);
    }
}
