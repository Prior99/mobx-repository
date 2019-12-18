import { RequestStatus, RequestState } from "./request-state";
import { FetchByQueryResult } from "./searchable-repository";
import { action } from "mobx";
import bind from "bind-decorator";
import { PaginationRange } from "./pagination-range";
import { PaginatedSearchable } from "./paginated-searchable";
import { BasicRepository } from "./basic-repository";
import { Pagination } from "./pagination";
import { Listener } from "./listener";

export interface StatePaginated<TId> {
    paginationCompleted: boolean;
    paginationRange: PaginationRange<TId>;
}

export interface PaginatedFetchByQueryResult<TModel> extends FetchByQueryResult<TModel> {
    entities: TModel[];
}

export abstract class PaginatedRepository<TQuery, TModel, TId = string> extends BasicRepository<TModel, TId>
    implements PaginatedSearchable<TQuery, TModel> {
    protected stateByQuery = new RequestState<StatePaginated<TId>>(() => ({
        paginationCompleted: false,
        paginationRange: new PaginationRange(),
    }));
    protected listenersByQuery = new Map<TQuery, Listener[]>();
    protected defaultCount = 10;

    protected abstract async fetchByQuery(
        query: TQuery,
        pagination?: Pagination,
    ): Promise<PaginatedFetchByQueryResult<TModel>>;

    @bind public byQuery(query: TQuery, pagination: Pagination = { offset: 0, count: this.defaultCount }): TModel[] {
        this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind public async byQueryAsync(
        query: TQuery,
        pagination: Pagination = { offset: 0, count: this.defaultCount },
    ): Promise<TModel[]> {
        await this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind public waitForQuery(_query: TQuery): Promise<void> {
        throw new Error();
    }

    @bind protected resolveEntities(
        _query: TQuery,
        _pagination: Pagination = { offset: 0, count: this.defaultCount },
    ): TModel[] {
        throw new Error();
    }

    @action.bound protected async loadByQuery(
        query: TQuery,
        pagination: Pagination = { offset: 0, count: this.defaultCount },
    ): Promise<void> {
        const { offset, count } = pagination;
        const { offsetLoaded, resultingIds, paginationCompleted } = this.stateByQuery.getState(query);
        if (offset < offsetLoaded || paginationCompleted) {
            return;
        }
        if (this.stateByQuery.isStatus(query, RequestStatus.IN_PROGRESS, RequestStatus.ERROR)) {
            await this.waitForQuery(query);
            return;
        }
        this.stateByQuery.setStatus(query, RequestStatus.IN_PROGRESS);
        try {
            const { entities } = await this.fetchByQuery(query, {
                offset,
                count,
            });
            entities.forEach(entity => this.add(entity));
            entities.map(entity => this.extractId(entity)).forEach(id => resultingIds.add(id));
            this.stateByQuery.setState(query, {
                resultingIds,
                paginationCompleted: entities.length === 0,
                offsetLoaded: offset + entities.length,
            });
            const listeners = this.listenersByQuery.get(query);
            if (listeners) {
                listeners.forEach(({ resolve }) => resolve());
            }
            this.stateByQuery.setStatus(query, RequestStatus.DONE);
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
        }
    }
}
