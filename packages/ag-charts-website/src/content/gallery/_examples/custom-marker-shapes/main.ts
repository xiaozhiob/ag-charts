import { AgChartOptions, AgCharts, AgMarkerShapeFnParams, Marker } from 'ag-charts-enterprise';

import { getData } from './data';

const options: AgChartOptions = {
    container: document.getElementById('myChart'),
    data: getData(),
    title: {
        text: 'Taxed Alcohol Consumption (UK)',
    },
    footnote: {
        text: 'Source: HM Revenue & Customs',
    },
    series: [
        {
            type: 'line',
            title: 'Still wine',
            xKey: 'year',
            yKey: 'stillWine',
            marker: {
                shape: 'circle',
            },
        },
        {
            type: 'line',
            title: 'Sparkling wine',
            xKey: 'year',
            yKey: 'sparklingWine',
            marker: {
                shape: 'cross',
            },
        },
        {
            type: 'line',
            title: 'Made-wine',
            xKey: 'year',
            yKey: 'madeWine',
            marker: {
                shape: 'diamond',
            },
        },
        {
            type: 'line',
            title: 'Whisky',
            xKey: 'year',
            yKey: 'whisky',
            marker: {
                shape: 'plus',
            },
        },
        {
            type: 'line',
            title: 'Potable spirits',
            xKey: 'year',
            yKey: 'potableSpirits',
            marker: {
                shape: 'square',
            },
        },
        {
            type: 'line',
            title: 'Beer',
            xKey: 'year',
            yKey: 'beer',
            marker: {
                shape: 'triangle',
            },
        },
        {
            type: 'line',
            title: 'Cider',
            xKey: 'year',
            yKey: 'cider',
            marker: {
                shape: heart,
            },
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'category',
            label: {
                rotation: -30,
            },
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Volume (hectolitres)',
            },
            label: {
                formatter: (params) => {
                    return params.value / 1000000 + 'M';
                },
            },
        },
    ],
};

AgCharts.create(options);

function rad(degree: number) {
    return (degree / 180) * Math.PI;
}

function heart({ x, y, path, size }: AgMarkerShapeFnParams) {
    const r = size / 4;
    const yCoord = y + r / 2;

    path.clear();
    path.arc(x - r, yCoord - r, r, rad(130), rad(330));
    path.arc(x + r, yCoord - r, r, rad(220), rad(50));
    path.lineTo(x, yCoord + r);
    path.closePath();
}
