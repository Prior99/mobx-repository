(global as any).setTimeout = (callback: () => void) => callback(); // eslint-disable-line

import { autorun } from "mobx";

import { IndexableRepository } from "../src";

describe("IndexableRepository", () => {
    interface TestEntity {
        id: string;
        value: string;
    }

    let spyFetchById: jest.Mock<TestEntity, [string]>;
    let repository: TestRepository;

    class TestRepository extends IndexableRepository<TestEntity> {
        protected async fetchById(id: string): Promise<TestEntity> {
            return spyFetchById(id);
        }

        protected extractId(entity: TestEntity): string {
            return entity.id;
        }
    }

    beforeEach(() => {
        spyFetchById = jest.fn();
        repository = new TestRepository();
    });

    it("does not know any id", () => expect(repository.isKnown("some")).toBe(false));

    it("does not report any id as loaded", () => expect(repository.isLoaded("some")).toBe(false));

    describe("with the loading function throwing an error", () => {
        beforeEach(() =>
            spyFetchById.mockImplementation(() => {
                throw new Error("Some error");
            }),
        );

        describe("while waiting for an id", () => {
            let waitForIdPromise: Promise<void>;

            beforeEach(() => {
                waitForIdPromise = repository.waitForId("some");
            });

            describe("when invoking `byIdAsync`", () => {
                beforeEach(async () => await repository.byIdAsync("some"));

                it("makes the Promise reject", () => expect(waitForIdPromise).rejects.toEqual(expect.any(Error)));
            });
        });

        describe("after adding an error listener", () => {
            let spyError: jest.Mock<undefined, [Error]>;

            beforeEach(() => {
                spyError = jest.fn();
                repository.addErrorListener(spyError);
            });

            describe("`byIdAsync`", () => {
                beforeEach(async () => await repository.byIdAsync("some"));

                it("calls the error listener", () => expect(spyError).toHaveBeenCalledWith(expect.any(Error)));
            });

            describe("after removing the error listener", () => {
                beforeEach(() => repository.removeErrorListener(spyError));

                describe("`byIdAsync`", () => {
                    beforeEach(async () => await repository.byIdAsync("some"));

                    it("doesn't call the error listener", () => expect(spyError).not.toHaveBeenCalled());
                });
            });
        });
    });

    describe("with the entity not being present", () => {
        beforeEach(() => spyFetchById.mockImplementation(() => undefined));

        describe("`byIdAsync`", () => {
            describe("first call", () => {
                let returnValue: TestEntity | undefined;

                beforeEach(async () => (returnValue = await repository.byIdAsync("some")));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

                it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));
            });
        });
    });

    describe("with the entity having the wrong id", () => {
        beforeEach(() => spyFetchById.mockImplementation((id: string) => ({ id: "other", value: `value-${id}` })));

        describe("after adding an error listener", () => {
            let spyError: jest.Mock<undefined, [Error]>;

            beforeEach(() => {
                spyError = jest.fn();
                repository.addErrorListener(spyError);
            });

            describe("`byIdAsync`", () => {
                let returnValue: TestEntity | undefined;

                beforeEach(async () => (returnValue = await repository.byIdAsync("some")));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls the error listener", () => expect(spyError).toHaveBeenCalledWith(expect.any(Error)));
            });
        });
    });

    describe("with the entity being present", () => {
        beforeEach(() => spyFetchById.mockImplementation((id: string) => ({ id, value: `value-${id}` })));

        describe("`byId`", () => {
            describe("first call", () => {
                let returnValue: TestEntity | undefined;

                beforeEach(() => (returnValue = repository.byId("some")));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

                it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("`byId` reactivity", () => {
                it("updates after the fetch is done", () => {
                    return new Promise<void>(done => {
                        let calls = 0;

                        autorun(reaction => {
                            const result = repository.byId("some");
                            if (calls++ === 0) {
                                expect(result).toBeUndefined();
                            } else {
                                expect(result).toEqual({
                                    id: "some",
                                    value: "value-some",
                                });
                                reaction.dispose();
                                done();
                            }
                        });
                    });
                });
            });
        });

        describe("`mutableCopyById`", () => {
            describe("in its first call", () => {
                let returnValue: TestEntity | undefined;

                beforeEach(() => (returnValue = repository.mutableCopyById("batchId1", "some")));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

                it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            it("updates after the fetch is done", () => {
                return new Promise<void>(done => {
                    let calls = 0;

                    autorun(reaction => {
                        const result = repository.mutableCopyById("batchId1", "some");
                        if (calls++ === 0) {
                            expect(result).toBeUndefined();
                        } else {
                            expect(result).toEqual({
                                id: "some",
                                value: "value-some",
                            });
                            reaction.dispose();
                            done();
                        }
                    });
                });
            });

            describe("after the some entities have been cached", () => {
                beforeEach(async () => {
                    await repository.byIdAsync("entity1");
                    await repository.byIdAsync("entity2");

                    repository.mutableCopyById("batch1", "entity1");
                    repository.mutableCopyById("batch1", "entity2");
                    repository.mutableCopyById("batch2", "entity1");
                });

                describe("after updating the copies", () => {
                    beforeEach(() => {
                        const batch1entity1 = repository.mutableCopyById("batch1", "entity1");
                        const batch1entity2 = repository.mutableCopyById("batch1", "entity2");
                        const batch2entity1 = repository.mutableCopyById("batch2", "entity1");

                        repository.setMutableCopy("batch1", { ...batch1entity1, value: "batch1entity1" });
                        repository.setMutableCopy("batch1", { ...batch1entity2, value: "batch1entity2" });
                        repository.setMutableCopy("batch2", { ...batch2entity1, value: "batch2entity1" });
                    });

                    test.each([["batch1", "entity1"], ["batch1", "entity2"], ["batch2", "entity1"]])(
                        "%p in %p is properly updated",
                        (batchId, entityId) =>
                            expect(repository.mutableCopyById(batchId, entityId)).toStrictEqual({
                                id: entityId,
                                value: batchId + entityId
                            })
                    );

                    test.each(["entity1", "entity2"])(
                        "the immutable original %p is not mutated",
                        (id) => expect(repository.byId(id)).toStrictEqual({ id, value: `value-${id}` })
                    );

                    describe("and discarding some changes", () => {
                        beforeEach(() => {
                            repository.discardMutableCopy("batch1", "entity1");
                        });

                        it("the mutable copy of entity1 in batch1 is reset", () =>
                            expect(repository.mutableCopyById("batch1", "entity1")).toStrictEqual({
                                id: "entity1",
                                value: "value-entity1"
                            })
                        );

                        test.each([["batch1", "entity2"], ["batch2", "entity1"]])(
                            "%p in %p is still in the updated state",
                            (batchId, entityId) =>
                                expect(repository.mutableCopyById(batchId, entityId)).toStrictEqual({
                                    id: entityId,
                                    value: batchId + entityId
                                })
                        );

                        test.each(["entity1", "entity2"])(
                            "the immutable original %p is present and not mutated",
                            (id) => expect(repository.byId(id)).toStrictEqual({ id, value: `value-${id}` })
                        );
                    });
                });

                describe("after resetting the repository, `mutableCopyById`", () => {
                    let nextReturnValue: TestEntity | undefined;

                    beforeEach(() => {
                        repository.reset()
                        nextReturnValue = repository.mutableCopyById("batch1", "entity1");
                    });

                    it("returns `undefined`", () => expect(nextReturnValue).toBeUndefined());

                    // Two initial calls and one call after resetting the repository.
                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(3));
                });
            });
        });

        describe("`mutableCopyByIdAsync`", () => {
            let returnValue: TestEntity | undefined;

            beforeEach(async () => {
                returnValue = await repository.mutableCopyByIdAsync("some", "thing");
                returnValue.value = returnValue.value + "-modified";
            });

            it("returns the entity", () => expect(returnValue).toEqual({ id: "thing", value: "value-thing-modified" }));

            it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("thing"));

            it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));

            describe("a subsequent call to `mutableCopyById`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(() => (nextReturnValue = repository.mutableCopyById("some", "thing")));

                it("returns the entity", () => expect(nextReturnValue).toEqual({ id: "thing", value: "value-thing-modified" }));

                it("doesn't call `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("a subsequent call to `mutableCopyByIdAsync`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(async () => (nextReturnValue = await repository.mutableCopyByIdAsync("some", "thing")));

                it("returns the entity", () => expect(nextReturnValue).toEqual({ id: "thing", value: "value-thing-modified" }));

                it("doesn't call `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("after resetting the repository, `mutableCopyByIdAsync`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(async () => {
                    repository.reset();
                    nextReturnValue = await repository.mutableCopyByIdAsync("some", "thing");
                });

                it("returns the entity", () => expect(nextReturnValue).toEqual({ id: "thing", value: "value-thing" }));

                it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
            });

            describe("after evicting the entity, a call to `mutableCopyByIdAsync`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(async () => {
                    repository.evict("thing");
                    nextReturnValue = await repository.mutableCopyByIdAsync("some", "thing");
                });

                it("returns the entity", () => expect(nextReturnValue).toStrictEqual({ id: "thing", value: "value-thing-modified" }));

                it("doesn't calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(1));
            });
        });

        describe("`waitForId`", () => {
            let waitForIdPromise1: Promise<void>;
            let waitForIdPromise2: Promise<void>;

            beforeEach(async () => {
                waitForIdPromise1 = repository.waitForId("some");
                repository.byId("some");
                waitForIdPromise2 = repository.waitForId("some");
                await new Promise(resolve => setTimeout(resolve));
            });

            it("Promise 1 resolves", () => expect(waitForIdPromise1).resolves.toBeUndefined());

            it("Promise 2 resolves", () => expect(waitForIdPromise2).resolves.toBeUndefined());
        });

        describe("invoking `byIdAsync` during `byId`", () => {
            let byIdAsyncReturnValue: TestEntity | undefined;

            beforeEach(async () => {
                repository.byId("some");
                byIdAsyncReturnValue = await repository.byIdAsync("some");
            });

            it("resolves to the entity", () =>
                expect(byIdAsyncReturnValue).toEqual({
                    id: "some",
                    value: "value-some",
                }));

            it("calls `fetchById` only once", () => expect(spyFetchById).toBeCalledTimes(1));
        });

        describe("`byIdAsync`", () => {
            let returnValue: TestEntity | undefined;

            beforeEach(async () => (returnValue = await repository.byIdAsync("some")));

            it("resolves to the entity", () =>
                expect(returnValue).toEqual({
                    id: "some",
                    value: "value-some",
                }));

            it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

            it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));

            describe("consecutive calls to `byId`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(() => (nextReturnValue = repository.byId("some")));

                it("returns the entity", () =>
                    expect(nextReturnValue).toEqual({
                        id: "some",
                        value: "value-some",
                    }));

                it("doesn't call `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("reloading the entity", () => {
                beforeEach(() => {
                    spyFetchById.mockImplementation((id: string) => ({ id, value: `other-value-${id}` }));
                });

                it("returns the new entity", () =>
                    expect(repository.reloadId("some")).resolves.toEqual({
                        id: "some",
                        value: "other-value-some",
                    }));
            });

            describe("consecutive calls to `byIdAsync`", () => {
                let nextReturnValue: TestEntity | undefined;

                beforeEach(async () => (nextReturnValue = await repository.byIdAsync("some")));

                it("resolves to the entity", () =>
                    expect(nextReturnValue).toEqual({
                        id: "some",
                        value: "value-some",
                    }));

                it("doesn't call `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("after resetting the repository", () => {
                beforeEach(() => repository.reset());

                describe("calls to `byId`", () => {
                    let nextReturnValue: TestEntity | undefined;

                    beforeEach(() => (nextReturnValue = repository.byId("some")));

                    it("returns the `undefined`", () => expect(nextReturnValue).toBeUndefined());

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });

                describe("calls to `byIdAsync`", () => {
                    let nextReturnValue: TestEntity | undefined;

                    beforeEach(async () => (nextReturnValue = await repository.byIdAsync("some")));

                    it("resolves to the entity", () =>
                        expect(nextReturnValue).toEqual({
                            id: "some",
                            value: "value-some",
                        }));

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });
            });

            describe("after evicting the entity", () => {
                beforeEach(() => repository.evict("some"));

                describe("calls to `byId`", () => {
                    let nextReturnValue: TestEntity | undefined;

                    beforeEach(() => (nextReturnValue = repository.byId("some")));

                    it("returns the `undefined`", () => expect(nextReturnValue).toBeUndefined());

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });

                describe("calls to `byIdAsync`", () => {
                    let nextReturnValue: TestEntity | undefined;

                    beforeEach(async () => (nextReturnValue = await repository.byIdAsync("some")));

                    it("resolves to the entity", () =>
                        expect(nextReturnValue).toEqual({
                            id: "some",
                            value: "value-some",
                        }));

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });
            });
        });

        describe("evicting the entity during `byIdAsync` during `byId`", () => {
            let byIdAsyncPromise: Promise<TestEntity | undefined>;

            beforeEach(() => {
                repository.byId("some");
                byIdAsyncPromise = repository.byIdAsync("some");
                repository.evict("some");
            });

            it("makes the Promise reject", () => expect(byIdAsyncPromise).rejects.toEqual(expect.any(Error)));
        });

        describe("invoking `reset` during `byIdAsync` during `byId`", () => {
            let byIdAsyncPromise: Promise<TestEntity | undefined>;

            beforeEach(() => {
                repository.byId("some");
                byIdAsyncPromise = repository.byIdAsync("some");
                repository.reset();
            });

            it("makes the Promise reject", () => expect(byIdAsyncPromise).rejects.toEqual(expect.any(Error)));
        });
    });
});

describe("IndexableRepository with a custom index type and clone function", () => {
    // This testing scenario is deliberately chosen in such a weird fashion.
    // The id of a value is given by flooring it to a multiple of 100.
    // When creating a mutable copy, the value is increased by one
    // (which only changes the internal value) but not the id.

    type TestEntity = number;

    let spyFetchById: jest.Mock<TestEntity, [number]>;
    let repository: TestRepository;

    class TestRepository extends IndexableRepository<TestEntity, number, number> {
        protected async fetchById(id: number): Promise<TestEntity> {
            return spyFetchById(id);
        }

        protected extractId(entity: TestEntity): number {
            return Math.floor(entity / 100) * 100;
        }
    }

    function cloneEntity(entity: TestEntity): TestEntity {
        return entity + 1;
    }

    beforeEach(() => {
        spyFetchById = jest.fn();
        repository = new TestRepository(cloneEntity);
    });

    describe("with the entity being present", () => {
        beforeEach(() => spyFetchById.mockImplementation((id: number) => id));

        describe("`mutableCopyById`", () => {

            describe("first call", () => {
                let returnValue: TestEntity | undefined;

                beforeEach(() => (returnValue = repository.mutableCopyById(1, 100)));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith(100));

                it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            it("updates after the fetch is done", () => {
                return new Promise<void>(done => {
                    let calls = 0;

                    autorun(reaction => {
                        const result = repository.mutableCopyById(2, 200);
                        if (calls++ === 0) {
                            expect(result).toBeUndefined();
                        } else {
                            // Note the custom behavior here.
                            expect(result).toEqual(201);
                            reaction.dispose();
                            done();
                        }
                    });
                });
            });

            describe("call after the some entities have been cached", () => {
                beforeEach(async () => {
                    await repository.byIdAsync(300);
                    await repository.byIdAsync(400);
                });

                describe("after updating the copies", () => {
                    beforeEach(() => {
                        const batch1entity1 = repository.mutableCopyById(1, 300);
                        const batch1entity2 = repository.mutableCopyById(1, 400);
                        const batch2entity1 = repository.mutableCopyById(2, 300);

                        repository.setMutableCopy(1, batch1entity1 + 10);
                        repository.setMutableCopy(1, batch1entity2 + 20);
                        repository.setMutableCopy(2, batch2entity1 + 30);
                    });

                    test.each([[1, 300, 311], [1, 400, 421], [2, 300, 331]])(
                        "%p in %p is properly updated",
                        (batchId, entityId, expectedValue) =>
                            expect(repository.mutableCopyById(batchId, entityId)).toStrictEqual(expectedValue)
                    );

                    describe("and discarding some changes", () => {
                        beforeEach(() => {
                            repository.discardMutableCopy(1, 300);
                        });

                        it("mutable copy of entity1 in batch1 is reset", () =>
                            expect(repository.mutableCopyById(1, 300)).toStrictEqual(301)
                        );

                        test.each([[1, 400, 421], [2, 300, 331]])(
                            "%p in %p is still in the updated state",
                            (batchId, entityId, expectedValue) =>
                                expect(repository.mutableCopyById(batchId, entityId)).toStrictEqual(expectedValue)
                        );
                    });
                });
            });
        });
    });
});
