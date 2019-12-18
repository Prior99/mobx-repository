import { RequestStatus, RequestState } from "./request-state";
import { SearchableRepository, FetchByQueryResult, StateSearchable } from "./searchable-repository";
import { action } from "mobx";
import bind from "bind-decorator";
import { PaginationRange } from "./pagination-range";
import { PaginatedSearchable } from "./paginated-searchable";

export interface StatePaginated<TId> extends StateSearchable<TId> {
    paginationCompleted: boolean;
    paginationRange: PaginationRange<TId>;
}

export interface PaginatedFetchByQueryResult<TModel> extends FetchByQueryResult<TModel> {
    entities: TModel[];
}

export abstract class PaginatedRepository<TQuery, TModel, TId = string> implements PaginatedSearchable<TQuery, TModel> {
    protected stateByQuery = new RequestState<StatePaginated<TId>>(() => ({
        paginationCompleted: false,
        paginationRange: new PaginationRange(),
    }));
    protected defaultPageSize = 10;

    protected abstract async fetchByQuery(query: TQuery, pagination?: PaginationQuery): Promise<PaginatedFetchByQueryResult<TModel>>;

    @bind public byQuery(query: TQuery, pagination: PaginationQuery = { offset: 0 }): TModel[] {
        this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind public async byQueryAsync(query: TQuery, pagination: PaginationQuery = { offset: 0 }): Promise<TModel[]> {
        await this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind protected resolveEntities(query: TQuery, { offset, pageSize }: PaginationQuery = { offset: 0 }): TModel[] {
        const { resultingIds } = this.stateByQuery.getState(query);
        const idArray = Array.from(resultingIds.values());
        const selectedIds = pageSize !== undefined ? idArray.slice(offset, offset + pageSize) : idArray.slice(offset);
        return selectedIds.map(id => this.entities.get(id)!);
    }

    @action.bound protected async loadByQuery(query: TQuery, pagination: PaginationQuery = { offset: 0 }): Promise<void> {
        const {
            offset = 0,
            pageSize = this.defaultPageSize,
        } = pagination;
        const {
            offsetLoaded,
            resultingIds,
            paginationCompleted,
        } = this.stateByQuery.getState(query);
        if (offset < offsetLoaded || paginationCompleted) {
            return;
        }
        if (this.stateByQuery.isStatus(query, RequestStatus.IN_PROGRESS, RequestStatus.ERROR)) {
            await this.waitForQuery(query);
            return;
        }
        this.stateByQuery.setStatus(query, RequestStatus.IN_PROGRESS);
        try {
            const { entities, total } = await this.fetchByQuery(query, { offset, pageSize });
            entities.forEach(entity => this.add(entity));
            entities.map(entity => this.extractId(entity)).forEach(id => resultingIds.add(id));
            this.stateByQuery.setState(query, {
                resultingIds,
                total,
                paginationCompleted: entities.length === 0,
                offsetLoaded: offset + entities.length,
            });
            if (this.listenersByQuery.has(query)) {
                this.listenersByQuery.get(query)!.forEach(({ resolve }) => resolve());
            }
            this.stateByQuery.setStatus(query, RequestStatus.DONE);
        } catch(error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
        }
    }
}
