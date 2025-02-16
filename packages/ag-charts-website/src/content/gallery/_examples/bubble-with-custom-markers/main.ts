import {
    AgCartesianSeriesTooltipRendererParams,
    AgChartOptions,
    AgCharts,
    AgMarkerShapeFnParams,
} from 'ag-charts-enterprise';

import { getData } from './data';

const data = getData();
const seasons = ['Spring', 'Summer', 'Autumn', 'Winter'];

function rainDrop({ x, y, path, size }: AgMarkerShapeFnParams) {
    path.clear();

    const halfSize = size / 2;
    const quarterSize = size / 4;
    const startX = x;
    const startY = y - quarterSize;

    path.moveTo(startX, startY);

    path.cubicCurveTo(startX, y, x - halfSize, y + halfSize, x, y + quarterSize + halfSize);
    path.cubicCurveTo(x + halfSize, y + halfSize, x, y, startX, startY);

    path.closePath();
}

const formatNumber = (value: number) => {
    return `${Math.round(value)}mm`;
};

const tooltip = {
    renderer: ({ datum, xKey, yKey }: AgCartesianSeriesTooltipRendererParams) => {
        const season = seasons[Math.round(datum[xKey]) - 1];
        return {
            title: season,
            content: `Volume: ${formatNumber(datum[yKey])}`,
        };
    },
};

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    title: {
        text: 'Rainfall',
    },
    subtitle: {
        text: 'Volume of rainfall in millimeters on rainy days by season',
    },
    data,
    series: [
        {
            type: 'bubble',
            xKey: 'x',
            xName: 'Season',
            yKey: 'y',
            sizeKey: 'y',
            size: 3,
            maxSize: 25,
            shape: rainDrop,
            tooltip,
        },
    ],
    axes: [
        {
            type: 'number',
            position: 'bottom',
            interval: { values: [1, 2, 3, 4] },
            label: {
                formatter: ({ value }) => seasons[value - 1] ?? '',
            },
            crosshair: {
                enabled: false,
            },
            crossLines: [
                {
                    type: 'range',
                    range: [0.5, 1.5],
                    strokeWidth: 0,
                    fillOpacity: 0.05,
                },
                {
                    type: 'range',
                    range: [2.5, 3.5],
                    strokeWidth: 0,
                    fillOpacity: 0.05,
                },
            ],
        },
        {
            type: 'number',
            position: 'left',
            gridLine: {
                enabled: false,
            },
            label: {
                enabled: false,
            },
            crosshair: {
                label: {
                    renderer: ({ value }) =>
                        `<div style="padding: 0 7px; border-radius: 2px; line-height: 1.7em; background-color: rgb(71,71,71); color: rgb(255, 255, 255);">${formatNumber(value)}</div>`,
                },
            },
        },
    ],
};

AgCharts.create(options);
