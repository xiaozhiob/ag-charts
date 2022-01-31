export * from './data-autos';
export * from './data-bananas';
export * from './data-energy';
export * from './data-market-index';
export * from './data-mlb';
export * from './data-museums';

// Source: https://www.ons.gov.uk/releases/uklabourmarketfebruary2020
export const DATA_UK_LABOUR_MARKET_FEB_2020 = [
    { type: 'Managers, directors & senior officials', earnings: 954 },
    { type: 'Professional occupations', earnings: 844 },
    { type: 'Associate professional & technical', earnings: 699 },
    { type: 'Skilled trades', earnings: 503 },
    { type: 'Process, plant & machine operatives', earnings: 501 },
    { type: 'Administrative & secretarial', earnings: 457 },
    { type: 'Sales & customer services', earnings: 407 },
    { type: 'Elementary occupations', earnings: 380 },
    { type: 'Caring, leisure & other services', earnings: 358 },
];

// Source: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/averageweeklyearningsingreatbritain/february2020
export const DATA_EMPLOYMENT_LABOUR_MARKET_AVERAGE_WEEKLY_EARNINGS = [
    { type: 'Whole economy', total: 2.9, regular: 3.2 },
    { type: 'Finance and business services', total: 3.7, regular: 4.2 },
    { type: 'Public sector', total: 3.3, regular: 3.4 },
    { type: 'Construction', total: 3.2, regular: 3.6 },
    { type: 'Private sector', total: 2.7, regular: 3.2 },
    { type: 'Manufacturing', total: 2.7, regular: 2.9 },
    { type: 'Wholesaling, retailing, hotels and restaurants', total: 1.1, regular: 1.5 },
];

// Source: https://www.gov.uk/government/statistics/english-housing-survey-2016-stock-condition
export const DATA_ENGLISH_HOUSING_SURVEY_2016 = [
    {
        type: 'Small terraced house',
        ownerOccupied: 1013,
        privateRented: 822,
        localAuthority: 168,
        housingAssociation: 295,
    },
    {
        type: 'Medium/large terraced house',
        ownerOccupied: 2842,
        privateRented: 938,
        localAuthority: 231,
        housingAssociation: 422,
    },
    {
        type: 'Semi-detached house',
        ownerOccupied: 4567,
        privateRented: 773,
        localAuthority: 274,
        housingAssociation: 388,
    },
    { type: 'Detached house', ownerOccupied: 3655, privateRented: 294, localAuthority: 4, housingAssociation: 19 },
    { type: 'Bungalow', ownerOccupied: 1486, privateRented: 214, localAuthority: 180, housingAssociation: 228 },
    { type: 'Converted flat', ownerOccupied: 252, privateRented: 539, localAuthority: 37, housingAssociation: 100 },
    {
        type: 'Purpose-built flat low rise',
        ownerOccupied: 905,
        privateRented: 1139,
        localAuthority: 621,
        housingAssociation: 919,
    },
    {
        type: 'Purpose-built flat high rise',
        ownerOccupied: 97,
        privateRented: 134,
        localAuthority: 109,
        housingAssociation: 68,
    },
];

// Source: https://www.ons.gov.uk/businessindustryandtrade/itandinternetindustry/datasets/internetusers
export const DATA_INTERNET_USERS = [
    { area: 'North East', usedInLast3Months: 1871, usedOver3MonthsAgo: 54, neverUsed: 186 },
    { area: 'North West', usedInLast3Months: 5213, usedOver3MonthsAgo: 101, neverUsed: 474 },
    { area: 'Yorkshire and the Humber', usedInLast3Months: 3908, usedOver3MonthsAgo: 66, neverUsed: 375 },
    { area: 'East Midlands', usedInLast3Months: 3442, usedOver3MonthsAgo: 64, neverUsed: 317 },
    { area: 'West Midlands', usedInLast3Months: 4127, usedOver3MonthsAgo: 102, neverUsed: 421 },
    { area: 'East of England', usedInLast3Months: 4553, usedOver3MonthsAgo: 64, neverUsed: 330 },
    { area: 'London', usedInLast3Months: 6578, usedOver3MonthsAgo: 79, neverUsed: 403 },
    { area: 'South East', usedInLast3Months: 6757, usedOver3MonthsAgo: 88, neverUsed: 418 },
    { area: 'South West', usedInLast3Months: 4166, usedOver3MonthsAgo: 74, neverUsed: 267 },
    { area: 'Wales', usedInLast3Months: 2265, usedOver3MonthsAgo: 26, neverUsed: 236 },
    { area: 'Scotland', usedInLast3Months: 3979, usedOver3MonthsAgo: 73, neverUsed: 386 },
    { area: 'Northern Ireland', usedInLast3Months: 1271, usedOver3MonthsAgo: 15, neverUsed: 178 },
];

// Source: https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/jobsandvacanciesintheuk/february2020
export const DATA_JOBS_AND_VACANCIES_FEB_2020 = [
    { job: 'Administrative and support service activities', change: 29 },
    { job: 'Other service activities', change: 28 },
    { job: 'Human health and social work activities', change: 23 },
    { job: 'Real estate activities', change: 22 },
    { job: 'Education', change: 21 },
    { job: 'Other jobs', change: 21 },
    { job: 'Agriculture forestry and fishing', change: 17 },
    { job: 'Arts & recreation', change: 13 },
    { job: 'Transport & storage', change: -20 },
    { job: 'Wholesale and retail trade: repair of motor vehicles', change: -36 },
    { job: 'Construction', change: -42 },
];

// Source: https://www.ons.gov.uk/businessindustryandtrade/itandinternetindustry/datasets/internetusers
export const DATA_INTERNET_USERS_BY_AGE_GROUP = [
    {
        year: '2012',
        '16-24': 7088,
        '25-34': 8162,
        '35-44': 7986,
        '45-54': 7694,
        '55-64': 5624,
        '65-74': 3153,
        '75+': 1057,
    },
    {
        year: '2013',
        '16-24': 7075,
        '25-34': 8457,
        '35-44': 7952,
        '45-54': 8005,
        '55-64': 5821,
        '65-74': 3562,
        '75+': 1371,
    },
    {
        year: '2014',
        '16-24': 7074,
        '25-34': 8660,
        '35-44': 7900,
        '45-54': 8290,
        '55-64': 6060,
        '65-74': 3939,
        '75+': 1534,
    },
    {
        year: '2015',
        '16-24': 7155,
        '25-34': 8582,
        '35-44': 8053,
        '45-54': 8498,
        '55-64': 6361,
        '65-74': 4390,
        '75+': 1632,
    },
    {
        year: '2016',
        '16-24': 7129,
        '25-34': 8720,
        '35-44': 8129,
        '45-54': 8686,
        '55-64': 6607,
        '65-74': 4721,
        '75+': 1925,
    },
    {
        year: '2017',
        '16-24': 7036,
        '25-34': 8815,
        '35-44': 8118,
        '45-54': 8803,
        '55-64': 6888,
        '65-74': 5031,
        '75+': 2050,
    },
    {
        year: '2018',
        '16-24': 6992,
        '25-34': 8894,
        '35-44': 8145,
        '45-54': 8814,
        '55-64': 7189,
        '65-74': 5264,
        '75+': 2262,
    },
    {
        year: '2019',
        '16-24': 6877,
        '25-34': 8895,
        '35-44': 8243,
        '45-54': 8810,
        '55-64': 7495,
        '65-74': 5339,
        '75+': 2471,
    },
];

// Source: https://tfl.gov.uk/info-for/open-data-users/our-open-data
export const DATA_OPEN_DATA_USERS = [
    {
        station: 'Walthamstow Central',
        early: 2597,
        morningPeak: 9740,
        interPeak: 5337,
        afternoonPeak: 2619,
        evening: 1396,
    },
    { station: 'Blackhorse Road', early: 1156, morningPeak: 4403, interPeak: 2411, afternoonPeak: 1435, evening: 702 },
    { station: 'Tottenham Hale', early: 764, morningPeak: 5158, interPeak: 3511, afternoonPeak: 2422, evening: 1333 },
    { station: 'Seven Sisters', early: 1927, morningPeak: 7581, interPeak: 5421, afternoonPeak: 3245, evening: 2036 },
    { station: 'Finsbury Park', early: 1454, morningPeak: 16644, interPeak: 9338, afternoonPeak: 6346, evening: 3547 },
    {
        station: 'Highbury & Islington',
        early: 469,
        morningPeak: 6307,
        interPeak: 5209,
        afternoonPeak: 5897,
        evening: 3979,
    },
    {
        station: "King's Cross St. Pancras",
        early: 1783,
        morningPeak: 30035,
        interPeak: 32670,
        afternoonPeak: 26381,
        evening: 18075,
    },
    { station: 'Euston', early: 836, morningPeak: 12740, interPeak: 14964, afternoonPeak: 12790, evening: 8428 },
    { station: 'Warren Street', early: 108, morningPeak: 1210, interPeak: 5902, afternoonPeak: 10947, evening: 5574 },
    { station: 'Oxford Circus', early: 170, morningPeak: 1896, interPeak: 30616, afternoonPeak: 36269, evening: 32665 },
    { station: 'Green Park', early: 252, morningPeak: 1911, interPeak: 11971, afternoonPeak: 19749, evening: 11582 },
    { station: 'Victoria', early: 2711, morningPeak: 31696, interPeak: 39082, afternoonPeak: 29786, evening: 19407 },
    { station: 'Pimlico', early: 240, morningPeak: 2924, interPeak: 4022, afternoonPeak: 4734, evening: 1762 },
    { station: 'Vauxhall', early: 940, morningPeak: 10104, interPeak: 8147, afternoonPeak: 9227, evening: 4146 },
    { station: 'Stockwell', early: 731, morningPeak: 6821, interPeak: 3054, afternoonPeak: 2057, evening: 1416 },
    { station: 'Brixton', early: 1580, morningPeak: 15327, interPeak: 7699, afternoonPeak: 4974, evening: 6398 },
];

// Source: https://www.gov.uk/government/statistics/schools-pupils-and-their-characteristics-january-2019
export const DATA_SCHOOL_PUPIL_CHARACTERISTICS = [
    { type: 'Nursery', white: 24801, mixed: 4052, asian: 7317, black: 3742, chinese: 284, other: 1338 },
    { type: 'Primary', white: 3475379, mixed: 298866, asian: 527391, black: 258774, chinese: 22844, other: 95064 },
    { type: 'Secondary', white: 2436365, mixed: 182721, asian: 377168, black: 198080, chinese: 13317, other: 62662 },
    { type: 'Special', white: 91696, mixed: 7426, asian: 12328, black: 8546, chinese: 404, other: 2109 },
    { type: 'Referral units', white: 12347, mixed: 1448, asian: 605, black: 1104, chinese: 4, other: 229 },
];

// Source: https://www.gov.uk/government/statistics/prison-population-figures-2019
export const DATA_PRISON_POPULATION = [
    { month: 'Jan', men: 78443, women: 3759, menDelta: -821, womenDelta: -45 },
    { month: 'Feb', men: 78683, women: 3824, menDelta: 240, womenDelta: 65 },
    { month: 'Mar', men: 78710, women: 3833, menDelta: 27, womenDelta: 9 },
    { month: 'Apr', men: 78867, women: 3839, menDelta: 157, womenDelta: 6 },
    { month: 'May', men: 78813, women: 3836, menDelta: -54, womenDelta: -3 },
    { month: 'Jun', men: 78862, women: 3746, menDelta: 49, womenDelta: -90 },
    { month: 'Jul', men: 79011, women: 3808, menDelta: 149, womenDelta: 62 },
    { month: 'Aug', men: 79166, women: 3841, menDelta: 155, womenDelta: 33 },
    { month: 'Sep', men: 79514, women: 3813, menDelta: 348, womenDelta: -28 },
    { month: 'Oct', men: 79945, women: 3856, menDelta: 431, womenDelta: 43 },
    { month: 'Nov', men: 79869, women: 3796, menDelta: -76, womenDelta: -60 },
    { month: 'Dec', men: 79701, women: 3783, menDelta: -168, womenDelta: -13 },
];

// Source: https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/datasets/populationcharacteristicsresearchtables
export const DATA_RELIGION_POPULATION = [
    { religion: 'Christian', population: 4159000 },
    { religion: 'Buddhist', population: 97000 },
    { religion: 'Hindu', population: 456000 },
    { religion: 'Jewish', population: 168000 },
    { religion: 'Muslim', population: 1215000 },
    { religion: 'Sikh', population: 123000 },
    { religion: 'Other', population: 174000 },
    { religion: 'None', population: 2274000 },
];

// Source: https://www.gov.uk/government/statistical-data-sets/fire-statistics-data-tables
export const DATA_FIRE_STATISTICS = [
    { type: 'House - single occupancy', '2018/19': 15349 },
    { type: 'Bungalow - single occupancy', '2018/19': 1656 },
    { type: 'Converted Flat/Maisonette - single occupancy', '2018/19': 2147 },
    { type: 'Purpose Built Low Rise (1-3) Flats/Maisonettes', '2018/19': 4954 },
    { type: 'Purpose Built Medium Rise (4-9) Flats', '2018/19': 1887 },
    { type: 'Purpose Built High Rise (10+) Flats', '2018/19': 820 },
    { type: 'Dwelling - multiple occupancy', '2018/19': 610 },
    { type: 'Other dwelling', '2018/19': 2147 },
];

// Source: https://www.gov.uk/government/statistical-data-sets/oil-and-petroleum-products-weekly-statistics
export const DATA_FUEL_PRICES = [
    { date: new Date(2019, 0, 7), petrol: 120.27, diesel: 130.33 },
    { date: new Date(2019, 0, 14), petrol: 119.53, diesel: 129.47 },
    { date: new Date(2019, 0, 21), petrol: 119.12, diesel: 128.92 },
    { date: new Date(2019, 0, 28), petrol: 119.29, diesel: 129.1 },
    { date: new Date(2019, 1, 4), petrol: 119.13, diesel: 129.13 },
    { date: new Date(2019, 1, 11), petrol: 118.97, diesel: 129.17 },
    { date: new Date(2019, 1, 18), petrol: 119.05, diesel: 129.23 },
    { date: new Date(2019, 1, 25), petrol: 119.22, diesel: 129.66 },
    { date: new Date(2019, 2, 4), petrol: 119.72, diesel: 130.25 },
    { date: new Date(2019, 2, 11), petrol: 120.1, diesel: 130.59 },
    { date: new Date(2019, 2, 18), petrol: 120.48, diesel: 130.85 },
    { date: new Date(2019, 2, 25), petrol: 120.83, diesel: 131.15 },
    { date: new Date(2019, 3, 1), petrol: 121.7, diesel: 131.48 },
    { date: new Date(2019, 3, 8), petrol: 122.75, diesel: 132.08 },
    { date: new Date(2019, 3, 15), petrol: 124.06, diesel: 132.96 },
    { date: new Date(2019, 3, 22), petrol: 125.43, diesel: 133.99 },
    { date: new Date(2019, 3, 29), petrol: 126.36, diesel: 134.6 },
    { date: new Date(2019, 4, 6), petrol: 127.5, diesel: 135.41 },
    { date: new Date(2019, 4, 13), petrol: 127.97, diesel: 135.36 },
    { date: new Date(2019, 4, 20), petrol: 128.51, diesel: 135.82 },
    { date: new Date(2019, 4, 27), petrol: 129.14, diesel: 136.45 },
    { date: new Date(2019, 5, 3), petrol: 129.41, diesel: 136.39 },
    { date: new Date(2019, 5, 10), petrol: 128.89, diesel: 135.4 },
    { date: new Date(2019, 5, 17), petrol: 127.66, diesel: 133.76 },
    { date: new Date(2019, 5, 24), petrol: 126.66, diesel: 131.81 },
    { date: new Date(2019, 6, 1), petrol: 126.49, diesel: 131.55 },
    { date: new Date(2019, 6, 8), petrol: 126.86, diesel: 131.68 },
    { date: new Date(2019, 6, 15), petrol: 127.13, diesel: 131.86 },
    { date: new Date(2019, 6, 22), petrol: 127.81, diesel: 132.21 },
    { date: new Date(2019, 6, 29), petrol: 128.03, diesel: 132.6 },
    { date: new Date(2019, 7, 5), petrol: 128.37, diesel: 132.61 },
    { date: new Date(2019, 7, 12), petrol: 128.36, diesel: 132.59 },
    { date: new Date(2019, 7, 19), petrol: 128.17, diesel: 132.6 },
    { date: new Date(2019, 7, 26), petrol: 128.22, diesel: 132.51 },
    { date: new Date(2019, 8, 2), petrol: 127.86, diesel: 132.29 },
    { date: new Date(2019, 8, 9), petrol: 127.79, diesel: 131.89 },
    { date: new Date(2019, 8, 16), petrol: 126.92, diesel: 131.35 },
    { date: new Date(2019, 8, 23), petrol: 126.78, diesel: 131.52 },
    { date: new Date(2019, 8, 30), petrol: 126.92, diesel: 131.83 },
    { date: new Date(2019, 9, 7), petrol: 126.87, diesel: 131.82 },
    { date: new Date(2019, 9, 14), petrol: 126.91, diesel: 131.89 },
    { date: new Date(2019, 9, 21), petrol: 126.4, diesel: 131.28 },
    { date: new Date(2019, 9, 28), petrol: 125.77, diesel: 130.6 },
    { date: new Date(2019, 10, 4), petrol: 125.56, diesel: 130.38 },
    { date: new Date(2019, 10, 11), petrol: 125.59, diesel: 130.42 },
    { date: new Date(2019, 10, 18), petrol: 125.58, diesel: 130.35 },
    { date: new Date(2019, 10, 25), petrol: 125.32, diesel: 130.08 },
    { date: new Date(2019, 11, 2), petrol: 124.81, diesel: 129.79 },
    { date: new Date(2019, 11, 9), petrol: 124.75, diesel: 129.79 },
    { date: new Date(2019, 11, 16), petrol: 124.33, diesel: 129.56 },
    { date: new Date(2019, 11, 23), petrol: 124.16, diesel: 129.81 },
    { date: new Date(2019, 11, 30), petrol: 124.96, diesel: 130.54 },
];

// Source: https://simplemaps.com/data/world-cities
export const DATA_WORLD_CITIES = [
    { city: 'Tokyo, Japan', lat: 35.685, lon: 139.7514, population: 35676000 },
    { city: 'New York, United States', lat: 40.6943, lon: -73.9249, population: 19354922 },
    { city: 'Mexico City, Mexico', lat: 19.4424, lon: -99.131, population: 19028000 },
    { city: 'Mumbai, India', lat: 19.017, lon: 72.857, population: 18978000 },
    { city: 'Sao Paulo, Brazil', lat: -23.5587, lon: -46.625, population: 18845000 },
    { city: 'Delhi, India', lat: 28.67, lon: 77.23, population: 15926000 },
    { city: 'Shanghai, China', lat: 31.2165, lon: 121.4365, population: 14987000 },
    { city: 'Kolkata, India', lat: 22.495, lon: 88.3247, population: 14787000 },
    { city: 'Los Angeles, United States', lat: 34.1139, lon: -118.4068, population: 12815475 },
    { city: 'Dhaka, Bangladesh', lat: 23.7231, lon: 90.4086, population: 12797394 },
    { city: 'Buenos Aires, Argentina', lat: -34.6025, lon: -58.3975, population: 12795000 },
    { city: 'Karachi, Pakistan', lat: 24.87, lon: 66.99, population: 12130000 },
    { city: 'Cairo, Egypt', lat: 30.05, lon: 31.25, population: 11893000 },
    { city: 'Rio de Janeiro, Brazil', lat: -22.925, lon: -43.225, population: 11748000 },
    { city: 'Osaka, Japan', lat: 34.75, lon: 135.4601, population: 11294000 },
    { city: 'Beijing, China', lat: 39.9289, lon: 116.3883, population: 11106000 },
    { city: 'Manila, Philippines', lat: 14.6042, lon: 120.9822, population: 11100000 },
    { city: 'Moscow, Russia', lat: 55.7522, lon: 37.6155, population: 10452000 },
    { city: 'Istanbul, Turkey', lat: 41.105, lon: 29.01, population: 10061000 },
    { city: 'Paris, France', lat: 48.8667, lon: 2.3333, population: 9904000 },
    { city: 'Seoul, South Korea', lat: 37.5663, lon: 126.9997, population: 9796000 },
    { city: 'Lagos, Nigeria', lat: 6.4433, lon: 3.3915, population: 9466000 },
    { city: 'Jakarta, Indonesia', lat: -6.1744, lon: 106.8294, population: 9125000 },
    { city: 'Guangzhou, China', lat: 23.145, lon: 113.325, population: 8829000 },
    { city: 'Chicago, United States', lat: 41.8373, lon: -87.6862, population: 8675982 },
    { city: 'London, United Kingdom', lat: 51.5, lon: -0.1167, population: 8567000 },
    { city: 'Lima, Peru', lat: -12.048, lon: -77.0501, population: 8012000 },
    { city: 'Tehran, Iran', lat: 35.6719, lon: 51.4243, population: 7873000 },
    { city: 'Kinshasa, Congo (Kinshasa)', lat: -4.3297, lon: 15.315, population: 7843000 },
    { city: 'Bogota, Colombia', lat: 4.5964, lon: -74.0833, population: 7772000 },
    { city: 'Shenzhen, China', lat: 22.5524, lon: 114.1221, population: 7581000 },
    { city: 'Wuhan, China', lat: 30.58, lon: 114.27, population: 7243000 },
    { city: 'Hong Kong, Hong Kong', lat: 22.305, lon: 114.185, population: 7206000 },
    { city: 'Tianjin, China', lat: 39.13, lon: 117.2, population: 7180000 },
    { city: 'Chennai, India', lat: 13.09, lon: 80.28, population: 7163000 },
    { city: 'Taipei, Taiwan', lat: 25.0358, lon: 121.5683, population: 6900273 },
    { city: 'Bengaluru, India', lat: 12.97, lon: 77.56, population: 6787000 },
    { city: 'Bangkok, Thailand', lat: 13.75, lon: 100.5166, population: 6704000 },
    { city: 'Lahore, Pakistan', lat: 31.56, lon: 74.35, population: 6577000 },
    { city: 'Chongqing, China', lat: 29.565, lon: 106.595, population: 6461000 },
    { city: 'Miami, United States', lat: 25.7839, lon: -80.2102, population: 6381966 },
    { city: 'Hyderabad, India', lat: 17.4, lon: 78.48, population: 6376000 },
    { city: 'Dallas, United States', lat: 32.7936, lon: -96.7662, population: 5733259 },
    { city: 'Santiago, Chile', lat: -33.45, lon: -70.667, population: 5720000 },
    { city: 'Philadelphia, United States', lat: 40.0077, lon: -75.1339, population: 5637884 },
    { city: 'Belo Horizonte, Brazil', lat: -19.915, lon: -43.915, population: 5575000 },
    { city: 'Madrid, Spain', lat: 40.4, lon: -3.6834, population: 5567000 },
    { city: 'Houston, United States', lat: 29.7869, lon: -95.3905, population: 5446468 },
    { city: 'Ahmadabad, India', lat: 23.0301, lon: 72.58, population: 5375000 },
    { city: 'Ho Chi Minh City, Vietnam', lat: 10.78, lon: 106.695, population: 5314000 },
    { city: 'Washington, United States', lat: 38.9047, lon: -77.0163, population: 5289420 },
    { city: 'Atlanta, United States', lat: 33.7627, lon: -84.4225, population: 5228750 },
    { city: 'Toronto, Canada', lat: 43.7, lon: -79.42, population: 5213000 },
    { city: 'Singapore, Singapore', lat: 1.293, lon: 103.8558, population: 5183700 },
    { city: 'Luanda, Angola', lat: -8.8383, lon: 13.2344, population: 5172900 },
    { city: 'Baghdad, Iraq', lat: 33.3386, lon: 44.3939, population: 5054000 },
    { city: 'Barcelona, Spain', lat: 41.3833, lon: 2.1834, population: 4920000 },
    { city: 'Haora, India', lat: 22.5804, lon: 88.3299, population: 4841638 },
    { city: 'Shenyang, China', lat: 41.805, lon: 123.45, population: 4787000 },
    { city: 'Khartoum, Sudan', lat: 15.5881, lon: 32.5342, population: 4754000 },
    { city: 'Pune, India', lat: 18.53, lon: 73.85, population: 4672000 },
    { city: 'Boston, United States', lat: 42.3188, lon: -71.0846, population: 4637537 },
    { city: 'Sydney, Australia', lat: -33.92, lon: 151.1852, population: 4630000 },
    { city: 'Saint Petersburg, Russia', lat: 59.939, lon: 30.316, population: 4553000 },
    { city: 'Chittagong, Bangladesh', lat: 22.33, lon: 91.8, population: 4529000 },
    { city: 'Dongguan, China', lat: 23.0489, lon: 113.7447, population: 4528000 },
    { city: 'Riyadh, Saudi Arabia', lat: 24.6408, lon: 46.7727, population: 4465000 },
    { city: 'Hanoi, Vietnam', lat: 21.0333, lon: 105.85, population: 4378000 },
    { city: 'Guadalajara, Mexico', lat: 20.67, lon: -103.33, population: 4198000 },
    { city: 'Melbourne, Australia', lat: -37.82, lon: 144.975, population: 4170000 },
    { city: 'Alexandria, Egypt', lat: 31.2, lon: 29.95, population: 4165000 },
    { city: 'Chengdu, China', lat: 30.67, lon: 104.07, population: 4123000 },
    { city: 'Rangoon, Burma', lat: 16.7834, lon: 96.1667, population: 4088000 },
    { city: 'Phoenix, United States', lat: 33.5722, lon: -112.0891, population: 4081849 },
    { city: "Xi'an, China", lat: 34.275, lon: 108.895, population: 4009000 },
    { city: 'Porto Alegre, Brazil', lat: -30.05, lon: -51.2, population: 3917000 },
    { city: 'Surat, India', lat: 21.2, lon: 72.84, population: 3842000 },
    { city: 'Hechi, China', lat: 23.0965, lon: 109.6091, population: 3830000 },
    { city: 'Abidjan, Côte D’Ivoire', lat: 5.32, lon: -4.04, population: 3802000 },
    { city: 'Brasilia, Brazil', lat: -15.7833, lon: -47.9161, population: 3716996 },
    { city: 'Ankara, Turkey', lat: 39.9272, lon: 32.8644, population: 3716000 },
    { city: 'Monterrey, Mexico', lat: 25.67, lon: -100.33, population: 3712000 },
    { city: 'Yokohama, Japan', lat: 35.32, lon: 139.58, population: 3697894 },
    { city: 'Nanjing, China', lat: 32.05, lon: 118.78, population: 3679000 },
    { city: 'Montreal, Canada', lat: 45.5, lon: -73.5833, population: 3678000 },
    { city: 'Guiyang, China', lat: 26.58, lon: 106.72, population: 3662000 },
    { city: 'Recife, Brazil', lat: -8.0756, lon: -34.9156, population: 3651000 },
    { city: 'Seattle, United States', lat: 47.6211, lon: -122.3244, population: 3643765 },
    { city: 'Harbin, China', lat: 45.75, lon: 126.65, population: 3621000 },
    { city: 'San Francisco, United States', lat: 37.7562, lon: -122.443, population: 3603761 },
    { city: 'Fortaleza, Brazil', lat: -3.75, lon: -38.58, population: 3602319 },
    { city: 'Zhangzhou, China', lat: 24.5204, lon: 117.67, population: 3531147 },
    { city: 'Detroit, United States', lat: 42.3834, lon: -83.1024, population: 3522206 },
    { city: 'Salvador, Brazil', lat: -12.97, lon: -38.48, population: 3484000 },
    { city: 'Busan, South Korea', lat: 35.0951, lon: 129.01, population: 3480000 },
    { city: 'Johannesburg, South Africa', lat: -26.17, lon: 28.03, population: 3435000 },
    { city: 'Berlin, Germany', lat: 52.5218, lon: 13.4015, population: 3406000 },
    { city: 'Algiers, Algeria', lat: 36.7631, lon: 3.0506, population: 3354000 },
    { city: 'Rome, Italy', lat: 41.896, lon: 12.4833, population: 3339000 },
    { city: 'Pyongyang, North Korea', lat: 39.0194, lon: 125.7547, population: 3300000 },
];

export const DATA_RANDOM_BUBBLE_DATA: {}[] = [];
{
    const hours = [
        '12a',
        '1a',
        '2a',
        '3a',
        '4a',
        '5a',
        '6a',
        '7a',
        '8a',
        '9a',
        '10a',
        '11a',
        '12p',
        '1p',
        '2p',
        '3p',
        '4p',
        '5p',
        '6p',
        '7p',
        '8p',
        '9p',
        '10p',
        '11p',
    ];

    const days = ['Saturday', 'Friday', 'Thursday', 'Wednesday', 'Tuesday', 'Monday', 'Sunday'];

    const rawData = [
        [0, 0, 5],
        [0, 1, 1],
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
        [0, 5, 0],
        [0, 6, 0],
        [0, 7, 0],
        [0, 8, 0],
        [0, 9, 0],
        [0, 10, 0],
        [0, 11, 2],
        [0, 12, 4],
        [0, 13, 1],
        [0, 14, 1],
        [0, 15, 3],
        [0, 16, 4],
        [0, 17, 6],
        [0, 18, 4],
        [0, 19, 4],
        [0, 20, 3],
        [0, 21, 3],
        [0, 22, 2],
        [0, 23, 5],
        [1, 0, 7],
        [1, 1, 0],
        [1, 2, 0],
        [1, 3, 0],
        [1, 4, 0],
        [1, 5, 0],
        [1, 6, 0],
        [1, 7, 0],
        [1, 8, 0],
        [1, 9, 0],
        [1, 10, 5],
        [1, 11, 2],
        [1, 12, 2],
        [1, 13, 6],
        [1, 14, 9],
        [1, 15, 11],
        [1, 16, 6],
        [1, 17, 7],
        [1, 18, 8],
        [1, 19, 12],
        [1, 20, 5],
        [1, 21, 5],
        [1, 22, 7],
        [1, 23, 2],
        [2, 0, 1],
        [2, 1, 1],
        [2, 2, 0],
        [2, 3, 0],
        [2, 4, 0],
        [2, 5, 0],
        [2, 6, 0],
        [2, 7, 0],
        [2, 8, 0],
        [2, 9, 0],
        [2, 10, 3],
        [2, 11, 2],
        [2, 12, 1],
        [2, 13, 9],
        [2, 14, 8],
        [2, 15, 10],
        [2, 16, 6],
        [2, 17, 5],
        [2, 18, 5],
        [2, 19, 5],
        [2, 20, 7],
        [2, 21, 4],
        [2, 22, 2],
        [2, 23, 4],
        [3, 0, 7],
        [3, 1, 3],
        [3, 2, 0],
        [3, 3, 0],
        [3, 4, 0],
        [3, 5, 0],
        [3, 6, 0],
        [3, 7, 0],
        [3, 8, 1],
        [3, 9, 0],
        [3, 10, 5],
        [3, 11, 4],
        [3, 12, 7],
        [3, 13, 14],
        [3, 14, 13],
        [3, 15, 12],
        [3, 16, 9],
        [3, 17, 5],
        [3, 18, 5],
        [3, 19, 10],
        [3, 20, 6],
        [3, 21, 4],
        [3, 22, 4],
        [3, 23, 1],
        [4, 0, 1],
        [4, 1, 3],
        [4, 2, 0],
        [4, 3, 0],
        [4, 4, 0],
        [4, 5, 1],
        [4, 6, 0],
        [4, 7, 0],
        [4, 8, 0],
        [4, 9, 2],
        [4, 10, 4],
        [4, 11, 4],
        [4, 12, 2],
        [4, 13, 4],
        [4, 14, 4],
        [4, 15, 14],
        [4, 16, 12],
        [4, 17, 1],
        [4, 18, 8],
        [4, 19, 5],
        [4, 20, 3],
        [4, 21, 7],
        [4, 22, 3],
        [4, 23, 0],
        [5, 0, 2],
        [5, 1, 1],
        [5, 2, 0],
        [5, 3, 3],
        [5, 4, 0],
        [5, 5, 0],
        [5, 6, 0],
        [5, 7, 0],
        [5, 8, 2],
        [5, 9, 0],
        [5, 10, 4],
        [5, 11, 1],
        [5, 12, 5],
        [5, 13, 10],
        [5, 14, 5],
        [5, 15, 7],
        [5, 16, 11],
        [5, 17, 6],
        [5, 18, 0],
        [5, 19, 5],
        [5, 20, 3],
        [5, 21, 4],
        [5, 22, 2],
        [5, 23, 0],
        [6, 0, 1],
        [6, 1, 0],
        [6, 2, 0],
        [6, 3, 0],
        [6, 4, 0],
        [6, 5, 0],
        [6, 6, 0],
        [6, 7, 0],
        [6, 8, 0],
        [6, 9, 0],
        [6, 10, 1],
        [6, 11, 0],
        [6, 12, 2],
        [6, 13, 1],
        [6, 14, 3],
        [6, 15, 4],
        [6, 16, 0],
        [6, 17, 0],
        [6, 18, 0],
        [6, 19, 0],
        [6, 20, 1],
        [6, 21, 2],
        [6, 22, 2],
        [6, 23, 6],
    ];

    DATA_RANDOM_BUBBLE_DATA.push(
        ...rawData.map((item: number[]) => {
            return {
                hour: hours[item[1]],
                day: days[item[0]],
                size: item[2],
            };
        })
    );
}



// import { readFileSync } from 'fs';

// async function loadExampleData(name): Promise<any[]> {
//     const dataFileContent = readFileSync(`../../grid-packages/ag-grid-docs/documentation/doc-pages/charts-overview/examples/${name}/data.js`);
//     const jsModule = `${dataFileContent.toString()} ; export default getData;`;
//     const dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(jsModule);
//     const tempModule = await import(dataUri);

//     return tempModule.default();
// }

// const DOCS_EXAMPLES = {
//     '100--stacked-area': loadExampleData('100--stacked-area'),
//     '100--stacked-bar': loadExampleData('100--stacked-bar'),
//     '100--stacked-column': loadExampleData('100--stacked-column'),
//     'area-with-negative-values': loadExampleData('area-with-negative-values'),
//     'bar-with-labels': loadExampleData('bar-with-labels'),
//     'bubble-with-categories': loadExampleData('bubble-with-categories'),
//     'bubble-with-negative-values': loadExampleData('bubble-with-negative-values'),
//     'chart-customisation': loadExampleData('chart-customisation'),
//     'column-with-negative-values': loadExampleData('column-with-negative-values'),
//     'combination-of-different-series-types': loadExampleData('combination-of-different-series-types'),
//     'custom-marker-shapes': loadExampleData('custom-marker-shapes'),
//     'custom-tooltips': loadExampleData('custom-tooltips'),
//     'grouped-bar': loadExampleData('grouped-bar'),
//     'grouped-column': loadExampleData('grouped-column'),
//     'histogram-with-specified-bins': loadExampleData('histogram-with-specified-bins'),
//     'line-with-gaps': loadExampleData('line-with-gaps'),
//     'log-axis': loadExampleData('log-axis'),
//     'market-index-treemap': loadExampleData('market-index-treemap'),
//     'per-marker-customisation': loadExampleData('per-marker-customisation'),
//     'real-time-data-updates': loadExampleData('real-time-data-updates'),
//     'simple-area': loadExampleData('simple-area'),
//     'simple-bar': loadExampleData('simple-bar'),
//     'simple-bubble': loadExampleData('simple-bubble'),
//     'simple-column': loadExampleData('simple-column'),
//     'simple-doughnut': loadExampleData('simple-doughnut'),
//     'simple-histogram': loadExampleData('simple-histogram'),
//     'simple-line': loadExampleData('simple-line'),
//     'simple-pie': loadExampleData('simple-pie'),
//     'simple-scatter': loadExampleData('simple-scatter'),
//     'stacked-area': loadExampleData('stacked-area'),
//     'stacked-bar': loadExampleData('stacked-bar'),
//     'stacked-column': loadExampleData('stacked-column'),
//     'time-axis-with-irregular-intervals': loadExampleData('time-axis-with-irregular-intervals'),
//     'xy-histogram-with-mean-aggregation': loadExampleData('xy-histogram-with-mean-aggregation'),
// };