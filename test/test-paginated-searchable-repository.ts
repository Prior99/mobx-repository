(global as any).setTimeout = (callback: () => void) => callback(); // eslint-disable-line

import { autorun } from "mobx";

import { Pagination, PaginatedSearchableRepository, FetchByQueryResult, Segment } from "../src";

describe("PaginatedSearchableRepository", () => {
    interface TestEntity {
        id: string;
        value: string;
    }

    interface TestQuery {
        search?: string;
        length?: number;
    }

    let spyFetchByQuery: jest.Mock<TestEntity[], [TestQuery, Pagination]>;
    let repository: TestRepository;
    let query: TestQuery;
    let hugeQuery: TestQuery;
    let pagination: Pagination;

    class TestRepository extends PaginatedSearchableRepository<TestQuery, TestEntity> {
        protected async fetchByQuery(
            query: TestQuery,
            pagination: Pagination,
        ): Promise<FetchByQueryResult<TestEntity>> {
            return { entities: spyFetchByQuery(query, pagination) };
        }

        protected async fetchById(): Promise<TestEntity> {
            throw new Error("Should not be reached.");
        }

        protected extractId(entity: TestEntity): string {
            return entity.id;
        }
    }

    beforeEach(() => {
        query = { length: 5, search: "some" };
        hugeQuery = { length: 100, search: "some" };
        pagination = { offset: 1, count: 2 };
        spyFetchByQuery = jest.fn();
        repository = new TestRepository();
    });

    describe("with the loading function returning some result", () => {
        beforeEach(() =>
            spyFetchByQuery.mockImplementation(({ length, search }: TestQuery, { offset, count }: Pagination) => {
                const result: TestEntity[] = [];
                for (let i = 0; i < (count === undefined ? 1 : length); ++i) {
                    result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                }
                return result.slice(offset, offset + count);
            }),
        );

        describe("`byQuery`", () => {
            describe("first call", () => {
                let returnValue: TestEntity[];

                beforeEach(() => (returnValue = repository.byQuery(query)));

                it("returns empty array", () => expect(returnValue).toEqual([]));

                it("calls `fetchByQuery` with the query", () =>
                    expect(spyFetchByQuery).toBeCalledWith(
                        query,
                        new Segment({
                            offset: 0,
                            count: 10,
                        }),
                    ));

                it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`byQuery` reactivity", () => {
                it("updates after the fetch is done", () => {
                    return new Promise<void>((done) => {
                        let calls = 0;

                        autorun((reaction) => {
                            const result = repository.byQuery(
                                { length: 5, search: "some" },
                                new Segment({
                                    offset: 0,
                                    count: 2,
                                }),
                            );
                            if (calls++ === 0) {
                                expect(result).toEqual([]);
                            } else {
                                expect(result).toEqual([
                                    { id: "id-0", value: "value-some-0" },
                                    { id: "id-1", value: "value-some-1" },
                                ]);
                                reaction.dispose();
                                done();
                            }
                        });
                    });
                });
            });
        });

        describe("after loading three ranges", () => {
            beforeEach(async () => {
                await repository.byQueryAsync(hugeQuery, new Segment({ offset: 31, count: 10 }));
                await repository.byQueryAsync(hugeQuery, new Segment({ offset: 51, count: 10 }));
                await repository.byQueryAsync(hugeQuery, new Segment({ offset: 71, count: 10 }));
            });

            it("called `fetchByQuery` with those ranges", () => {
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 31, count: 10 }));
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 51, count: 10 }));
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 71, count: 10 }));
            });

            describe("after loading a partially loaded included range", () => {
                let returnValue: TestEntity[];

                beforeEach(async () => {
                    spyFetchByQuery.mockClear();
                    returnValue = await repository.byQueryAsync(hugeQuery, new Segment({ offset: 36, count: 20 }));
                });

                it("resolves to entities", () => {
                    expect(Array.isArray(returnValue)).toBe(true);
                    expect(returnValue).toHaveLength(20);
                    returnValue.forEach((item, index) => {
                        expect(item).toEqual({
                            id: `id-${index + 36}`,
                            value: `value-some-${index + 36}`,
                        });
                    });
                });

                it("called `fetchByQuery` with the missing range", () => {
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 41, count: 10 }));
                });
            });

            describe("after loading a surrounding range", () => {
                let returnValue: TestEntity[];

                beforeEach(async () => {
                    returnValue = await repository.byQueryAsync(hugeQuery, new Segment({ offset: 25, count: 75 }));
                });

                it("resolves to entities", () => {
                    expect(Array.isArray(returnValue)).toBe(true);
                    expect(returnValue).toHaveLength(75);
                    returnValue.forEach((item, index) => {
                        expect(item).toEqual({
                            id: `id-${index + 25}`,
                            value: `value-some-${index + 25}`,
                        });
                    });
                });

                it("called `fetchByQuery` with the missing ranges", () => {
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 25, count: 6 }));
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 41, count: 10 }));
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 61, count: 10 }));
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, new Segment({ offset: 81, count: 19 }));
                });
            });
        });

        describe("`byQueryAsync`", () => {
            let returnValue: TestEntity[];

            beforeEach(async () => {
                returnValue = await repository.byQueryAsync(query, pagination);
            });

            it("resolves to entities", () =>
                expect(returnValue).toEqual([
                    { id: "id-1", value: "value-some-1" },
                    { id: "id-2", value: "value-some-2" },
                ]));

            it("calls `fetchByQuery` with the query", () =>
                expect(spyFetchByQuery).toBeCalledWith(query, new Segment(pagination)));

            it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));

            describe("consecutive calls to `byQuery` with same pagination", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(() => (nextReturnValue = repository.byQuery(query, pagination)));

                it("returns the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-1", value: "value-some-1" },
                        { id: "id-2", value: "value-some-2" },
                    ]));

                it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`reloadByQuery` without pagination range", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(async () => {
                    spyFetchByQuery.mockImplementation(() => [
                        { id: "id-3", value: "value-some-3" },
                        { id: "id-4", value: "value-some-4" },
                    ]);
                    nextReturnValue = await repository.reloadQuery(query);
                });

                it("resolves to the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-3", value: "value-some-3" },
                        { id: "id-4", value: "value-some-4" },
                    ]));

                it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
            });

            describe("`reloadByQuery` with pagination range", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(async () => {
                    spyFetchByQuery.mockImplementation(() => [
                        { id: "id-3", value: "value-some-3" },
                        { id: "id-4", value: "value-some-4" },
                    ]);
                    nextReturnValue = await repository.reloadQuery(query, { offset: 0, count: 1 });
                });

                it("resolves to the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-3", value: "value-some-3" },
                    ]));

                it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
            });

            describe("consecutive calls to `byQueryAsync` with same pagination", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query, pagination)));

                it("resolves to the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-1", value: "value-some-1" },
                        { id: "id-2", value: "value-some-2" },
                    ]));

                it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("after resetting the repository", () => {
                beforeEach(() => repository.reset());

                describe("calls to `byQuery`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return empty array", () => expect(nextReturnValue).toEqual([]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query, pagination)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-1", value: "value-some-1" },
                            { id: "id-2", value: "value-some-2" },
                        ]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });
            });

            describe("after evicting an entity that was part of the query", () => {
                beforeEach(() => repository.evict("id-2"));

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query, pagination)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-1", value: "value-some-1" },
                            { id: "id-2", value: "value-some-2" },
                        ]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });
            });
        });

        describe("`waitForQuery`", () => {
            let spyResolve1: jest.Mock;
            let spyReject1: jest.Mock<undefined, [Error]>;
            let spyResolve2: jest.Mock;
            let spyReject2: jest.Mock<undefined, [Error]>;

            beforeEach(() => {
                spyResolve1 = jest.fn();
                spyReject1 = jest.fn();
                spyResolve2 = jest.fn();
                spyReject2 = jest.fn();
                repository
                    .waitForQuery(hugeQuery, {
                        offset: 10,
                        count: 50,
                    })
                    .then(spyResolve1)
                    .catch(spyReject1);
                repository
                    .waitForQuery(hugeQuery, {
                        offset: 10,
                        count: 50,
                    })
                    .then(spyResolve2)
                    .catch(spyReject2);
            });

            it("is still pending", () => {
                expect(spyResolve1).not.toHaveBeenCalled();
                expect(spyReject1).not.toHaveBeenCalled();
                expect(spyResolve2).not.toHaveBeenCalled();
                expect(spyReject2).not.toHaveBeenCalled();
            });

            describe("after evicting an unrelated id", () => {
                beforeEach(() => repository.evict("id-1109"));

                it("is still pending", () => {
                    expect(spyResolve1).not.toHaveBeenCalled();
                    expect(spyReject1).not.toHaveBeenCalled();
                    expect(spyResolve2).not.toHaveBeenCalled();
                    expect(spyReject2).not.toHaveBeenCalled();
                });
            });

            describe("while loading a subrange", () => {
                beforeEach(() => repository.byQuery(hugeQuery, new Segment({ offset: 10, count: 25 })));

                describe("after evicting an unrelated id", () => {
                    beforeEach(() => repository.evict("id-1109"));

                    it("is still pending", () => {
                        expect(spyResolve1).not.toHaveBeenCalled();
                        expect(spyReject1).not.toHaveBeenCalled();
                        expect(spyResolve2).not.toHaveBeenCalled();
                        expect(spyReject2).not.toHaveBeenCalled();
                    });
                });
            });

            describe("after loading a subrange and a range exhausting the query", () => {
                beforeEach(async () => {
                    spyFetchByQuery.mockImplementation(
                        ({ length, search }: TestQuery, { offset, count }: Pagination) => {
                            if (offset + count > 50) {
                                count = Math.max(0, 50 - offset);
                            }
                            const result: TestEntity[] = [];
                            for (let i = 0; i < (count === undefined ? 1 : length); ++i) {
                                result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                            }
                            return result.slice(offset, offset + count);
                        },
                    );
                    await repository.byQueryAsync(hugeQuery, new Segment({ offset: 10, count: 25 }));
                    await repository.byQueryAsync(hugeQuery, new Segment({ offset: 45, count: 10 }));
                });

                it("is still pending", () => {
                    expect(spyResolve1).not.toHaveBeenCalled();
                    expect(spyReject1).not.toHaveBeenCalled();
                    expect(spyResolve2).not.toHaveBeenCalled();
                    expect(spyReject2).not.toHaveBeenCalled();
                });
            });

            describe("after loading a subrange", () => {
                beforeEach(() => repository.byQueryAsync(hugeQuery, new Segment({ offset: 10, count: 25 })));

                it("is still pending", () => {
                    expect(spyResolve1).not.toHaveBeenCalled();
                    expect(spyReject1).not.toHaveBeenCalled();
                    expect(spyResolve2).not.toHaveBeenCalled();
                    expect(spyReject2).not.toHaveBeenCalled();
                });

                describe("after resetting the repository", () => {
                    beforeEach(() => repository.reset());

                    it("was rejected", () => {
                        expect(spyResolve1).not.toHaveBeenCalled();
                        expect(spyReject1).toHaveBeenCalled();
                        expect(spyResolve2).not.toHaveBeenCalled();
                        expect(spyReject2).toHaveBeenCalled();
                    });
                });

                describe("after evicting a contained id", () => {
                    beforeEach(() => repository.evict("id-12"));

                    it("was rejected", () => {
                        expect(spyResolve1).not.toHaveBeenCalled();
                        expect(spyReject1).toHaveBeenCalled();
                        expect(spyResolve2).not.toHaveBeenCalled();
                        expect(spyReject2).toHaveBeenCalled();
                    });
                });

                describe("after loading the missing subrange", () => {
                    beforeEach(() => repository.byQueryAsync(hugeQuery, new Segment({ offset: 35, count: 25 })));

                    it("is resolved", () => {
                        expect(spyResolve1).toHaveBeenCalled();
                        expect(spyReject1).not.toHaveBeenCalled();
                        expect(spyResolve2).toHaveBeenCalled();
                        expect(spyReject2).not.toHaveBeenCalled();
                    });
                });

                describe("with an error occuring while loading the missing subrange", () => {
                    beforeEach(async () => {
                        spyFetchByQuery.mockImplementation(() => {
                            throw new Error();
                        });
                        await repository.byQueryAsync(hugeQuery, new Segment({ offset: 35, count: 25 }));
                    });

                    it("was rejected", () => {
                        expect(spyResolve1).not.toHaveBeenCalled();
                        expect(spyReject1).toHaveBeenCalled();
                        expect(spyResolve2).not.toHaveBeenCalled();
                        expect(spyReject2).toHaveBeenCalled();
                    });
                });
            });
        });
    });

    describe("with the loading function being exhausted", () => {
        beforeEach(() =>
            spyFetchByQuery.mockImplementation(() => {
                return [
                    { id: `id-1`, value: `value-1` },
                    { id: `id-`, value: `value-1` },
                ];
            }),
        );

        describe("waitForQuery", () => {
            let resolved: boolean;

            beforeEach(async () => {
                resolved = false;
                repository.byQuery(query, new Segment({ offset: 0, count: 10 }));
                repository.waitForQuery(query).then(() => (resolved = true));
                await new Promise((resolve) => setTimeout(resolve));
            });

            it("resolved", () => expect(resolved).toBe(true));
        });

        describe("after loading", () => {
            beforeEach(async () => {
                await repository.byQueryAsync(query, new Segment({ offset: 0, count: 10 }));
            });

            it("reports the query out of bounds", () =>
                expect(repository.wasOutOfBounds(query, new Segment({ offset: 0, count: 10 }))).toBe(true));
        });
    });

    describe("with the loading function throwing an error", () => {
        beforeEach(() =>
            spyFetchByQuery.mockImplementation(() => {
                throw new Error("Some error");
            }),
        );

        describe("after adding an error listener", () => {
            let spyError: jest.Mock<undefined, [Error]>;

            beforeEach(() => {
                spyError = jest.fn();
                repository.addErrorListener(spyError);
            });

            describe("`byQueryAsync`", () => {
                beforeEach(async () => await repository.byQueryAsync(query));

                it("calls the error listener", () => expect(spyError).toHaveBeenCalledWith(expect.any(Error)));
            });

            describe("after removing the error listener", () => {
                beforeEach(() => repository.removeErrorListener(spyError));

                describe("`byQueryAsync`", () => {
                    beforeEach(async () => await repository.byQueryAsync(query));

                    it("doesn't call the error listener", () => expect(spyError).not.toHaveBeenCalled());
                });
            });
        });

        describe("while waiting for a query", () => {
            let waitForQueryPromise: Promise<void>;

            beforeEach(() => {
                waitForQueryPromise = repository.waitForQuery(query);
            });

            describe("when invoking `byIdAsync`", () => {
                beforeEach(async () => await repository.byQuery(query));

                it("makes the Promise reject", () => expect(waitForQueryPromise).rejects.toEqual(expect.any(Error)));
            });
        });
    });

    describe("waitForIdle", () => {
        type TestEntity = number;

        let repository: TestRepository;
        let promises: { resolve: (values: number[]) => void; reject: (err: Error) => void; query: number }[];

        let resolved: boolean;
        let rejected: Error | undefined;
        let promise: Promise<void>;

        class TestRepository extends PaginatedSearchableRepository<TestEntity, number, number> {
            protected async fetchByQuery(query: number): Promise<FetchByQueryResult<number>> {
                const entities = await new Promise<number[]>((resolve, reject) =>
                    promises.push({ resolve, reject, query }),
                );
                return { entities };
            }

            protected async fetchById(id: number): Promise<TestEntity> {
                return id;
            }

            protected extractId(entity: TestEntity): number {
                return entity;
            }
        }

        beforeEach(() => {
            promises = [];
            repository = new TestRepository();
            resolved = false;
            rejected = undefined;
        });

        it("resolved immediately initially", () => expect(repository.waitForIdle()).resolves.toBeUndefined());

        describe("with multiple requests", () => {
            beforeEach(() => {
                for (let i = 0; i < 10; ++i) {
                    repository.byQuery(i);
                    repository.waitForQuery(i).catch((_err) => undefined);
                }
                promise = repository
                    .waitForIdle()
                    .then(() => (resolved = true))
                    .catch((err) => (rejected = err));
            });

            it("doesn't resolve immediately", () => expect(resolved).toBe(false));

            it("doesn't reject immediately", () => expect(rejected).toBeUndefined());

            describe("with some requests resolved", () => {
                beforeEach(async () => {
                    promises.slice(0, 5).forEach(({ resolve, query }) => resolve([query]));
                    await new Promise((resolve) => setTimeout(resolve));
                });

                it("doesn't resolve yet", () => expect(resolved).toBe(false));

                it("doesn't reject yet", () => expect(rejected).toBeUndefined());
            });

            describe("with all requests resolved", () => {
                beforeEach(async () => {
                    promises.forEach(({ resolve, query }) => resolve([query]));
                    await promise;
                });

                it("resolved", () => expect(resolved).toBe(true));

                it("doesn't reject", () => expect(rejected).toBeUndefined());
            });

            describe("with all requests rejected", () => {
                beforeEach(async () => {
                    promises.forEach(({ reject }) => reject(new Error("Some error.")));
                    await promise;
                });

                it("resolved", () => expect(resolved).toBe(true));

                it("doesn't reject", () => expect(rejected).toBeUndefined());
            });
        });
    });
});
