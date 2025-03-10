import type {
    AgCartesianSeriesTooltipRendererParams,
    AgChartOptions,
    AgTooltipRendererResult,
} from 'ag-charts-community';
import { AgCharts, time } from 'ag-charts-community';

import { getData } from './data';

const dateFormatter = new Intl.DateTimeFormat('en-US');
const tooltip = {
    renderer: ({ title, datum, xKey, yKey }: AgCartesianSeriesTooltipRendererParams): AgTooltipRendererResult => ({
        title,
        content: `${dateFormatter.format(datum[xKey])}: ${datum[yKey]}`,
    }),
};

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    theme: {
        overrides: {
            line: {
                series: {
                    highlightStyle: {
                        series: {
                            strokeWidth: 3,
                            dimOpacity: 0.2,
                        },
                    },
                },
            },
        },
    },
    title: {
        text: 'Road fuel prices',
        fontSize: 18,
        spacing: 25,
    },
    footnote: {
        text: 'Source: Department for Business, Energy & Industrial Strategy',
    },
    series: [
        {
            type: 'line',
            xKey: 'date',
            yKey: 'petrol',
            stroke: '#01c185',
            marker: {
                stroke: '#01c185',
                fill: '#01c185',
            },
            tooltip,
        },
        {
            type: 'line',
            xKey: 'date',
            yKey: 'diesel',
            stroke: '#000000',
            marker: {
                stroke: '#000000',
                fill: '#000000',
            },
            tooltip,
        },
    ],
    axes: [
        {
            type: 'time',
            position: 'bottom',
            interval: {
                step: time.month.every(2),
            },
            title: {
                text: 'Date',
            },
            label: {
                autoRotate: true,
            },
        },
        {
            type: 'number',
            position: 'left',
            title: {
                text: 'Price in pence',
            },
            label: {
                autoRotate: true,
            },
        },
    ],
};

const chart = AgCharts.create(options);
