export enum FONT_SIZE {
    SMALL = 12,
    MEDIUM = 13,
    LARGE = 17,
}

export enum CARTESIAN_POSITION {
    TOP = 'top',
    RIGHT = 'right',
    BOTTOM = 'bottom',
    LEFT = 'left',
}

export enum CARTESIAN_AXIS_TYPE {
    CATEGORY = 'category',
    GROUPED_CATEGORY = 'grouped-category',
    ORDINAL_TIME = 'ordinal-time',
    NUMBER = 'number',
    TIME = 'time',
    LOG = 'log',
}

export enum POLAR_AXIS_TYPE {
    ANGLE_CATEGORY = 'angle-category',
    ANGLE_NUMBER = 'angle-number',
    RADIUS_CATEGORY = 'radius-category',
    RADIUS_NUMBER = 'radius-number',
}

export enum POLAR_AXIS_SHAPE {
    CIRCLE = 'circle',
    POLYGON = 'polygon',
}
