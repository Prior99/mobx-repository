import { SearchableRepository, FetchByQueryResult } from "../src";
import { autorun } from "mobx";

describe("SearchableRepository", () => {
    interface TestModel {
        id: string;
        value: string;
    }

    interface TestQuery {
        search?: string;
        count?: number;
    }

    let spyFetchByQuery: jest.Mock<TestModel[], [TestQuery]>;
    let repository: TestRepository;
    let query: TestQuery;

    class TestRepository extends SearchableRepository<TestQuery, TestModel> {
        protected async fetchByQuery(query: TestQuery): Promise<FetchByQueryResult<TestModel>> {
            return { entities: spyFetchByQuery(query) };
        }

        protected async fetchById(): Promise<TestModel> {
            throw new Error("Should not be reached.");
        }

        protected extractId(model: TestModel): string {
            return model.id;
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
                const result: TestModel[] = [];
                for (let i = 0; i < (count === undefined ? 1 : count); ++i) {
                    result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                }
                return result;
            }),
        );

        describe("`byQuery`", () => {
            describe("first call", () => {
                let returnValue: TestModel[];

                beforeEach(() => (returnValue = repository.byQuery(query)));

                it("returns empty array", () => expect(returnValue).toEqual([]));

                it("calls `fetchByQuery` with the query", () => expect(spyFetchByQuery).toBeCalledWith(query));

                it("calls `fetchByQuery` once", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("`byQuery` reactivity", () => {
                it("updates after the fetch is done", () => {return new Promise(done => {
                    let calls = 0;

                    autorun(reaction => {
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
                })});
            });
        });

        describe("`waitForQuery`", () => {
            let waitForQueryPromise1: Promise<void>;
            let waitForQueryPromise2: Promise<void>;

            beforeEach(async () => {
                waitForQueryPromise1 = repository.waitForQuery(query);
                repository.byQuery(query);
                waitForQueryPromise2 = repository.waitForQuery(query);
                await new Promise(resolve => setTimeout(resolve));
            });

            it("promise 1 resolves", () => expect(waitForQueryPromise1).resolves.toBeUndefined());

            it("promise 2 resolves", () => expect(waitForQueryPromise2).resolves.toBeUndefined());
        });

        describe("invoking `byQueryAsync` during `byQuery`", () => {
            let byQueryAsyncReturnValue: TestModel[];

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
            let returnValue: TestModel[];

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
                let nextReturnValue: TestModel[];

                beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                it("returns the entities", () =>
                    expect(nextReturnValue).toEqual([
                        { id: "id-0", value: "value-some-0" },
                        { id: "id-1", value: "value-some-1" },
                    ]));

                it("doesn't call `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(1));
            });

            describe("consecutive calls to `byQueryAsync`", () => {
                let nextReturnValue: TestModel[];

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
                    let nextReturnValue: TestModel[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return empty array", () => expect(nextReturnValue).toEqual([]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestModel[];

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                    it("resolves to the entities", () =>
                        expect(nextReturnValue).toEqual([
                            { id: "id-0", value: "value-some-0" },
                            { id: "id-1", value: "value-some-1" },
                        ]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });
            });

            describe("after evicting an entity that was part of the query", () => {
                beforeEach(() => repository.evict("id-0"));

                describe("calls to `byQuery`", () => {
                    let nextReturnValue: TestModel[];

                    beforeEach(() => (nextReturnValue = repository.byQuery(query)));

                    it("return empty array", () => expect(nextReturnValue).toEqual([]));

                    it("calls `fetchByQuery` again", () => expect(spyFetchByQuery).toBeCalledTimes(2));
                });

                describe("calls to `byQueryAsync`", () => {
                    let nextReturnValue: TestModel[];

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

                it("makes the promise reject", () => expect(waitForQueryPromise).rejects.toEqual(expect.any(Error)));
            });
        });
    });
});
