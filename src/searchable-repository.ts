import { BasicRepository } from "./basic-repository";
import { Listener } from "./listener";
import { RequestStatus, RequestState } from "./request-state";
import { action, transaction } from "mobx";
import { bind } from "bind-decorator";
import { Searchable } from "./searchable";

export interface StateSearchable<TId> {
    resultingIds: Set<TId>;
}

export interface FetchByQueryResult<TModel> {
    entities: TModel[];
}

export abstract class SearchableRepository<
TQuery,
TModel,
TId = string> extends BasicRepository<TModel, TId> implements Searchable<TQuery, TModel> {
    protected stateByQuery = new RequestState<StateSearchable<TId>>(() => ({
        resultingIds: new Set(),
    }));
    protected listenersByQuery = new Map<TQuery, Listener[]>();

    protected abstract async fetchByQuery(query: TQuery): Promise<FetchByQueryResult<TModel>>;

    @bind public byQuery(query: TQuery): TModel[] {
        this.loadByQuery(query);
        return this.resolveEntities(query);
    }

    @bind public async byQueryAsync(query: TQuery): Promise<TModel[]> {
        await this.loadByQuery(query);
        return this.resolveEntities(query);
    }

    @bind public waitForQuery(query: TQuery): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.listenersByQuery.has(query)) {
                this.listenersByQuery.set(query, []);
            }
            this.listenersByQuery.get(query)!.push({ resolve, reject });
        });
    }

    @action.bound public evict(id: TId) {
        super.evict(id);
        this.stateByQuery.forEach(requestState => {
            requestState.state.resultingIds.delete(id);
        });
    }

    @action.bound public reset() {
        super.reset();
        this.listenersByQuery.clear();
        this.stateByQuery.reset();
    }

    @bind protected resolveEntities(query: TQuery): TModel[] {
        const { resultingIds } = this.stateByQuery.getState(query);
        return Array.from(resultingIds.values()).map(id => this.entities.get(id)!);
    }

    @action.bound protected async loadByQuery(query: TQuery): Promise<void> {
        if (this.stateByQuery.isStatus(query, RequestStatus.DONE)) {
            return;
        }
        if (this.stateByQuery.isStatus(query, RequestStatus.IN_PROGRESS, RequestStatus.ERROR)) {
            await this.waitForQuery(query);
            return;
        }
        this.stateByQuery.setStatus(query, RequestStatus.IN_PROGRESS);
        try {
            const { entities } = await this.fetchByQuery(query);
            transaction(() => {
                entities.forEach(entity => this.add(entity));
                const resultingIds = new Set(entities.map(entity => this.extractId(entity)));
                this.stateByQuery.setState(query, { resultingIds });
                if (this.listenersByQuery.has(query)) {
                    this.listenersByQuery.get(query)!.forEach(({ resolve }) => resolve());
                }
                this.stateByQuery.setStatus(query, RequestStatus.DONE);
            });
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
        }
    }
}
