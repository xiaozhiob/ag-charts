import { AgCartesianChartOptions, AgCharts } from 'ag-charts-enterprise';

const data = [
    { quarter: 'week 3', week: 3, iphone: 60 },
    { quarter: 'week 4', week: 4, iphone: 185 },
    { quarter: 'week 5', week: 5, iphone: 148 },
    { quarter: 'week 6', week: 6, iphone: 130 },
    { quarter: 'week 9', week: 9, iphone: 62 },
    { quarter: 'week 10', week: 10, iphone: 137 },
    { quarter: 'week 11', week: 11, iphone: 121 },
];

const options: AgCartesianChartOptions = {
    container: document.getElementById('myChart'),
    animation: {
        enabled: true,
    },
    data: [...data],
    series: [
        {
            type: 'line',
            xKey: 'quarter',
            yKey: 'iphone',
            label: {
                formatter: ({ value }) => String(value),
            },
            // visible: false
        },
    ],
    axes: [
        {
            position: 'left',
            type: 'number',
            keys: ['iphone'],
        },
        {
            position: 'bottom',
            type: 'category',
        },
    ],
};

const chart = AgCharts.create(options);

function actionReset() {
    options.data = [...data];
    chart.update(options);
}

function actionAddEndWeek() {
    const data = options.data ?? [];
    const nextWeek = data.slice(-1)[0].week + 1;
    options.data = [
        ...data,
        {
            quarter: `week ${nextWeek}`,
            week: nextWeek,
            iphone: 78 * (Math.random() - 0.5),
        },
    ];
    chart.update(options);
}

function actionAddStartWeek() {
    const data = options.data ?? [];
    const prevWeek = data[0].week - 1;
    options.data = [
        {
            quarter: `week ${prevWeek}`,
            week: prevWeek,
            iphone: 78 * (Math.random() - 0.5),
        },
        ...data,
    ];
    chart.update(options);
}

function actionAddWeek12and13() {
    options.data = [
        ...(options.data ?? []),
        { quarter: 'week 12', week: 12, iphone: 78 },
        { quarter: 'week 13', week: 13, iphone: 138 },
    ];
    options.data.sort((a: any, b: any) => a.week - b.week);
    chart.update(options);
}

function actionAddWeek7and8() {
    options.data = [
        ...(options.data ?? []),
        { quarter: 'week 7', week: 7, iphone: 142 },
        { quarter: 'week 8', week: 8, iphone: 87 },
    ];
    options.data.sort((a: any, b: any) => a.week - b.week);
    chart.update(options);
}

function reorder() {
    options.data = [...(options.data ?? [])];
    options.data?.forEach((d) => (d.random = Math.random()));
    options.data?.sort((a, b) => a.random - b.random);

    chart.update(options);
}

function rapidUpdate() {
    chart.updateDelta({
        data: [...data, { quarter: 'week 12', iphone: 78 }],
    });

    chart.waitForUpdate().then(() => {
        chart.updateDelta({
            data: [...data, { quarter: 'week 12', iphone: 78 }, { quarter: 'week 13', iphone: 138 }],
        });
    });
}
