import { bind } from "bind-decorator";
import { observable } from "mobx";

export const enum RequestStatus {
    IN_PROGRESS = "in progress",
    NONE = "none",
    ERROR = "error",
    DONE = "done",
    NOT_FOUND = "not found",
}

type RequestInfo<TId, TState, TError> =
    | {
          status: RequestStatus.IN_PROGRESS;
          state: TState;
          id: TId;
      }
    | {
          status: RequestStatus.NONE;
          state: TState;
          id: TId;
      }
    | {
          status: RequestStatus.NOT_FOUND;
          state: TState;
          id: TId;
      }
    | {
          status: RequestStatus.DONE;
          state: TState;
          id: TId;
      }
    | {
          status: RequestStatus.ERROR;
          error: TError;
          state: TState;
          id: TId;
      };

export class RequestState<TId = string, TState = undefined, TError = Error> {
    @observable private requestStates = new Map<string, RequestInfo<TId, TState, TError>>();

    constructor(private stateFactory: () => TState = () => undefined) {}

    @bind public forEach(callback: (info: RequestInfo<TId, TState, TError>) => void): void {
        this.requestStates.forEach(info => callback(info));
    }

    @bind public update(id: TId, info: RequestInfo<TId, TState, TError>): void {
        const key = JSON.stringify(id);
        this.requestStates.set(key, info);
    }

    public setStatus(id: TId, status: RequestStatus): void;
    public setStatus(id: TId, status: RequestStatus.ERROR, error: TError): void;
    @bind public setStatus(id: TId, status: RequestStatus, error?: TError): void {
        const state = this.getState(id);
        this.update(id, { status, error, state, id });
    }

    @bind public setState(id: TId, state: TState): void {
        const current = this.get(id);
        this.update(id, { ...current, state });
    }

    @bind public getState(id: TId): TState {
        return this.get(id).state;
    }

    @bind public isStatus(id: TId, ...status: RequestStatus[]): boolean {
        return status.indexOf(this.get(id).status) !== -1;
    }

    @bind public reset(): void {
        this.requestStates.clear();
    }

    @bind public delete(id: TId): void {
        this.requestStates.delete(JSON.stringify(id));
    }

    @bind protected get(id: TId): RequestInfo<TId, TState, TError> {
        const key = JSON.stringify(id);
        if (!this.requestStates.has(key)) {
            return {
                id,
                status: RequestStatus.NONE,
                state: this.stateFactory(),
            };
        }
        return this.requestStates.get(key);
    }
}
