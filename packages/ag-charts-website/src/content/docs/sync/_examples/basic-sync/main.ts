import { AgChartOptions, AgCharts } from 'ag-charts-enterprise';

import { AAPL, MSFT } from './data';

const commonOptions: AgChartOptions = {
    minWidth: 0,
    minHeight: 0,
    series: [
        {
            type: 'line',
            xKey: 'date',
            yKey: 'value',
            tooltip: {
                renderer: ({ datum, xKey, yKey }) => {
                    const { [xKey]: xValue, [yKey]: yValue } = datum;
                    const dateFormatted = xValue.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                    });
                    return { content: `${dateFormatted}: \$${yValue}` };
                },
            },
        },
    ],
    sync: {
        enabled: true,
        axes: 'x',
        nodeInteraction: true,
    },
    zoom: {
        enabled: true,
        enableSelecting: true,
    },
    axes: [
        {
            type: 'time',
            position: 'bottom',
            nice: false,
            interval: {
                maxSpacing: 180,
            },
            crosshair: {
                label: {
                    format: '%d %b %Y',
                },
            },
        },
        {
            type: 'number',
            position: 'left',
            label: {
                format: '$~s',
            },
        },
    ],
};

const chartOptions1: AgChartOptions = {
    ...commonOptions,
    container: document.getElementById('myChart1'),
    data: AAPL,
    title: {
        text: 'Apple (AAPL)',
        textAlign: 'left',
    },
};

AgCharts.create(chartOptions1);

const chartOptions2: AgChartOptions = {
    ...commonOptions,
    container: document.getElementById('myChart2'),
    data: MSFT,
    title: {
        text: 'Microsoft (MSFT)',
        textAlign: 'left',
    },
    initialState: {
        zoom: {
            ratioX: { start: 0.8, end: 1 },
        },
    },
};

AgCharts.create(chartOptions2);
