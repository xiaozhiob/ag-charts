import { toArray } from './array';
import { getWindow } from './dom';
import { Logger } from './logger';

export type DebugLogger = ((...logContent: any[]) => void) & { check(): boolean };

const LONG_TIME_PERIOD_THRESHOLD = 2000;

let timeOfLastLog = Date.now();
const logTimeGap = () => {
    const timeSinceLastLog = Date.now() - timeOfLastLog;
    if (timeSinceLastLog > LONG_TIME_PERIOD_THRESHOLD) {
        const prettyDuration = (Math.floor(timeSinceLastLog / 100) / 10).toFixed(1);
        Logger.log(`**** ${prettyDuration}s since last log message ****`);
    }
    timeOfLastLog = Date.now();
};

export const Debug = {
    create(...debugSelectors: Array<boolean | string>): DebugLogger {
        const resultFn = (...logContent: any[]) => {
            if (Debug.check(...debugSelectors)) {
                if (typeof logContent[0] === 'function') {
                    logContent = toArray(logContent[0]());
                }
                logTimeGap();
                Logger.log(...logContent);
            }
        };
        return Object.assign(resultFn, { check: () => Debug.check(...debugSelectors) });
    },

    check(...debugSelectors: Array<boolean | string>) {
        if (debugSelectors.length === 0) {
            debugSelectors.push(true);
        }
        const chartDebug = toArray(getWindow<boolean | string>('agChartsDebug'));
        return chartDebug.some((selector) => debugSelectors.includes(selector));
    },
};

interface DebugTimingOpts {
    logResult: boolean;
    logStack: boolean;
    logArgs: boolean;
    logData: (target: any) => any;
}
export function DebugTiming(name: string, opts: Partial<DebugTimingOpts>) {
    const { logResult = true, logStack = false, logArgs = false, logData } = opts;
    return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
        const method = descriptor.value;
        descriptor.value = function (...args: any[]) {
            const start = performance.now();
            const result = method.apply(this, args);
            const duration = performance.now() - start;

            const logMessage = { duration } as Record<string, any>;
            if (logResult) logMessage.result = result;
            if (logArgs) logMessage.args = args;
            if (logStack) logMessage.stack = new Error().stack;
            if (logData) logMessage.logData = logData(this);
            // eslint-disable-next-line no-console
            console.log(name, logMessage);

            return result;
        };
    };
}
