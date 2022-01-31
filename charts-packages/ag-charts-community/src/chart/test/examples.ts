import { AgChartOptions } from '../agChartOptions';
import * as data from './data';
import month from '../../util/time/month';

export const BAR_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_UK_LABOUR_MARKET_FEB_2020,
    title: {
        text: 'Gross Weekly Earnings by Occupation (Q4 2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            type: 'bar',
            xKey: 'type',
            yKeys: ['earnings'],
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'left',
        },
        {
            type: 'number',
            position: 'bottom',
            title: {
                enabled: true,
                text: '£/week',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const GROUPED_BAR_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_EMPLOYMENT_LABOUR_MARKET_AVERAGE_WEEKLY_EARNINGS,
    title: {
        text: 'Annual Growth in Pay (2018-2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            type: 'bar',
            xKey: 'type',
            yKeys: ['total', 'regular'],
            yNames: ['Annual growth in total pay', 'Annual growth in regular pay'],
            grouped: true,
            fills: ['rgba(0, 117, 163, 0.9)', 'rgba(226, 188, 34, 0.9)'],
            strokes: ['rgba(0, 117, 163, 0.9)', 'rgba(226, 188, 34, 0.9)'],
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'left',
        },
        {
            type: 'number',
            position: 'bottom',
            title: {
                enabled: true,
                text: '%',
            },
        },
    ],
    legend: {
        position: 'bottom',
    },
};

function getTotal(datum: any) {
    return datum.ownerOccupied + datum.privateRented + datum.localAuthority + datum.housingAssociation;
}

export const STACKED_BAR_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_ENGLISH_HOUSING_SURVEY_2016.sort((a, b) => {
        return getTotal(b) - getTotal(a);
    }),
    title: {
        text: 'UK Housing Stock (2016)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Ministry of Housing, Communities & Local Government',
    },
    series: [
        {
            type: 'bar',
            xKey: 'type',
            yKeys: ['ownerOccupied', 'privateRented', 'localAuthority', 'housingAssociation'],
            yNames: ['Owner occupied', 'Private rented', 'Local authority', 'Housing association'],
            highlightStyle: {
                series: {
                    strokeWidth: 3,
                    dimOpacity: 0.3,
                },
            },
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'left',
        },
        {
            type: 'number',
            position: 'top',
        },
    ],
    legend: {
        position: 'bottom',
    },
};

export const ONE_HUNDRED_PERCENT_STACKED_BAR_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_INTERNET_USERS,
    title: {
        text: 'Internet Users by Geographical Location (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            type: 'bar',
            xKey: 'area',
            yKeys: ['usedInLast3Months', 'usedOver3MonthsAgo', 'neverUsed'],
            yNames: ['Used in last 3 months', 'Used over 3 months ago', 'Never used'],
            fills: ['#00c851', '#ffbb33', '#ff4444'],
            strokes: ['#006428', '#996500', '#a10000'],
            normalizedTo: 1,
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'left',
            label: {
                rotation: -30,
            },
        },
        {
            type: 'number',
            position: 'bottom',
            label: {
                format: '.0%',
            },
        },
    ],
};

export const BAR_CHART_WITH_LABELS_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_JOBS_AND_VACANCIES_FEB_2020,
    title: {
        text: 'Change in Number of Jobs in UK (June to September 2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            type: 'bar',
            xKey: 'job',
            yKeys: ['change'],
            fills: ['rgba(0, 117, 163, 0.9)'],
            strokes: ['rgba(0, 117, 163, 0.9)'],
            highlightStyle: {
                item: {
                    fill: '#0ab9ff',
                },
            },
            label: {
                fontWeight: 'bold',
                color: 'white',
                formatter: (params) => (params.value > 0 ? '+' : '') + params.value,
            },
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'left',
        },
        {
            type: 'number',
            position: 'bottom',
            title: {
                enabled: true,
                text: 'Change in number of jobs (thousands)',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const SIMPLE_COLUMN_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_MUSEUMS_AND_GALLERIES_MONTHLY_VISITS,
    title: {
        text: 'Total Visitors to Museums and Galleries',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Digital, Culture, Media & Sport',
    },
    series: [
        {
            type: 'column',
            xKey: 'year',
            yKeys: ['visitors'],
            fills: ['#0084e7'],
            strokes: ['#00407f'],
            shadow: {
                enabled: true,
                xOffset: 3,
            },
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
            title: {
                enabled: true,
                text: 'Year',
            },
        },
        {
            type: 'number',
            position: 'left',
            title: {
                enabled: true,
                text: 'Total visitors',
            },
            label: {
                formatter: function (params) {
                    return params.value / 1000000 + 'M';
                },
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const GROUPED_COLUMN_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_INTERNET_USERS_BY_AGE_GROUP,
    title: {
        text: 'Regular Internet Users',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            type: 'column',
            xKey: 'year',
            yKeys: ['16-24', '25-34', '35-44', '45-54', '55-64', '65-74', '75+'],
            grouped: true,
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
            label: {
                formatter: (params) => params.value / 1000 + 'M',
            },
        },
    ],
};

export const STACKED_COLUMN_GRAPH_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_OPEN_DATA_USERS,
    title: {
        text: 'Average Station Entries: Victoria Line (2010)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Transport for London',
    },
    series: [
        {
            type: 'column',
            xKey: 'station',
            yKeys: ['early', 'morningPeak', 'interPeak', 'afternoonPeak', 'evening'],
            yNames: ['Early', 'Morning peak', 'Between peak', 'Afternoon peak', 'Evening'],
            fills: ['#5BC0EB', '#FDE74C', '#9BC53D', '#E55934', '#FA7921'],
            strokes: ['#4086a4', '#b1a235', '#6c8a2b', '#a03e24', '#af5517'],
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
            label: {
                rotation: 30,
            },
        },
        {
            type: 'number',
            position: 'left',
            label: {
                formatter: function (params) {
                    return params.value / 1000 + 'k';
                },
            },
        },
    ],
    legend: {
        spacing: 40,
        position: 'bottom',
    },
};

export const ONE_HUNDRED_PERCENT_STACKED_COLUMNS_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_SCHOOL_PUPIL_CHARACTERISTICS,
    title: {
        text: 'Ethnic Diversity of School Pupils (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Education',
    },
    series: [
        {
            type: 'column',
            xKey: 'type',
            yKeys: ['white', 'mixed', 'asian', 'black', 'chinese', 'other'],
            yNames: ['White', 'Mixed', 'Asian', 'Black', 'Chinese', 'Other'],
            normalizedTo: 100,
            fills: ['#f1c40f', '#e67e22', '#2ecc71', '#3498db', '#9b59b6', '#34495e'],
            strokes: ['#f39c12', '#d35400', '#27ae60', '#2980b9', '#8e44ad', '#2c3e50'],
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
            label: {
                format: '#{.0f}%',
            },
        },
    ],
};

export const COLUMN_CHART_WITH_NEGATIVE_VALUES_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_PRISON_POPULATION,
    title: {
        text: 'Changes in Prison Population (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Ministry of Justice, HM Prison Service, and Her Majesty’s Prison and Probation Service',
    },
    series: [
        {
            type: 'column',
            xKey: 'month',
            yKeys: ['menDelta', 'womenDelta'],
            yNames: ['Male', 'Female'],
            grouped: true,
            fills: ['#19A0AA', '#F15F36'],
            strokes: ['#19A0AA', '#F15F36'],
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
        },
    ],
};

export const SIMPLE_PIE_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    title: {
        text: 'Religions of London Population (2016)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Office for National Statistics',
    },
    series: [
        {
            data: data.DATA_RELIGION_POPULATION,
            type: 'pie',
            labelKey: 'religion',
            angleKey: 'population',
            label: {
                minAngle: 0,
            },
            callout: {
                strokeWidth: 2,
            },
            fills: ['#febe76', '#ff7979', '#badc58', '#f9ca23', '#f0932b', '#eb4c4b', '#6ab04c', '#7ed6df'],
            strokes: ['#b28553', '#b35555', '#829a3e', '#ae8d19', '#a8671e', '#a43535', '#4a7b35', '#58969c'],
        },
    ],
    legend: {
        enabled: false,
    },
};

export const SIMPLE_DOUGHNUT_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_FIRE_STATISTICS,
    title: {
        text: 'Dwelling Fires (UK)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Home Office',
    },
    series: [
        {
            type: 'pie',
            labelKey: 'type',
            fillOpacity: 0.9,
            strokeWidth: 0,
            angleKey: '2018/19',
            label: {
                enabled: false,
            },
            title: {
                enabled: true,
                text: '2018/19',
            },
            innerRadiusOffset: -100,
        },
    ],
};

export const SIMPLE_LINE_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_FUEL_PRICES,
    title: {
        text: 'Road fuel prices (2019)',
        fontSize: 18,
    },
    subtitle: {
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
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'time',
            tick: {
                count: month.every(2),
            },
            title: {
                enabled: true,
                text: 'Date',
            },
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Price in pence',
            },
        },
    ],
};

export const LINE_GRAPH_WITH_GAPS_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_BANANA_PRICES,
    theme: {
        overrides: {
            cartesian: {
                series: {
                    line: {
                        highlightStyle: {
                            series: {
                                dimOpacity: 0.2,
                                strokeWidth: 4,
                            },
                        },
                    },
                },
            },
        },
    },
    title: {
        text: 'Imported Banana Prices (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Environment, Food and Rural Affairs',
    },
    series: [
        {
            type: 'line',
            xKey: 'week',
            yKey: 'belize',
            yName: 'Belize',
            stroke: '#0b1791',
            marker: {
                fill: '#0b1791',
                stroke: '#0b1791',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'cameroon',
            yName: 'Cameroon',
            stroke: '#be2a2c',
            marker: {
                fill: '#be2a2c',
                stroke: '#f6d24a',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'columbia',
            yName: 'Columbia',
            stroke: '#f6d24a',
            marker: {
                fill: '#f6d24a',
                stroke: '#f6d24a',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'costaRica',
            yName: 'Costa Rica',
            stroke: '#ce1126',
            marker: {
                fill: '#ce1126',
                stroke: '#ce1126',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'dominicanRepublic',
            yName: 'Dominican Republic',
            stroke: '#002d62',
            marker: {
                fill: '#002d62',
                stroke: '#ce1126',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'ecuador',
            yName: 'Ecuador',
            stroke: '#1b4e9e',
            marker: {
                fill: '#1b4e9e',
                stroke: '#fade4b',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'ghana',
            yName: 'Ghana',
            stroke: '#f6d24a',
            marker: {
                fill: '#f6d24a',
                stroke: '#be2a2c',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'honduras',
            yName: 'Honduras',
            stroke: '#0073cf',
            marker: {
                fill: '#0073cf',
                stroke: '#0073cf',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'ivoryCoast',
            yName: 'Ivory Coast',
            stroke: '#e88532',
            marker: {
                fill: '#e88532',
                stroke: '#469c65',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'jamaica',
            yName: 'Jamaica',
            stroke: '#000000',
            marker: {
                fill: '#000000',
                stroke: '#fed100',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'mexico',
            yName: 'Mexico',
            stroke: '#006847',
            marker: {
                fill: '#006847',
                stroke: '#ce1126',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'panama',
            yName: 'Panama',
            stroke: '#c22b38',
            marker: {
                fill: '#c22b38',
                stroke: '#1e5190',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'windwardIsles',
            yName: 'Windward Isles',
            stroke: '#042279',
            marker: {
                fill: '#042279',
                stroke: '#bf2b30',
                strokeWidth: 2,
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'guatemala',
            yName: 'Guatemala',
            stroke: '#4997d0',
            marker: {
                fill: '#4997d0',
                stroke: '#4997d0',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'nicaragua',
            yName: 'Nicaragua',
            stroke: '#2868c1',
            marker: {
                fill: '#ffffff',
                stroke: '#2868c1',
            },
        },
        {
            type: 'line',
            xKey: 'week',
            yKey: 'brazil',
            yName: 'Brazil',
            stroke: '#459945',
            marker: {
                fill: '#459945',
                stroke: '#459945',
            },
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
            title: {
                enabled: true,
                text: 'Week',
            },
            label: {
                formatter: (params) => (params.index % 3 ? '' : params.value),
            },
        },
        {
            type: 'number',
            position: 'left',
            title: {
                enabled: true,
                text: '£ per kg',
            },
            nice: false,
            min: 0.2,
            max: 1,
        },
    ],
    legend: {
        position: 'bottom',
        item: {
            paddingY: 15,
        },
    },
    padding: {
        bottom: 30,
    },
};

export const SIMPLE_SCATTER_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_MLB_PLAYER_PHYSICAL_STATS,
    title: {
        text: 'Height vs Weight for Major League Baseball Players',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Statistics Online Computational Resource',
    },
    series: [
        {
            type: 'scatter',
            xKey: 'weight',
            yKey: 'height',
            fillOpacity: 0.5,
            strokeOpacity: 0,
            marker: {
                size: 12,
                fill: '#002D72',
            },
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'number',
            title: {
                enabled: true,
                text: 'Weight (pounds)',
            },
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Height (inches)',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const BUBBLE_GRAPH_WITH_NEGATIVE_VALUES_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_WORLD_CITIES,
    title: {
        text: 'Most Populous Cities (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Simple Maps',
    },
    series: [
        {
            type: 'scatter',
            title: 'Most populous cities',
            xKey: 'lon',
            xName: 'Longitude',
            yKey: 'lat',
            yName: 'Latitude',
            sizeKey: 'population',
            sizeName: 'Population',
            labelKey: 'city',
            labelName: 'City',
            marker: {
                size: 5,
                maxSize: 100,
            },
            fillOpacity: 0.5,
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'number',
            title: {
                enabled: true,
                text: 'Longitude',
            },
            min: -180,
            max: 180,
            nice: false,
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Latitude',
            },
            min: -90,
            max: 90,
            nice: false,
        },
    ],
    legend: {
        enabled: false,
    },
};

export const BUBBLE_GRAPH_WITH_CATEGORIES_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_RANDOM_BUBBLE_DATA,
    title: {
        text: 'Punch Card of Github',
        fontSize: 18,
    },
    subtitle: {
        text: 'time distribution of commits',
    },
    series: [
        {
            type: 'scatter',
            xKey: 'hour',
            xName: 'Time',
            yKey: 'day',
            yName: 'Day',
            sizeKey: 'size',
            sizeName: 'Commits',
            title: 'Punch Card',
            marker: {
                size: 0,
                maxSize: 30,
                fill: '#cc5b58',
            },
            fillOpacity: 0.85,
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'category',
            gridStyle: [
                {
                    stroke: 'rgba(0,0,0,0.2)',
                    lineDash: [0, 5, 0],
                },
            ],
            tick: {
                color: 'black',
            },
            line: {
                color: undefined,
            },
        },
        {
            position: 'left',
            type: 'category',
            gridStyle: [],
            tick: {
                color: 'black',
            },
            line: {
                color: undefined,
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const SIMPLE_AREA_GRAPH_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_MUSEUMS_AND_GALLERIES_MONTHLY_VISITS_BY_MUSEUM,
    title: {
        text: 'Total Visitors to Tate Galleries',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Digital, Culture, Media & Sport',
    },
    series: [
        {
            type: 'area',
            xKey: 'date',
            yKeys: ['Tate Modern'],
            fills: ['#c16068'],
            fillOpacity: 0.8,
            strokes: ['#874349'],
        },
        {
            type: 'area',
            xKey: 'date',
            yKeys: ['Tate Britain'],
            fills: ['#a2bf8a'],
            fillOpacity: 0.8,
            strokes: ['#718661'],
        },
        {
            type: 'area',
            xKey: 'date',
            yKeys: ['Tate Liverpool'],
            fills: ['#ebcc87'],
            fillOpacity: 0.8,
            strokes: ['#a48f5f'],
        },
        {
            type: 'area',
            xKey: 'date',
            yKeys: ['Tate St Ives'],
            fills: ['#80a0c3'],
            fillOpacity: 0.8,
            strokes: ['#5a7088'],
        },
    ],
    axes: [
        {
            type: 'time',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
            title: {
                enabled: true,
                text: 'Total visitors',
            },
            label: {
                formatter: (params) => params.value / 1000 + 'k',
            },
        },
    ],
    legend: {
        position: 'bottom',
    },
};

export const STACKED_AREA_GRAPH_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_MUSEUMS_AND_GALLERIES_MONTHLY_VISITS_BY_MUSEUM_2,
    title: {
        text: 'Total Visitors to Science Museums (2019)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Digital, Culture, Media & Sport',
    },
    series: [
        {
            type: 'area',
            xKey: 'date',
            yKeys: [
                'Science Museum',
                'National Media Museum',
                'National Railway Museum',
                'Locomotion',
                'Museum of Science and Industry, Manchester',
                'National Coal Mining Museum for England',
            ],
            fills: ['#5BC0EB', '#FDE74C', '#9BC53D', '#E55934', '#FA7921', '#fa3081'],
            strokes: ['#4086a4', '#b1a235', '#6c8a2b', '#a03e24', '#af5517', '#af225a'],
            marker: {
                enabled: true,
            },
        },
    ],
    axes: [
        {
            type: 'time',
            position: 'bottom',
            label: {
                format: '%b',
            },
        },
        {
            type: 'number',
            position: 'left',
            title: {
                enabled: true,
                text: 'Total visitors',
            },
            label: {
                formatter: function (params) {
                    return params.value / 1000 + 'k';
                },
            },
        },
    ],
    legend: {
        position: 'bottom',
    },
};

export const ONE_HUNDRED_PERCENT_STACKED_AREA_GRAPH_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_ENERGY_TRENDS,
    title: {
        text: 'UK Energy Sources (2018)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Business, Energy & Industrial Strategy',
    },
    series: [
        {
            type: 'area',
            xKey: 'month',
            yKeys: ['coal', 'petroleum', 'naturalGas', 'bioenergyWaste', 'nuclear', 'windSolarHydro', 'imported'],
            yNames: [
                'Coal',
                'Petroleum',
                'Natural gas',
                'Bioenergy & waste',
                'Nuclear',
                'Wind, solar & hydro',
                'Imported',
            ],
            normalizedTo: 100,
            highlightStyle: {
                series: {
                    strokeWidth: 4,
                    dimOpacity: 0.3,
                },
            },
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
            label: {
                format: '#{.0f}%',
            },
            title: {
                enabled: true,
                text: 'Normalized Percentage Energy',
            },
        },
    ],
    legend: {
        position: 'top',
    },
};

export const AREA_GRAPH_WITH_NEGATIVE_VALUES_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_ENERGY_TRENDS_BY_QUARTER,
    title: {
        text: 'Changes in UK Energy Stock (2018)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: Department for Business, Energy & Industrial Strategy',
    },
    series: [
        {
            type: 'area',
            xKey: 'quarter',
            yKeys: ['naturalGas'],
            yNames: ['Natural gas'],
            fills: ['#FA7921'],
            strokes: ['#af5517'],
            fillOpacity: 0.6,
        },
        {
            type: 'area',
            xKey: 'quarter',
            yKeys: ['coal'],
            yNames: ['Coal'],
            fills: ['#5BC0EB'],
            strokes: ['#4086a4'],
            fillOpacity: 0.6,
        },
        {
            type: 'area',
            xKey: 'quarter',
            yKeys: ['primaryOil'],
            yNames: ['Primary oil'],
            fills: ['#9BC53D'],
            strokes: ['#6c8a2b'],
            fillOpacity: 0.6,
        },
        {
            type: 'area',
            xKey: 'quarter',
            yKeys: ['petroleum'],
            yNames: ['Petroleum'],
            fills: ['#E55934'],
            strokes: ['#a03e24'],
            fillOpacity: 0.6,
        },
        {
            type: 'area',
            xKey: 'quarter',
            yKeys: ['manufacturedFuels'],
            yNames: ['Manufactured fuels'],
            fills: ['#FDE74C'],
            strokes: ['#b1a235'],
            fillOpacity: 0.6,
        },
    ],
    axes: [
        {
            type: 'category',
            position: 'bottom',
        },
        {
            type: 'number',
            position: 'left',
            title: {
                enabled: true,
                text: 'Thousand tonnes of oil equivalent',
            },
        },
    ],
    legend: {
        position: 'bottom',
    },
};

export const MARKET_INDEX_TREEMAP_GRAPH_EXAMPLE: AgChartOptions = {
    type: 'hierarchy',
    data: data.DATA_MARKET_INDEX_TREE,
    series: [
        {
            type: 'treemap',
            labelKey: 'name', // defaults to 'label', but current dataset uses 'name'
            sizeKey: 'size', // default (can be omitted for current dataset)
            colorKey: 'color', // default (can be omitted for current dataset)
            tooltip: {
                renderer: treemapTooltipRenderer,
            },
        },
    ],
    title: {
        text: 'S&P 500 index stocks categorized by sectors and industries.',
    },
    subtitle: {
        text: 'Area represents market cap. Color represents change from the day before.',
    },
};

function treemapTooltipRenderer(params: any) {
    const { datum } = params;
    const customRootText = 'Custom Root Text';
    const title = datum.parent
        ? datum.parent.depth
            ? datum.parent.datum[params.labelKey]
            : customRootText
        : customRootText;
    let content = '<div>';
    let ellipsis = false;

    if (datum.parent) {
        const maxCount = 5;
        ellipsis = datum.parent.children.length > maxCount;
        datum.parent.children.slice(0, maxCount).forEach((child: any) => {
            content += `<div style="font-weight: bold; color: white; background-color: ${
                child.fill
            }; padding: 5px;"><strong>${child.datum.name || child.label}</strong>: ${String(
                isFinite(child.colorValue) ? child.colorValue.toFixed(2) : ''
            )}%</div>`;
        });
    }
    if (ellipsis) {
        content += `<div style="text-align: center;">...</div>`;
    }
    content += '</div>';
    return {
        title,
        content,
        backgroundColor: 'gray',
    };
}

export const SIMPLE_HISTOGRAM_CHART_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_ENGINE_SIZES,
    title: {
        text: 'Engine size distribution (USA 1987)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: UCI',
    },
    series: [
        {
            type: 'histogram',
            xKey: 'engine-size',
            xName: 'Engine Size',
            fillOpacity: 0.5,
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'number',
            title: {
                enabled: true,
                text: 'Engine Size (Cubic inches)',
            },
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Frequency',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const HISTOGRAM_WITH_SPECIFIED_BINS_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_CURB_WEIGHTS,
    title: {
        text: 'Vehicle weight distribution (USA 1987)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: UCI',
    },
    series: [
        {
            type: 'histogram',
            xKey: 'curb-weight',
            xName: 'Curb weight',
            fillOpacity: 0.5,
            fill: '#8888ff',
            stroke: '#000',
            bins: [
                [0, 2000],
                [2000, 3000],
                [3000, 4500],
            ],
            areaPlot: true,
            tooltip: {
                renderer: (params: any) => {
                    const paramsMax = params.datum.domain[1];
                    const sizeName = paramsMax === 2000 ? 'small' : paramsMax === 3000 ? 'medium' : 'large';

                    return {
                        content:
                            '<b>' +
                            params.datum.frequency +
                            '</b> vehicles in the <b>' +
                            sizeName +
                            '</b> category by <b>' +
                            params.xName.toLowerCase() +
                            '</b>',
                    };
                },
            },
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'number',
            title: {
                enabled: true,
                text: 'Curb weight (pounds)',
            },
        },
        {
            position: 'left',
            type: 'number',
            label: {
                formatter: () => '',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};

export const XY_HISTOGRAM_WITH_MEAN_EXAMPLE: AgChartOptions = {
    autoSize: true,
    data: data.DATA_ENGINE_SIZE_MPG,
    title: {
        text: 'Vehicle fuel efficiency by engine size (USA 1987)',
        fontSize: 18,
    },
    subtitle: {
        text: 'Source: UCI',
    },
    series: [
        {
            type: 'histogram',
            xKey: 'engine-size',
            xName: 'Engine Size',
            yKey: 'highway-mpg',
            yName: 'Highway MPG',
            fill: '#41874b',
            stroke: '#41874b',
            fillOpacity: 0.5,
            aggregation: 'mean',
        },
        {
            type: 'scatter',
            xKey: 'engine-size',
            xName: 'Engine Size',
            yKey: 'highway-mpg',
            yName: 'Highway MPG',
            fill: '#333',
            stroke: '#333',
            fillOpacity: 0.5,
        },
    ],
    axes: [
        {
            position: 'bottom',
            type: 'number',
            title: {
                enabled: true,
                text: 'Engine Size (Cubic inches)',
            },
        },
        {
            position: 'left',
            type: 'number',
            title: {
                enabled: true,
                text: 'Highway MPG',
            },
        },
    ],
    legend: {
        enabled: false,
    },
};
