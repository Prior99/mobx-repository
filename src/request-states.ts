import { action, makeObservable, observable } from "mobx";

/**
 * The status of some request.
 */
export const enum RequestStatus {
    /**
     * The request is currently being performed. The Promise for loading it has been dispatched but is still
     * pending.
     */
    IN_PROGRESS = "in progress",

    /**
     * The request is unknown. It has not yet been started.
     */
    NONE = "none",

    /**
     * An error occurred when this request was performed.
     */
    ERROR = "error",

    /**
     * The request has successfully been done.
     */
    DONE = "done",

    /**
     * The request was performed, but nothing was found.
     */
    NOT_FOUND = "not found",
}

/**
 * Information about a specific request.
 */
interface BaseRequestInfo<TId, TState> {
    /**
     * The id of the request. Note that this doesn't necessarily have to be the id of an entity,
     * if the request was about loading a query, it might also be the query.
     */
    id: TId;

    /**
     * The current status the request is in.
     */
    status: RequestStatus;

    /**
     * Additional information about the request.
     */
    state: TState;
}

/**
 * Information about a specific request.
 */
export type RequestInfo<TId, TState, TError> =
    | BaseRequestInfo<TId, TState>
    | ({
          status: RequestStatus.ERROR;

          /**
           * If the request encountered an error, this is the error that occurred.
           */
          error: TError;
      } & BaseRequestInfo<TId, TState>);

/**
 * Information (such as status, error and state) about a set of requests.
 */
export class RequestStates<TId = string, TState = undefined, TError = Error> {
    @observable public requestStates = new Map<string, RequestInfo<TId, TState, TError>>();

    constructor(private stateFactory: () => TState = () => undefined) {
        makeObservable(this);
    }

    /**
     * Perform an operation on all instances of [[RequestInfo]] known by this instance.
     *
     * @param callback A method called once for every known [[RequestInfo]].
     */
    public forEach(callback: (info: RequestInfo<TId, TState, TError>) => void): void {
        this.requestStates.forEach(info => callback(info));
    }

    /**
     * Overwrite the state and status for the given request.
     *
     * @param info The request status to overwrite.
     */
    @action.bound public update(info: RequestInfo<TId, TState, TError>): void {
        const key = JSON.stringify(info.id);
        this.requestStates.set(key, info);
    }

    /**
     * Update the status for the specified request.
     * Can always be safely invoked, even if the request was not known before.
     * 
     * @param id The id of the request to update.
     * @param status The new status.
     */
    public setStatus(id: TId, status: RequestStatus): void;
    /**
     * Update the status for the specified request to be an error.
     * 
     * @param id The id of the request to update.
     * @param error The error that occurred.
     * @param status The new status.
     */
    public setStatus(id: TId, status: RequestStatus.ERROR, error: TError): void;
    @action.bound public setStatus(id: TId, status: RequestStatus, error?: TError): void {
        const state = this.getState(id);
        if (error) {
            this.update({ status: RequestStatus.ERROR, error, state, id });
        } else {
            this.update({ status, state, id });
        }
    }

    /**
     * Update the state for the specified request.
     * Can always be safely invoked, even if the request was not known before.
     * 
     * @param id The id of the request to update.
     * @param state The new state.
     */
    @action.bound public setState(id: TId, state: TState): void {
        const current = this.get(id);
        this.update({ ...current, state });
    }

    /**
     * Retrieve the state for the specified request.
     * Can always be safely invoked, even if the request was not known before.
     * A new state will be initialized then.
     * The returned state can safely be mutated.
     * 
     * @param id The id of the request to get the state of.
     * 
     * @return The state.
     */
    public getState(id: TId): TState {
        return this.get(id).state;
    }

    /**
     * Check if the specified request is in any of the provided status.
     * 
     * @param id The id of the request to check.
     * @param status A list of status. The request must be in any of those status.
     * 
     * @return `true` if the request's status was included in the list of specified status and `false` otherwise.
     */
    public isStatus(id: TId, ...status: RequestStatus[]): boolean {
        return status.indexOf(this.get(id).status) !== -1;
    }

    /**
     * Reset all information about all requests.
     */
    @action.bound public reset(): void {
        this.requestStates.clear();
    }

    /**
     * Delete all information about the specified request.
     * The request can afterwards still be retrieved, but will then be reinitialized.
     * 
     * @param id The id of the request to delete.
     */
    @action.bound public delete(id: TId): void {
        this.requestStates.delete(JSON.stringify(id));
    }

    /**
     * Get all information about the specified request.
     * 
     * @param id Id of the request.
     * 
     * @return All information about the specified request.
     */
    public get(id: TId): RequestInfo<TId, TState, TError> {
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
