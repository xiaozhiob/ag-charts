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
