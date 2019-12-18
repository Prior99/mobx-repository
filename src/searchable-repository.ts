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

export abstract class SearchableRepository<TQuery, TModel, TId = string> extends BasicRepository<TModel, TId>
    implements Searchable<TQuery, TModel> {
    protected stateByQuery = new RequestState<TQuery, StateSearchable<TId>>(() => ({
        resultingIds: new Set(),
    }));
    protected listenersByQuery = new Map<string, Listener[]>();

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
        const key = JSON.stringify(query);
        return new Promise((resolve, reject) => {
            if (!this.listenersByQuery.has(key)) {
                this.listenersByQuery.set(key, []);
            }
            this.listenersByQuery.get(key)!.push({ resolve, reject });
        });
    }

    @action.bound public evict(id: TId): void {
        super.evict(id);
        this.stateByQuery.forEach(info => {
            if (info.state.resultingIds.has(id)) {
                this.stateByQuery.delete(info.id);
            }
        });
    }

    @action.bound public reset(): void {
        super.reset();
        this.listenersByQuery.forEach(listener => {
            listener.forEach(({ reject }) => reject(new Error("Repository was reset while waiting.")));
        });
        this.listenersByQuery.clear();
        this.stateByQuery.reset();
    }

    @bind protected resolveEntities(query: TQuery): TModel[] {
        const { resultingIds } = this.stateByQuery.getState(query);
        return [...resultingIds].map(id => this.entities.get(id)!);
    }

    private callListenersByQuery(query: TQuery, error?: Error): void {
        const key = JSON.stringify(query);
        if (!this.listenersByQuery.has(key)) {
            return;
        }
        this.listenersByQuery.get(key)!.forEach(({ resolve, reject }) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
        this.listenersByQuery.delete(key);
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
                this.callListenersByQuery(query);
                this.stateByQuery.setStatus(query, RequestStatus.DONE);
            });
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
            this.callListenersByQuery(query, error);
        }
    }
}
