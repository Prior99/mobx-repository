import { autorun } from "mobx";

import { IndexableRepository } from "../src";

describe("IndexableRepository", () => {
    interface TestModel {
        id: string;
        value: string;
    }

    let spyFetchById: jest.Mock<TestModel, [string]>;
    let repository: TestRepository;

    class TestRepository extends IndexableRepository<TestModel> {
        protected async fetchById(id: string): Promise<TestModel> {
            return spyFetchById(id);
        }

        protected extractId(model: TestModel): string {
            return model.id;
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

                it("makes the promise reject", () => expect(waitForIdPromise).rejects.toEqual(expect.any(Error)));
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
                let returnValue: TestModel | undefined;

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
                let returnValue: TestModel | undefined;

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
                let returnValue: TestModel | undefined;

                beforeEach(() => (returnValue = repository.byId("some")));

                it("returns `undefined`", () => expect(returnValue).toBeUndefined());

                it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

                it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));
            });

            describe("`byId` reactivity", () => {
                it("updates after the fetch is done", () => {
                    return new Promise(done => {
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

        describe("`waitForId`", () => {
            let waitForIdPromise1: Promise<void>;
            let waitForIdPromise2: Promise<void>;

            beforeEach(async () => {
                waitForIdPromise1 = repository.waitForId("some");
                repository.byId("some");
                waitForIdPromise2 = repository.waitForId("some");
                await new Promise(resolve => setTimeout(resolve));
            });

            it("promise 1 resolves", () => expect(waitForIdPromise1).resolves.toBeUndefined());

            it("promise 2 resolves", () => expect(waitForIdPromise2).resolves.toBeUndefined());
        });

        describe("invoking `byIdAsync` during `byId`", () => {
            let byIdAsyncReturnValue: TestModel | undefined;

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
            let returnValue: TestModel | undefined;

            beforeEach(async () => (returnValue = await repository.byIdAsync("some")));

            it("resolves to the entity", () =>
                expect(returnValue).toEqual({
                    id: "some",
                    value: "value-some",
                }));

            it("calls `fetchById` with the id", () => expect(spyFetchById).toBeCalledWith("some"));

            it("calls `fetchById` once", () => expect(spyFetchById).toBeCalledTimes(1));

            describe("consecutive calls to `byId`", () => {
                let nextReturnValue: TestModel | undefined;

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
                let nextReturnValue: TestModel | undefined;

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
                    let nextReturnValue: TestModel | undefined;

                    beforeEach(() => (nextReturnValue = repository.byId("some")));

                    it("returns the `undefined`", () => expect(nextReturnValue).toBeUndefined());

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });

                describe("calls to `byIdAsync`", () => {
                    let nextReturnValue: TestModel | undefined;

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
                    let nextReturnValue: TestModel | undefined;

                    beforeEach(() => (nextReturnValue = repository.byId("some")));

                    it("returns the `undefined`", () => expect(nextReturnValue).toBeUndefined());

                    it("calls `fetchById` again", () => expect(spyFetchById).toBeCalledTimes(2));
                });

                describe("calls to `byIdAsync`", () => {
                    let nextReturnValue: TestModel | undefined;

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
            let byIdAsyncPromise: Promise<TestModel | undefined>;

            beforeEach(() => {
                repository.byId("some");
                byIdAsyncPromise = repository.byIdAsync("some");
                repository.evict("some");
            });

            it("makes the promise reject", () => expect(byIdAsyncPromise).rejects.toEqual(expect.any(Error)));
        });

        describe("invoking `reset` during `byIdAsync` during `byId`", () => {
            let byIdAsyncPromise: Promise<TestModel | undefined>;

            beforeEach(() => {
                repository.byId("some");
                byIdAsyncPromise = repository.byIdAsync("some");
                repository.reset();
            });

            it("makes the promise reject", () => expect(byIdAsyncPromise).rejects.toEqual(expect.any(Error)));
        });
    });
});
