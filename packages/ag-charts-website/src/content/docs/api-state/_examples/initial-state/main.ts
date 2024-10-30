import { AgChartState, AgCharts, AgFinancialChartOptions } from 'ag-charts-enterprise';

import { getData } from './data';

const data = getData();

const options: AgFinancialChartOptions = {
    container: document.getElementById('myChart'),
    data,
    title: {
        text: 'Dow Jones Industrial Average',
    },
    rangeButtons: false,
    navigator: true,
    initialState: {
        zoom: {
            rangeX: {
                start: {
                    __type: 'date',
                    value: new Date('2024-01-01').getTime(),
                },
            },
        },
    },
};

const chart = AgCharts.createFinancialChart(options);

function showThreeMonths() {
    options.initialState!.zoom = {
        rangeX: {
            start: {
                __type: 'date',
                value: data[data.length - 1].date.getTime() - 1000 * 60 * 60 * 24 * 30 * 3,
            },
        },
    };
    chart.update(options);
}

function showYTD() {
    options.initialState!.zoom = {
        rangeX: {
            start: {
                __type: 'date',
                value: new Date('2024-01-01').getTime(),
            },
        },
    };
    chart.update(options);
}

function showAll() {
    options.initialState!.zoom = {};
    chart.update(options);
}
