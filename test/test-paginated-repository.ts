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
    let pagination: Pagination;

    class TestRepository extends PaginatedRepository<TestQuery, TestModel> {
        protected async fetchByQuery(
            query: TestQuery,
            pagination: Pagination,
        ): Promise<FetchByQueryResult<TestModel>> {
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
        pagination = { offset: 1, count: 2 };
        spyFetchByQuery = jest.fn();
        repository = new TestRepository();
    });

    describe("with the loading function returning some result", () => {
        beforeEach(() =>
            spyFetchByQuery.mockImplementation(
                ({ length, search }: TestQuery, { offset, count }: Pagination) => {
                    const result: TestModel[] = [];
                    for (let i = 0; i < (count === undefined ? 1 : length); ++i) {
                        result.push({ id: `id-${i}`, value: `value-${search}-${i}` });
                    }
                    return result.slice(offset, offset + count);
                },
            ),
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
                it("updates after the fetch is done", () => {return new Promise(done => {
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
                })});
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

                beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

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

                    beforeEach(async () => (nextReturnValue = await repository.byQueryAsync(query)));

                    it("doesn't return the entity", () =>
                        expect(nextReturnValue).toEqual([{ id: "id-1", value: "value-some-1" }]));
                });
            });
        });
    });
});
