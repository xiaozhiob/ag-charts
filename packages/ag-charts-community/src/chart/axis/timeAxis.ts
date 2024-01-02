import type { ModuleContext } from '../../module/moduleContext';
import { TimeScale } from '../../scale/timeScale';
import { extent } from '../../util/array';
import { Default } from '../../util/default';
import { AND, DATE_OR_DATETIME_MS, GREATER_THAN, LESS_THAN, NAN, NUMBER, OR, Validate } from '../../util/validation';
import { AxisTick } from './axisTick';
import { CartesianAxis } from './cartesianAxis';

const MAX_SPACING = OR(AND(NUMBER.restrict({ min: 1 }), GREATER_THAN('minSpacing')), NAN);

class TimeAxisTick extends AxisTick<TimeScale, number | Date> {
    @Validate(MAX_SPACING)
    @Default(NaN)
    override maxSpacing: number = NaN;
}

export class TimeAxis extends CartesianAxis<TimeScale, number | Date> {
    static className = 'TimeAxis';
    static type = 'time' as const;

    private datumFormat = '%m/%d/%y, %H:%M:%S';
    private datumFormatter: (date: Date) => string;

    constructor(moduleCtx: ModuleContext) {
        super(moduleCtx, new TimeScale());

        const { scale } = this;
        this.refreshScale();

        this.datumFormatter = scale.tickFormat({
            specifier: this.datumFormat,
        });
    }

    @Validate(AND(DATE_OR_DATETIME_MS, LESS_THAN('max')), { optional: true })
    min?: Date | number = undefined;

    @Validate(AND(DATE_OR_DATETIME_MS, GREATER_THAN('min')), { optional: true })
    max?: Date | number = undefined;

    override normaliseDataDomain(d: Date[]) {
        let { min, max } = this;
        let clipped = false;

        if (typeof min === 'number') {
            min = new Date(min);
        }
        if (typeof max === 'number') {
            max = new Date(max);
        }

        if (d.length > 2) {
            d = (extent(d) ?? [0, 1000]).map((x) => new Date(x));
        }
        if (min instanceof Date) {
            clipped ||= min > d[0];
            d = [min, d[1]];
        }
        if (max instanceof Date) {
            clipped ||= max < d[1];
            d = [d[0], max];
        }
        if (d[0] > d[1]) {
            d = [];
        }

        return { domain: d, clipped };
    }

    protected override createTick() {
        return new TimeAxisTick();
    }

    protected override onLabelFormatChange(ticks: any[], format?: string) {
        if (format) {
            super.onLabelFormatChange(ticks, format);
        } else {
            // For time axis labels to look nice, even if date format wasn't set.
            this.labelFormatter = this.scale.tickFormat({ ticks });
        }
    }

    override formatDatum(datum: Date): string {
        return this.moduleCtx.callbackCache.call(this.datumFormatter, datum) ?? String(datum);
    }

    override calculatePadding(_min: number, _max: number, reverse: boolean): [number, number] {
        // numbers in domain correspond to Unix timestamps
        // automatically expand domain by 1 in forward direction
        return reverse ? [1, 0] : [0, 1];
    }
}
