import { expect } from '@jest/globals';
import { CanvasRenderingContext2D } from 'canvas';
import { type MatchImageSnapshotOptions, toMatchImageSnapshot } from 'jest-image-snapshot';
import { Path2D, applyPath2DToCanvasRenderingContext } from 'path2d';
import { URL } from 'url';
import { TextDecoder, TextEncoder } from 'util';

import { toMatchImage } from './src/chart/test/utils';

global.Blob = Blob;

// @ts-expect-error types don't exactly align
global.Path2D = Path2D;

// @ts-expect-error types don't exactly align
global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

// @ts-expect-error types don't exactly align
global.URL = URL;

applyPath2DToCanvasRenderingContext(CanvasRenderingContext2D);

declare module 'expect' {
    interface Matchers<R> {
        toMatchImage(expected: Buffer, options?: { writeDiff: boolean }): R;
        toMatchImageSnapshot(options?: MatchImageSnapshotOptions): R;
    }
}

expect.extend({ toMatchImageSnapshot, toMatchImage });
