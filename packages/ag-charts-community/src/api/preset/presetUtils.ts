import { Logger } from '../../util/logger';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function assertEmpty(t: Record<string, never>) {
    const keys = Object.keys(t);
    if (keys.length > 0) {
        Logger.warn(`unexpected options, ignoring these: [${keys.join(',')}]`);
    }
}

export const IGNORED_PROP = Symbol('IGNORED_PROP');

export function pickProps<T>(
    opts: Partial<T>,
    values: { [K in keyof Required<T>]: (T[K] extends Required<T[K]> ? T[K] : T[K] | undefined) | typeof IGNORED_PROP }
) {
    const out: any = {};
    for (const [key, value] of Object.entries(values)) {
        if (value !== IGNORED_PROP && Object.hasOwn(opts as any, key)) {
            out[key] = value;
        }
    }
    return out;
}
