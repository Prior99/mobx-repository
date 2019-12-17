import { observable } from "mobx";
import bind from "bind-decorator";

export const enum RequestStatus {
    IN_PROGRESS = "in progress",
    NONE = "none",
    ERROR = "error",
    DONE = "done",
    NOT_FOUND = "not found",
}

type RequestInfo<TState, TError> = {
    status: RequestStatus.IN_PROGRESS,
    state: TState,
} | {
    status: RequestStatus.NONE
    state: TState,
} | {
    status: RequestStatus.NOT_FOUND,
    state: TState,
} | {
    status: RequestStatus.DONE,
    state: TState,
} | {
    status: RequestStatus.ERROR,
    error: TError,
    state: TState,
};

export class RequestState<TState = undefined, TError = Error> {
    @observable private requestStates = new Map<string, RequestInfo<TState, TError>>();

    constructor(private stateFactory: () => TState = () => undefined) {}

    @bind public forEach(callback: (info: RequestInfo<TState, TError>) => void) {
        this.requestStates.forEach((info) => callback(info));
    }

    @bind public update(id: unknown, info: RequestInfo<TState, TError>): void {
        const key = JSON.stringify(id);
        this.requestStates.set(key, info);
    }

    public setStatus(id: unknown, status: RequestStatus): void;
    public setStatus(id: unknown, status: RequestStatus.ERROR, error: TError): void;
    @bind public setStatus(id: unknown, status: RequestStatus, error?: TError): void {
        const state = this.getState(id);
        this.update(id, { status, error, state });
    }

    @bind public setState(id: unknown, state: TState) {
        const current = this.get(id);
        this.update(id, { ...current, state });
    }

    @bind public getState(id: unknown): TState {
        return this.get(id).state;
    }

    @bind public isStatus(id: unknown, ...status: RequestStatus[]) {
        return status.indexOf(this.get(id).status) !== -1;
    }

    @bind public reset() {
        this.requestStates.clear();
    }

    @bind public delete(id: unknown) {
        this.requestStates.delete(JSON.stringify(id));
    }

    @bind protected get(id: unknown): RequestInfo<TState, TError> {
        const key = JSON.stringify(id);
        if (!this.requestStates.has(key)) {
            return {
                status: RequestStatus.NONE,
                state: this.stateFactory(),
            };
        }
        return this.requestStates.get(key);
    }
}
