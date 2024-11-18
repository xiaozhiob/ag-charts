import { _ModuleSupport } from 'ag-charts-community';

const { dateToNumber, datesSortOrder, OrdinalTimeScale } = _ModuleSupport;

export class OrdinalTimeAxis extends _ModuleSupport.CategoryAxis<_ModuleSupport.OrdinalTimeScale> {
    static override readonly className = 'OrdinalTimeAxis' as const;
    static override readonly type = 'ordinal-time' as const;

    constructor(moduleCtx: _ModuleSupport.ModuleContext) {
        super(moduleCtx, new OrdinalTimeScale());
    }

    private _cachedDataDomain: { d: Date[]; domain: Date[] } | undefined;
    override normaliseDataDomain(d: Date[]) {
        if (this._cachedDataDomain?.d === d) {
            const { domain } = this._cachedDataDomain;
            return { domain, clipped: false };
        }

        const sortOrder = datesSortOrder(d);

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
