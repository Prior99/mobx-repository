import { PaginatedRepository, FetchByQueryResult } from "../src";
import { autorun } from "mobx";
import { Pagination } from "../src/pagination";

describe("PaginatedRepository", () => {
    interface TestModel {
        id: string;
        value: string;
    }

    interface TestQuery {
        search?: string;
        length?: number;
    }

    let spyFetchByQuery: jest.Mock<TestModel[], [TestQuery, Pagination]>;
    let repository: TestRepository;
    let query: TestQuery;
    let hugeQuery: TestQuery;
    let pagination: Pagination;

    class TestRepository extends PaginatedRepository<TestQuery, TestModel> {
        protected async fetchByQuery(query: TestQuery, pagination: Pagination): Promise<FetchByQueryResult<TestModel>> {
            return { entities: spyFetchByQuery(query, pagination) };
        }

        protected async fetchById(): Promise<TestModel> {
            throw new Error("Should not be reached.");
        }

        protected extractId(model: TestModel): string {
            return model.id;
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
                const result: TestModel[] = [];
                for (let i = 0; i < (count === undefined ? 1 : length); ++i) {
                    result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                }
                return result.slice(offset, offset + count);
            }),
        );

        describe("`byQuery`", () => {
            describe("first call", () => {
                let returnValue: TestModel[];

                beforeEach(() => (returnValue = repository.byQuery(query)));

                it("returns empty array", () => expect(returnValue).toEqual([]));

                it("calls `fetchByQuery` with the query", () =>
                    expect(spyFetchByQuery).toBeCalledWith(query, {
                        offset: 0,
                        count: 10,
                    }));

                it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`byQuery` reactivity", () => {
                it("updates after the fetch is done", () => {
                    return new Promise(done => {
                        let calls = 0;

                        autorun(reaction => {
                            const result = repository.byQuery(
                                { length: 5, search: "some" },
                                {
                                    offset: 0,
                                    count: 2,
                                },
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
                await repository.byQueryAsync(hugeQuery, { offset: 31, count: 10 });
                await repository.byQueryAsync(hugeQuery, { offset: 51, count: 10 });
                await repository.byQueryAsync(hugeQuery, { offset: 71, count: 10 });
            });

            it("called `fetchByQuery` with those ranges", () => {
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 31, count: 10 });
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 51, count: 10 });
                expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 71, count: 10 });
            });

            describe("after loading a partially loaded included range", () => {
                let returnValue: TestModel[];

                beforeEach(async () => {
                    spyFetchByQuery.mockClear();
                    returnValue = await repository.byQueryAsync(hugeQuery, { offset: 36, count: 20 });
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
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 41, count: 10 });
                });
            });

            describe("after loading a surrounding range", () => {
                let returnValue: TestModel[];

                beforeEach(async () => {
                    returnValue = await repository.byQueryAsync(hugeQuery, { offset: 25, count: 75 });
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
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 25, count: 6 });
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 41, count: 10 });
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 61, count: 10 });
                    expect(spyFetchByQuery).toHaveBeenCalledWith(hugeQuery, { offset: 81, count: 19 });
                });
            });
        });

        describe("`byQueryAsync`", () => {
            let returnValue: TestModel[];

            beforeEach(async () => {
                returnValue = await repository.byQueryAsync(query, pagination);
            });

            it("resolves to entities", () =>
                expect(returnValue).toEqual([
                    { id: "id-1", value: "value-some-1" },
                    { id: "id-2", value: "value-some-2" },
                ]));

            it("calls `fetchByQuery` with the query", () => expect(spyFetchByQuery).toBeCalledWith(query, pagination));

            it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));

            describe("consecutive calls to `byQuery` with same pagination", () => {
                let nextReturnValue: TestModel[];

                beforeEach(() => (nextReturnValue = repository.byQuery(query, pagination)));

                it("returns the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-1", value: "value-some-1" },
                        { id: "id-2", value: "value-some-2" },
                    ]));

                it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("consecutive calls to `byQueryAsync` with same pagination", () => {
                let nextReturnValue: TestModel[];

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
                    let nextReturnValue: TestModel[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return empty array", () => expect(nextReturnValue).toEqual([]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestModel[];

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
                    let nextReturnValue: TestModel[];

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
                beforeEach(() => repository.byQuery(hugeQuery, { offset: 10, count: 25 }));

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

            describe("after loading a subrange", () => {
                beforeEach(() => repository.byQueryAsync(hugeQuery, { offset: 10, count: 25 }));

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
                    beforeEach(() => repository.byQueryAsync(hugeQuery, { offset: 35, count: 25 }));

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
                        await repository.byQueryAsync(hugeQuery, { offset: 35, count: 25 });
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

                it("makes the promise reject", () => expect(waitForQueryPromise).rejects.toEqual(expect.any(Error)));
            });
        });
    });
});
