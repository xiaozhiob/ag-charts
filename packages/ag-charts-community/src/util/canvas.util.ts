import { createElement } from './dom';

export function createCanvasContext(width = 0, height = 0) {
    const canvas = createElement('canvas');
    // Safari needs a width and height set before calling getContext or the output can appear blurry
    // Must also be `display: block` so the height doesn't get increased by `inline-block` layout
    canvas.style.display = 'block';
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}
