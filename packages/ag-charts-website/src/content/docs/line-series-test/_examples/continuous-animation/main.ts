import { AgCartesianChartOptions, AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { getData } from './data';

const series: NonNullable<AgChartOptions['series']> = [
    {
        type: 'line',
        xKey: 'date',
        yKey: 'petrol',
        marker: {},
        label: {},
    },
    {
        type: 'line',
        xKey: 'date',
        yKey: 'diesel',
        marker: {},
        label: {},
    },
];
const options: AgCartesianChartOptions = {
    container: document.getElementById('myChart'),
    animation: {
        enabled: true,
    },
    legend: {},
    data: getData(),
    series,
    axes: [
        {
            position: 'bottom',
            type: 'time',
        },
        {
            position: 'left',
            type: 'number',
            label: {
                autoRotate: false,
            },
        },
    ],
};

const chart = AgCharts.create(options);

function genDataPoint(ref: Date | { date: Date; petrol: number; diesel: number }, offsetDays: number) {
    const { date, petrol = 120, diesel = 125 } = ref instanceof Date ? { date: ref } : ref;

    return {
        date: new Date(date.getTime() + offsetDays * 3600 * 24 * 1000),
        petrol: petrol + Math.random() * 4 - 2,
        diesel: diesel + Math.random() * 4 - 2,
    };
}

function times<T>(cb: () => T, count: number) {
    const result: T[] = [];
    for (; count > 0; count--) {
        result.push(cb());
    }
    return result;
}

function actionReset() {
    options.data = getData();
    chart.update(options);
}

function actionAddSeries() {
    options.series = [...options.series!, series[options.series!.length % series.length]] as any;
    chart.update(options);
}

function actionRemoveSeries() {
    options.series = options.series!.slice(0, options.series!.length - 1);
    chart.update(options);
}

function actionRemovePoints() {
    options.data = [...(options.data ?? [])];
    options.data.splice(options.data.length / 2 - 5, 10);
    chart.update(options);
}

function actionRemoveFirstPoint() {
    options.data = [...(options.data ?? []).slice(1)];
    chart.update(options);
}

function actionRemoveLastPoint() {
    options.data = [...(options.data ?? []).slice(0, -1)];
    chart.update(options);
}

function actionRemoveHalf() {
    const data = options.data ?? [];
    const { length } = data;
    options.data = data.slice(Math.floor((length * 1) / 4), Math.floor((length * 3) / 4));

    chart.update(options);
}

function actionAddPoints() {
    options.data = [...(options.data ?? [])];
    const { length } = options.data;
    for (const idx of [length / 4, length / 2, (length * 3) / 4]) {
        const dataIdx = Math.floor(idx);
        const [datum, nextDatum] = options.data.slice(dataIdx, dataIdx + 2);

        const date = new Date((datum.date.getTime() + nextDatum.date.getTime()) / 2);
        options.data.splice(dataIdx + 1, 0, genDataPoint({ ...datum, date }, 0));
    }
    chart.update(options);
}

function actionAddPointsBefore() {
    options.data = [...(options.data ?? [])];

    const ref = options.data[0];
    options.data.splice(0, 0, genDataPoint(ref, -14), genDataPoint(ref, -7));
    chart.update(options);
}

function actionAddPointsAfter(count = 2) {
    options.data = [...(options.data ?? [])];

    const [ref] = options.data.slice(-1);
    for (let idx = 0; idx < count; idx++) {
        options.data.push(genDataPoint(ref, (idx + 1) * 7));
    }
    chart.update(options);
}

function actionAddDouble() {
    const data = options.data ?? [];
    const { length } = data;

    const count = Math.ceil(length / 4);
    let start = genDataPoint(data[0], -7 * (count + 1));
    let [end] = data.slice(-1);
    options.data = [
        ...times(() => (start = genDataPoint(start, 7)), count),
        ...data,
        ...times(() => (end = genDataPoint(end, 7)), count),
    ];
    chart.update(options);
}

function actionUpdatePoints() {
    options.data = (options.data ?? []).map((d: any) => ({
        ...d,
        petrol: d.petrol + Math.random() * 4 - 2,
        diesel: d.diesel + Math.random() * 4 - 2,
    }));
    chart.update(options);
}

function actionUpdatePointUndefined() {
    options.data = (options.data ?? []).map((d: any) => ({
        ...d,
        petrol: Math.random() > 0.9 ? undefined : d.petrol,
        diesel: Math.random() > 0.9 ? undefined : d.diesel,
    }));
    chart.update(options);
}

function actionShiftLeft() {
    const data = options.data ?? [];
    const [ref] = data.slice(-1);
    options.data = [...data.slice(1), genDataPoint(ref, 7)];

    chart.update(options);
}

function actionShiftRight() {
    const data = options.data ?? [];
    const [ref] = data.slice(0);
    options.data = [genDataPoint(ref, -7), ...data.slice(0, -1)];

    chart.update(options);
}

let tick: NodeJS.Timeout;
function actionTickStart() {
    if (tick) clearInterval(tick);

    tick = setInterval(() => actionAddPointsAfter(1), 1000);
}

function actionTickStop() {
    if (tick) clearInterval(tick);
}
