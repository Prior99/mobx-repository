(global as any).setTimeout = (callback: () => void) => callback(); // eslint-disable-line

import { autorun, makeObservable } from "mobx";
import { SearchableRepository, FetchByQueryResult } from "../src";

describe("SearchableRepository", () => {
    interface TestEntity {
        id: string;
        value: string;
    }

    interface TestQuery {
        search?: string;
        count?: number;
    }

    let spyFetchByQuery: jest.Mock<TestEntity[], [TestQuery]>;
    let repository: TestRepository;
    let query: TestQuery;

    class TestRepository extends SearchableRepository<TestQuery, TestEntity> {
        constructor() {
            super();
            makeObservable(this);
        }

        protected async fetchByQuery(query: TestQuery): Promise<FetchByQueryResult<TestEntity>> {
            return { entities: spyFetchByQuery(query) };
        }

        protected async fetchById(): Promise<TestEntity> {
            throw new Error("Should not be reached.");
        }

        protected extractId(entity: TestEntity): string {
            return entity.id;
        }
    }

    beforeEach(() => {
        query = { count: 2, search: "some" };
        spyFetchByQuery = jest.fn();
        repository = new TestRepository();
    });

    describe("with the loading function returning some result", () => {
        beforeEach(() =>
            spyFetchByQuery.mockImplementation(({ count, search }: TestQuery) => {
                const result: TestEntity[] = [];
                for (let i = 0; i < (count === undefined ? 1 : count); ++i) {
                    result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                }
                return result;
            }),
        );

        describe("`byQuery`", () => {
            describe("first call", () => {
                let returnValue: TestEntity[];

                beforeEach(() => (returnValue = repository.byQuery(query)));

                it("returns empty array", () => expect(returnValue).toEqual([]));

                it("calls `fetchByQuery` with the query", () => expect(spyFetchByQuery).toBeCalledWith(query));

                it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`byQuery` reactivity", () => {
                it("updates after the fetch is done", () => {
                    return new Promise<void>((done) => {
                        let calls = 0;

                        autorun((reaction) => {
                            const result = repository.byQuery({ count: 2, search: "some" });
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
                repository.waitForQuery(query).then(spyResolve1).catch(spyReject1);
                repository.waitForQuery(query).then(spyResolve2).catch(spyReject2);
            });
            it("is still pending", () => {
                expect(spyResolve1).not.toHaveBeenCalled();
                expect(spyReject1).not.toHaveBeenCalled();
                expect(spyResolve2).not.toHaveBeenCalled();
                expect(spyReject2).not.toHaveBeenCalled();
            });

            describe("after invoking `byQueryAsync`", () => {
                beforeEach(() => repository.byQueryAsync(query));

                it("is resolved", () => {
                    expect(spyResolve1).toHaveBeenCalled();
                    expect(spyReject1).not.toHaveBeenCalled();
                    expect(spyResolve2).toHaveBeenCalled();
                    expect(spyReject2).not.toHaveBeenCalled();
                });
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
        });

        describe("invoking `byQueryAsync` during `byQuery`", () => {
            let byQueryAsyncReturnValue: TestEntity[];

            beforeEach(async () => {
                query = { count: 2, search: "some" };
                repository.byQuery(query);
                byQueryAsyncReturnValue = await repository.byQueryAsync(query);
            });

            it("resolves to entities", () =>
                expect(byQueryAsyncReturnValue).toEqual([
                    { id: "id-0", value: "value-some-0" },
                    { id: "id-1", value: "value-some-1" },
                ]));

            it("calls `fetchByQuery` only once", () => expect(spyFetchByQuery).toBeCalledTimes(1));
        });

        describe("`byQueryAsync`", () => {
            let returnValue: TestEntity[];

            beforeEach(async () => {
                returnValue = await repository.byQueryAsync(query);
            });

            it("resolves to entities", () =>
                expect(returnValue).toEqual([
                    { id: "id-0", value: "value-some-0" },
                    { id: "id-1", value: "value-some-1" },
                ]));

            it("calls `fetchByQuery` with the query", () => expect(spyFetchByQuery).toBeCalledWith(query));

            it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));

            describe("consecutive calls to `byQuery`", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                it("returns the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-0", value: "value-some-0" },
                        { id: "id-1", value: "value-some-1" },
                    ]));

                it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`reloadByQuery`", () => {
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

            describe("consecutive calls to `byQueryAsync`", () => {
                let nextReturnValue: TestEntity[];

                beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                it("resolves to the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-0", value: "value-some-0" },
                        { id: "id-1", value: "value-some-1" },
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

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-0", value: "value-some-0" },
                            { id: "id-1", value: "value-some-1" },
                        ]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });
            });

            describe("after evicting an an unrelated entity", () => {
                beforeEach(() => repository.evict("id-1190"));

                describe("calls to `byQuery`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-0", value: "value-some-0" },
                            { id: "id-1", value: "value-some-1" },
                        ]));

                    it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-0", value: "value-some-0" },
                            { id: "id-1", value: "value-some-1" },
                        ]));

                    it("don't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
                });
            });

            describe("after evicting an entity that was part of the query", () => {
                beforeEach(() => repository.evict("id-0"));

                describe("calls to `byQuery`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return empty array", () => expect(nextReturnValue).toEqual([]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestEntity[];

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-0", value: "value-some-0" },
                            { id: "id-1", value: "value-some-1" },
                        ]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });
            });
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
                beforeEach(async () => await repository.byQueryAsync({ search: "some" }));

                it("calls the error listener", () => expect(spyError).toHaveBeenCalledWith(expect.any(Error)));
            });

            describe("after removing the error listener", () => {
                beforeEach(() => repository.removeErrorListener(spyError));

                describe("`byQueryAsync`", () => {
                    beforeEach(async () => await repository.byQueryAsync({ search: "some" }));

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

        class TestRepository extends SearchableRepository<TestEntity, number, number> {
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
                repository
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
                    await new Promise((resolve) => setTimeout(resolve));
                });

                it("resolved", () => expect(resolved).toBe(true));

                it("doesn't reject", () => expect(rejected).toBeUndefined());
            });

            describe("with all requests rejected", () => {
                beforeEach(async () => {
                    promises.forEach(({ reject }) => reject(new Error("Some error.")));
                    await new Promise((resolve) => setTimeout(resolve));
                });

                it("resolved", () => expect(resolved).toBe(true));

                it("doesn't reject", () => expect(rejected).toBeUndefined());
            });
        });
    });
});
