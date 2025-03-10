import { describe, expect, it, jest } from '@jest/globals';

import { deepClone, jsonApply, jsonDiff, jsonPropertyCompare, jsonWalk } from './json';
import { mergeDefaults } from './object';

const FIXED_DATE = new Date('2022-01-27T00:00:00.000+00:00');

class TestApply {
    num?: number = undefined;
    str?: string = undefined;
    date?: Date = undefined;
    array?: number[] = undefined;
    recurse?: TestApply = undefined;
    recurseArray?: TestApply[] = undefined;
    _declarationOrder?: number = undefined;

    constructor(params: { [K in keyof TestApply]?: TestApply[K] } = {}) {
        Object.assign(this, params);
    }
}

describe('json module', () => {
    describe('#jsonDiff', () => {
        describe('for trivial cases', () => {
            it('should return null for no diff', () => {
                const cases: object[] = [
                    {},
                    { a: 1, b: { c: 'abc', d: () => 'test' } },
                    { a: [{ foo: 'bar' }], b: { c: 'abc', d: () => 'test' } },
                ];

                for (const testCase of cases) {
                    expect(jsonDiff(testCase, testCase)).toBeNull();
                }

                expect(jsonDiff({}, {})).toBeNull();
            });

            it('should correctly diff primitives', () => {
                const source = {};
                const target = {
                    foo: 'bar',
                    hello: 123,
                    alice: FIXED_DATE,
                    func: (test: any) => test,
                };

                const diff = jsonDiff(source, target);
                expect(diff).toMatchSnapshot();
            });

            it('should correctly diff with negative values', () => {
                const source = { a: [5], b: true };
                const target = { a: [0], b: false };

                const diff = jsonDiff(source, target);
                expect(diff).toMatchSnapshot();
            });
        });

        describe('for non-trivial cases', () => {
            it('should correctly diff complex object structures', () => {
                const source: any = {
                    foo: { bar1: 1 },
                    hello1: { nested: { nestedX2: { primitive: 'abc' } } },
                    unchanging: { readonly: 1 },
                    changing: 'abc',
                    removed: 123,
                    removed2: { nested: { nestedX2: { primitive: 'abc' } } },
                };
                const target: any = {
                    foo: { bar1: 2 },
                    hello1: {
                        nested: { nestedX2: { primitive: 'abc', added: 123 } },
                        nestedAdd: { primitive: 123 },
                    },
                    unchanging: { readonly: 1 },
                    changing: '123',
                };

                const diff = jsonDiff(source, target);
                expect(diff).toMatchSnapshot();
                expect(diff).toHaveProperty('foo.bar1', target.foo.bar1);
                expect(diff).toHaveProperty('hello1.nested.nestedX2.added', 123);
                expect(diff).toHaveProperty('changing', target.changing);
                expect(diff).toHaveProperty('removed', undefined);
                expect(diff).toHaveProperty('removed2', undefined);
                expect(diff).not.toHaveProperty('unchanging');
                expect(diff).not.toHaveProperty('hello1.nestedX2.primitive');
            });

            it('should correctly diff identical arrays', () => {
                const source = {
                    foo: [1, 2, 3, 4],
                };

                const diff = jsonDiff(source, source);
                expect(diff).toBeNull();
            });

            it('should correctly diff mismatching arrays', () => {
                const source = {
                    foo: [1, 2, 3, 4],
                };
                const target = {
                    foo: [9, 8, 7, 6],
                };

                const diff = jsonDiff(source, target);
                expect(diff).toEqual(target);
            });

            it('should correctly diff function changes in arrays', () => {
                const source = {
                    foo: [{ fn: () => 'hello-world!' }],
                };
                const target = {
                    foo: [{ fn: () => 'foo-bar!?!?!' }],
                };

                const diff = jsonDiff(source, target as any);
                expect(diff).toMatchSnapshot();
                expect(diff).toHaveProperty(['foo', '0', 'fn'], target.foo[0].fn);
            });

            it('should correctly diff dictionary of functions (added)', () => {
                const source = { listeners: {} };
                const target = { listeners: { seriesNodeClick: (t: unknown) => console.log(t) } };

                const diff = jsonDiff(source, target as any) as any;
                expect(diff).toStrictEqual(target);
            });

            it('should correctly diff dictionary of functions (removed)', () => {
                const source = { listeners: { seriesNodeClick: (t: unknown) => console.log(t) } };
                const target = { listeners: { seriesNodeClick: undefined } };

                const diff = jsonDiff(source, target as any) as any;
                expect(diff).toStrictEqual(target);
            });

            it('should correctly diff dictionary of functions when no difference', () => {
                const seriesNodeClick = (t: unknown) => console.log(t);
                const source = { legend: { listeners: { seriesNodeClick } } };
                const target = { legend: { listeners: { seriesNodeClick } } };

                const diff = jsonDiff(source, target as any);
                expect(diff).toEqual(null);
            });
        });
    });

    describe('#mergeDefaults', () => {
        describe('for trivial cases', () => {
            it('should merge primitives correctly', () => {
                const fns = [() => 'call-me1', () => 'call-me2', () => 'call-me3'];
                const base = {
                    no: 1,
                    foo: 'bar',
                    fn: fns[0],
                    date: FIXED_DATE,
                };
                const mergee1 = {
                    no: 2,
                    foo2: 'bar2',
                    fn2: fns[1],
                    date2: FIXED_DATE,
                };
                const mergee2 = {
                    no2: 2,
                    foo3: 'bar2',
                    fn2: fns[2],
                    date3: FIXED_DATE,
                };

                const merge = mergeDefaults(mergee2, mergee1 as any, base);
                expect(merge).toMatchSnapshot();
                expect(merge).toHaveProperty('no', mergee1.no);
                expect(merge).toHaveProperty('no2', mergee2.no2);
                expect(merge).toHaveProperty('foo', base.foo);
                expect(merge).toHaveProperty('foo2', mergee1.foo2);
                expect(merge).toHaveProperty('foo3', mergee2.foo3);
                expect(merge).toHaveProperty('fn', base.fn);
                expect(merge).toHaveProperty('fn2', mergee2.fn2);
                expect(merge).toHaveProperty('date', base.date);
                expect(merge).toHaveProperty('date2', mergee1.date2);
                expect(merge).toHaveProperty('date3', mergee2.date3);
            });

            it('should merge array properties correctly', () => {
                const base: any = {
                    a: [[{ x: 1 }, { y: 1 }], [{ m: 2, n: 2 }]],
                    b: [1, 2, 3, 4, 5, 6],
                };
                const mergee1: any = { a: [], b: [] };
                const mergee2: any = {
                    a: [[{ x2: 1 }, { y2: 1 }], [{ m2: 2, n2: 2 }]],
                    c: [10, 9, 8, 7, 6],
                };

                const merge = mergeDefaults(mergee2, mergee1, base);
                expect(merge).toMatchSnapshot();
                expect(merge).toHaveProperty('a', mergee2.a);
                expect(merge).toHaveProperty('b', mergee1.b);
                expect(merge).toHaveProperty('c', mergee2.c);
            });

            it('should merge arrays correctly', () => {
                const base: any = { a: [[{ x: 1 }, { y: 1 }], [{ m: 2, n: 2 }]] };
                const mergee1: any = { a: [] };
                const mergee2: any = { a: [[{ x2: 1 }, { y2: 1 }], [{ m2: 2, n2: 2 }]] };

                const merge = mergeDefaults(mergee2, mergee1, base);
                expect(merge).toMatchSnapshot();
                expect(merge).toEqual(mergee2);
            });

            it('should take highest precedent value when types conflict', () => {
                const base = { a: [[{ x: 1 }, { y: 1 }], [{ m: 2, n: 2 }]], b: [1, 2, 3, 4, 5, 6] };
                const mergee1 = { a: {}, b: {} };
                const mergee2 = { a: 'a' };

                const merge = mergeDefaults(mergee2, mergee1, base);
                expect(merge).toMatchSnapshot();
                expect(merge).toHaveProperty('a', mergee2.a);
                expect(merge).toHaveProperty('b', mergee1.b);
            });
        });

        describe('for objects and arrays', () => {
            it('should create deep clones for objects', () => {
                const base = { a: { x: 1 } };
                const mergee1 = { a: { y: 2 } };
                const mergee2 = { a: { z: 3 } };

                const merge = mergeDefaults(mergee2, mergee1, base);
                expect(merge).toMatchSnapshot();
                expect(merge).not.toBe(base);
                expect(merge).not.toBe(mergee1);
                expect(merge).not.toBe(mergee2);
                expect(merge.a).not.toBe(base.a);
                expect(merge.a).not.toBe(mergee1.a);
                expect(merge.a).not.toBe(mergee2.a);
                expect(merge.a).toHaveProperty('x', 1);
                expect(merge.a).toHaveProperty('y', 2);
                expect(merge.a).toHaveProperty('z', 3);
            });

            it('should create deep clones for arrays', () => {
                const base = { a: [{ x: 1 }, { x: 2 }] };
                const mergee = { a: [{ y: 1 }] };

                const merge = deepClone(mergeDefaults(mergee, base));
                expect(merge).toMatchSnapshot();
                expect(merge).not.toBe(base);
                expect(merge).not.toBe(mergee);
                expect(merge.a).toBeInstanceOf(Array);
                expect(merge.a).not.toBe(base.a);
                expect(merge.a).not.toBe(mergee.a);
                expect(merge.a.length).toEqual(mergee.a.length);
                expect(merge.a[0]).not.toBe(mergee.a[0]);
                expect(merge.a[0]).toHaveProperty('y', 1);
                expect(merge.a[0]).not.toHaveProperty('x');
            });

            it('should honour `avoidDeepClone', () => {
                const base: any = {};
                const mergee = { a: [{ x: 1 }], b: [{ y: 2 }] };

                const merge = deepClone(mergeDefaults(mergee, base), new Set(['b']));
                expect(merge).toMatchSnapshot();
                expect(merge).not.toBe(base);
                expect(merge).not.toBe(mergee);
                expect(merge.a).toBeInstanceOf(Array);
                expect(merge.b).toBeInstanceOf(Array);
                expect(merge.a).not.toBe(mergee.a);
                expect(merge.b).not.toBe(mergee.b);
                expect(merge.b).toStrictEqual(mergee.b);
                expect(merge.a.length).toEqual(mergee.a.length);
                expect(merge.b.length).toEqual(mergee.b.length);
                expect(merge.a[0]).not.toBe(mergee.a[0]);
                expect(merge.a[0]).toHaveProperty('x', 1);
                expect(merge.b[0]).toBe(mergee.b[0]);
                expect(merge.b[0]).toHaveProperty('y', 2);
            });

            it('should correctly merge dictionary of functions', () => {
                const source = {};
                const target = { seriesNodeClick: (t: unknown) => console.log(t) };

                const merge = mergeDefaults(target, source);
                expect(merge).toHaveProperty('seriesNodeClick');
                expect(merge.seriesNodeClick).toBeInstanceOf(Function);
            });

            it('should correctly merge dictionary of functions when no difference', () => {
                const seriesNodeClick = (t: unknown) => console.log(t);
                const source = { legend: { listeners: { seriesNodeClick } } };
                const target = { listeners: { seriesNodeClick } };

                const merge = mergeDefaults(target, source);
                expect(merge).toHaveProperty('legend.listeners.seriesNodeClick');
                expect(merge).toHaveProperty('listeners.seriesNodeClick');
                expect(merge.legend?.listeners?.seriesNodeClick).toBeInstanceOf(Function);
                expect(merge.listeners?.seriesNodeClick).toBeInstanceOf(Function);
            });
        });
    });

    describe('#jsonWalk', () => {
        it('should visit no nodes for no object', () => {
            for (const test of [undefined, null, 'a', 1, FIXED_DATE]) {
                const cb = jest.fn();
                jsonWalk(test, cb, undefined, test);
                expect(cb).toHaveBeenCalledTimes(0);
            }
        });

        it('should not visit property nodes for no object', () => {
            for (const test of [undefined, null, 'a', 1, FIXED_DATE]) {
                const wrappedTest = { test };

                const cb = jest.fn();
                jsonWalk(wrappedTest, cb, undefined, wrappedTest);
                expect(cb).toHaveBeenCalledWith(wrappedTest, wrappedTest, undefined);
                expect(cb).toHaveBeenCalledTimes(1);
            }
        });

        it('should only visit one node for a trivial object', () => {
            const walked1 = { a: 1, b: 2, c: 'c', d: FIXED_DATE };
            const walked2 = { a: 2, b: 3, c: 'd', d: FIXED_DATE };

            const cb = jest.fn();
            jsonWalk(walked1, cb, undefined, walked2);
            expect(cb).toHaveBeenCalledTimes(1);
            expect(cb).toHaveBeenCalledWith(walked1, walked2, undefined);
        });

        it('should visit every node for a non-trivial object', () => {
            const walked1 = {
                a: 1,
                b: 2,
                c: 'c',
                d: FIXED_DATE,
                child1: { foo: 'bar' },
                child2: { hello: 'world', child3: { x: 'x' } },
            };
            const walked2 = { a: 2, b: 3, c: 'd', d: FIXED_DATE, child1: { foo: 'bar' } };

            const cb = jest.fn();
            jsonWalk(walked1, cb, undefined, walked2);
            expect(cb).toHaveBeenCalledWith(walked1, walked2, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.child1, walked2.child1, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.child2, undefined, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.child2.child3, undefined, undefined);
            expect(cb).toHaveBeenCalledTimes(4);
        });

        it('should visit every node of an array', () => {
            const walked1 = [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }];
            const walked2 = [{ x: 1 }, { y: 2 }, { z: 3 }];

            const cb = jest.fn();
            jsonWalk(walked1, cb, undefined, walked2);
            expect(cb).toHaveBeenCalledWith(walked1, walked2, undefined);
            expect(cb).toHaveBeenCalledWith(walked1[0], walked2[0], undefined);
            expect(cb).toHaveBeenCalledWith(walked1[1], walked2[1], undefined);
            expect(cb).toHaveBeenCalledWith(walked1[2], walked2[2], undefined);
            expect(cb).toHaveBeenCalledWith(walked1[3], undefined, undefined);
            expect(cb).toHaveBeenCalledTimes(5);
        });

        it('should visit every node of an array property', () => {
            const walked1 = { prop1: [{ a: 1 }, { b: 2 }, { c: 3 }, { d: 4 }] };
            const walked2 = { prop1: [{ x: 1 }, { y: 2 }, { z: 3 }] };

            const cb = jest.fn();
            jsonWalk(walked1, cb, undefined, walked2);
            expect(cb).toHaveBeenCalledWith(walked1, walked2, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.prop1, walked2.prop1, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.prop1[0], walked2.prop1[0], undefined);
            expect(cb).toHaveBeenCalledWith(walked1.prop1[1], walked2.prop1[1], undefined);
            expect(cb).toHaveBeenCalledWith(walked1.prop1[2], walked2.prop1[2], undefined);
            expect(cb).toHaveBeenCalledWith(walked1.prop1[3], undefined, undefined);
            expect(cb).toHaveBeenCalledTimes(6);
        });

        it('should skip specified properties', () => {
            const walked1 = {
                a: 1,
                b: 2,
                c: 'c',
                d: FIXED_DATE,
                child1: { foo: 'bar' },
                child2: { hello: 'world', child3: { x: 'x' } },
            };
            const walked2 = { a: 2, b: 3, c: 'd', d: FIXED_DATE, child1: { foo: 'bar' } };

            const cb = jest.fn();
            jsonWalk(walked1, cb, new Set(['child1', 'child3']), walked2);
            expect(cb).toHaveBeenCalledWith(walked1, walked2, undefined);
            expect(cb).toHaveBeenCalledWith(walked1.child2, undefined, undefined);
            expect(cb).toHaveBeenCalledTimes(2);
        });
    });

    describe('#jsonApply', () => {
        const json: any = {
            str: 'test-string',
            num: 123,
            date: FIXED_DATE,
            array: [1, 2, 3, 4],
            recurse: { str: 'test-string2', num: 789, date: FIXED_DATE, array: [1, 2, 3, 4] },
        };

        it('should be able to populate an existing object graph', () => {
            const target = new TestApply({ recurse: new TestApply() });
            jsonApply(target, json);
            expect(target.str).toEqual(json.str);
            expect(target.num).toEqual(json.num);
            expect(target.date).toEqual(json.date);
            expect(target.array).toEqual(json.array);
            expect(target.recurse).toBeInstanceOf(TestApply);
            expect(target.recurse?.str).toEqual(json.recurse.str);
            expect(target.recurse?.num).toEqual(json.recurse.num);
            expect(target.recurse?.date).toEqual(json.recurse.date);
            expect(target.recurse?.array).toEqual(json.recurse.array);
        });

        it('should skip specified properties', () => {
            const target = new TestApply();
            jsonApply(target, json, { skip: ['recurse.str', 'str'] });
            expect(target.str).toEqual(undefined);
            expect(target.recurse?.str).toEqual(undefined);
        });

        it('should error on unrecognised properties', () => {
            const badJson = { foo: 'bar' };
            const target = new TestApply();

            console.warn = jest.fn();
            jsonApply(target, badJson as any);
            expect(console.warn).toBeCalledWith('AG Charts - unable to set [foo] in TestApply - property is unknown');
        });

        it('should error on incompatible properties', () => {
            const badJson = { recurse: 'foo' };
            const target = new TestApply({ recurse: new TestApply() });

            console.warn = jest.fn();
            jsonApply(target, badJson as any);
            expect(console.warn).toBeCalledWith(
                "AG Charts - unable to set [recurse] in TestApply - can't apply type of [primitive], allowed types are: [class-instance]"
            );
        });
    });

    describe('#jsonPropertyCompare', () => {
        it('should return true with matching property values', () => {
            const source = { a: 1, b: true, c: 'three' };
            const target = { a: 1, b: true, c: 'three', d: 4 };

            expect(jsonPropertyCompare(source, target)).toEqual(true);
        });

        it('should return false with mismatching property values', () => {
            const source = { a: 1, b: true, c: 'three' };

            for (const key of Object.keys(source) as (keyof typeof source)[]) {
                const target = { ...source, [key]: (source[key] as any) + 1 };
                expect(jsonPropertyCompare(source, target)).toEqual(false);
            }
        });

        it('should return false with missing properties', () => {
            const source = { a: 1, b: true, c: 'three' };

            for (const key of Object.keys(source) as (keyof typeof source)[]) {
                const target = { ...source };
                delete target[key];
                expect(jsonPropertyCompare(source, target)).toEqual(false);
            }
        });

        it('should return false for undefined target', () => {
            const source = { a: 1, b: true, c: 'three' };

            expect(jsonPropertyCompare(source, undefined as any)).toEqual(false);
        });
    });
});
