import { RequestState, RequestStatus } from "../src";

describe("RequestState", () => {
    interface TestState {
        value: string;
    }

    let requestState: RequestState<TestState>;

    describe("without factory", () => {
        beforeEach(() => {
            requestState = new RequestState();
        });

        describe("initially", () => {
            it("has status `NONE` for any id", () => {
                expect(requestState.isStatus("some", RequestStatus.NONE)).toBe(true);
            });

            it("has `undefined` for any id", () => {
                expect(requestState.getState("some")).toBeUndefined();
            });
        });
    });

    describe("with factory", () => {
        let stateFactory: jest.Mock<TestState, []>;

        beforeEach(() => {
            stateFactory = jest.fn(() => ({ value: "from factory" }));
            requestState = new RequestState(stateFactory);
        });

        describe("initially", () => {
            it("does nothing in `forEach`", () => requestState.forEach(() => fail()));

            it("has status `NONE` for any id", () => {
                expect(requestState.isStatus("some", RequestStatus.NONE)).toBe(true);
            });

            it("has initial state for any id", () => {
                expect(requestState.getState("some")).toEqual({ value: "from factory" });
            });
        });

        describe("after setting the state of an id", () => {
            beforeEach(() => requestState.setState("some", { value: "updated" }));

            it("encounters id in `forEach`", () => {
                const spyForEach = jest.fn();
                requestState.forEach(spyForEach);
                expect(spyForEach).toHaveBeenCalledWith({
                    status: RequestStatus.NONE,
                    state: { value: "updated" },
                    error: undefined,
                });
            });

            it("has same status for that id", () => {
                expect(requestState.isStatus("some", RequestStatus.NONE)).toBe(true);
            });

            it("has initial state for any id", () => {
                expect(requestState.getState("some")).toEqual({ value: "updated" });
            });

            describe("after setting the status of that id", () => {
                beforeEach(() => requestState.setStatus("some", RequestStatus.IN_PROGRESS));

                it("has new status for that id", () => {
                    expect(requestState.isStatus("some", RequestStatus.IN_PROGRESS)).toBe(true);
                });

                it("has same state for any id", () => {
                    expect(requestState.getState("some")).toEqual({ value: "updated" });
                });
            });
        });

        describe("after setting the status of an id", () => {
            beforeEach(() => requestState.setStatus("some", RequestStatus.IN_PROGRESS));

            it("encounters id in `forEach`", () => {
                const spyForEach = jest.fn();
                requestState.forEach(spyForEach);
                expect(spyForEach).toHaveBeenCalledWith({
                    status: RequestStatus.IN_PROGRESS,
                    state: { value: "from factory" },
                    error: undefined,
                });
            });

            it("has new status for that id", () => {
                expect(requestState.isStatus("some", RequestStatus.IN_PROGRESS)).toBe(true);
            });

            it("has initial state for any id", () => {
                expect(requestState.getState("some")).toEqual({ value: "from factory" });
            });

            describe("after setting the state of an id", () => {
                beforeEach(() => requestState.setState("some", { value: "updated" }));

                it("has new status for that id", () => {
                    expect(requestState.isStatus("some", RequestStatus.IN_PROGRESS)).toBe(true);
                });

                it("has same state for any id", () => {
                    expect(requestState.getState("some")).toEqual({ value: "updated" });
                });

                describe("after reset", () => {
                    beforeEach(() => requestState.reset());

                    it("does nothing in `forEach`", () => requestState.forEach(() => fail()));

                    it("has status `NONE` for any id", () => {
                        expect(requestState.isStatus("some", RequestStatus.NONE)).toBe(true);
                    });

                    it("has initial state for any id", () => {
                        expect(requestState.getState("some")).toEqual({ value: "from factory" });
                    });
                });

                describe("after deleting the id", () => {
                    beforeEach(() => requestState.delete("some"));

                    it("does nothing in `forEach`", () => requestState.forEach(() => fail()));

                    it("has status `NONE` for any id", () => {
                        expect(requestState.isStatus("some", RequestStatus.NONE)).toBe(true);
                    });

                    it("has initial state for any id", () => {
                        expect(requestState.getState("some")).toEqual({ value: "from factory" });
                    });
                });
            });
        });
    });
});
