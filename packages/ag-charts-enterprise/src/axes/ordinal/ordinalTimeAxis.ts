import { _ModuleSupport } from 'ag-charts-community';

const { dateToNumber, OrdinalTimeScale } = _ModuleSupport;

export class OrdinalTimeAxis extends _ModuleSupport.CategoryAxis<_ModuleSupport.OrdinalTimeScale> {
    static override readonly className = 'OrdinalTimeAxis' as const;
    static override readonly type = 'ordinal-time' as const;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super(moduleCtx, new OrdinalTimeScale());
    }

    private datesSortOrder(d: Date[]): 1 | -1 | undefined {
        if (d.length === 0) return 1;

        const sortOrder: 1 | -1 = Number(d[d.length - 1]) > Number(d[0]) ? 1 : -1;
        let v0 = -Infinity * sortOrder;
        for (const v of d) {
            const v1 = Number(v);
            if (Math.sign(v1 - v0) !== sortOrder) return;
            v0 = v1;
        }
        return sortOrder;
    }

    private _cachedDataDomain: { d: Date[]; domain: Date[] } | undefined;
    override normaliseDataDomain(d: Date[]) {
        if (this._cachedDataDomain?.d === d) {
            const { domain } = this._cachedDataDomain;
            return { domain, clipped: false };
        }

        const sortOrder = this.datesSortOrder(d);

        if (sortOrder != null) {
            const domain = d.slice();
            if (sortOrder === -1) domain.reverse();

            this._cachedDataDomain = { d, domain };

            return { domain, clipped: false };
        }

        this._cachedDataDomain = undefined;

        const domain = [];
        const uniqueValues = new Set();
        for (let v of d) {
            if (typeof v === 'number') {
                v = new Date(v);
            }
            const key = dateToNumber(v);
            if (!uniqueValues.has(key)) {
                uniqueValues.add(key);
                // Only add unique values
                domain.push(v);
            }
        }

        domain.sort((a, b) => dateToNumber(a) - dateToNumber(b));

        return { domain, clipped: false };
    }

    protected override onFormatChange(ticks: any[], fractionDigits: number, domain: any[], format?: string) {
        if (format) {
            super.onFormatChange(ticks, fractionDigits, domain, format);
        } else {
            // For time axis labels to look nice, even if date format wasn't set.
            this.labelFormatter = this.scale.tickFormat({ ticks, domain });
        }
    }
}
