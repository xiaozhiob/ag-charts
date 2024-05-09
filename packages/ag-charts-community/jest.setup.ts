import { expect } from '@jest/globals';
import { CanvasRenderingContext2D } from 'canvas';
import { type MatchImageSnapshotOptions, toMatchImageSnapshot } from 'jest-image-snapshot';
import { Path2D, applyPath2DToCanvasRenderingContext } from 'path2d';
import { TextDecoder, TextEncoder } from 'util';

import { toMatchImage } from './src/chart/test/utils';

// @ts-expect-error
global.Path2D = Path2D;

// @ts-expect-error
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

applyPath2DToCanvasRenderingContext(CanvasRenderingContext2D);

declare module 'expect' {
    interface Matchers<R> {
        toMatchImage(expected: Buffer, options?: { writeDiff: boolean }): R;
        toMatchImageSnapshot(options?: MatchImageSnapshotOptions): R;
    }
}

expect.extend({ toMatchImageSnapshot, toMatchImage });
