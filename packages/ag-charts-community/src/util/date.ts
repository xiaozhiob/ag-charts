export function datesSortOrder(d: Date[]): 1 | -1 | undefined {
    if (d.length === 0) return 1;

    const sign: 1 | -1 = Number(d[d.length - 1]) > Number(d[0]) ? 1 : -1;
    let v0 = -Infinity * sign;
    for (const v of d) {
        const v1 = Number(v);
        if (Math.sign(v1 - v0) !== sign) return;
        v0 = v1;
    }
    return sign;
}
