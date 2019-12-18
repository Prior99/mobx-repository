import { RequestState, RequestStatus } from "./request-state";
import { FetchByQueryResult } from "./searchable-repository";
import { action, transaction } from "mobx";
import bind from "bind-decorator";
import { PaginatedSearchable } from "./paginated-searchable";
import { BasicRepository } from "./basic-repository";
import { Pagination } from "./pagination";
import { Listener } from "./listener";
import { PaginationState } from "./pagination-state";
import { Segment } from "./segment";
import { SegmentWithIds } from "./segment-with-ids";
import deepEqual from "deep-equal";

export interface ListenerSpecification<TQuery> {
    query: TQuery;
    pagination: Pagination;
    listener: Listener;
}

export abstract class PaginatedRepository<TQuery, TModel, TId = string> extends BasicRepository<TModel, TId>
    implements PaginatedSearchable<TQuery, TModel> {
    protected stateByQuery = new RequestState<TQuery, PaginationState<TId>>(() => new PaginationState());
    protected listenersByQuery = new Set<ListenerSpecification<TQuery>>();
    protected defaultCount = 10;

    private get defaultPagination(): Pagination {
        return { offset: 0, count: this.defaultCount };
    }

    private completePagination(partialPagination: Partial<Pagination>): Pagination {
        return { ...this.defaultPagination, ...partialPagination };
    }

    protected abstract async fetchByQuery(query: TQuery, segment: Segment): Promise<FetchByQueryResult<TModel>>;

    @bind public byQuery(query: TQuery, pagination: Partial<Pagination> = {}): TModel[] {
        this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind public async byQueryAsync(query: TQuery, pagination: Partial<Pagination> = {}): Promise<TModel[]> {
        await this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    @bind public waitForQuery(query: TQuery, partialPagination: Partial<Pagination> = {}): Promise<void> {
        const pagination = this.completePagination(partialPagination);
        return new Promise((resolve, reject) => {
            const listener = { resolve, reject };
            this.listenersByQuery.add({ query, pagination, listener });
        });
    }

    @bind protected resolveEntities(query: TQuery, partialPagination: Partial<Pagination>): TModel[] {
        const pagination = this.completePagination(partialPagination);
        const { paginationRange } = this.stateByQuery.getState(query);
        return [...paginationRange.getIds(pagination)].map(id => this.entities.get(id)!);
    }

    @bind private isQueryDoneInRange(query: TQuery, pagination: Pagination): boolean {
        if (!this.stateByQuery.isStatus(query, RequestStatus.DONE)) {
            return false;
        }
        return this.stateByQuery.getState(query).paginationRange.isFullyLoaded(pagination);
    }

    @action.bound public evict(id: TId): void {
        super.evict(id);
        this.stateByQuery.forEach(info => {
            if (info.state.paginationRange.hasId(id)) {
                this.stateByQuery.delete(info.id);
                this.callListenersByQuery(info.id, new Error("Entity was evicted while waiting."));
            }
        });
    }

    @action.bound public reset(): void {
        super.reset();
        this.listenersByQuery.forEach(({ listener }) => listener.reject(new Error("Store was reset while waiting.")));
        this.listenersByQuery.clear();
        this.stateByQuery.reset();
    }

    private callListenersByQuery(query: TQuery, error?: Error): void {
        [...this.listenersByQuery]
            .filter(listenerSpec => deepEqual(query, listenerSpec.query))
            .forEach(listenerSpec => {
                const completed = this.stateByQuery
                    .getState(query)
                    .paginationRange.isFullyLoaded(listenerSpec.pagination);
                if (!error && !completed) {
                    return;
                }
                this.listenersByQuery.delete(listenerSpec);
                if (error) {
                    listenerSpec.listener.reject(error);
                } else {
                    listenerSpec.listener.resolve();
                }
            });
    }

    @action.bound protected async loadByQuery(query: TQuery, partialPagination: Partial<Pagination>): Promise<void> {
        const pagination = this.completePagination(partialPagination);
        if (this.isQueryDoneInRange(query, pagination) || this.stateByQuery.isStatus(query, RequestStatus.ERROR)) {
            return;
        }
        if (this.stateByQuery.isStatus(query, RequestStatus.IN_PROGRESS)) {
            await this.waitForQuery(query, pagination);
            return await this.loadByQuery(query, pagination);
        }
        this.stateByQuery.setStatus(query, RequestStatus.IN_PROGRESS);
        const segmentsToLoad = this.stateByQuery.getState(query).paginationRange.getMissingSegments(pagination);
        try {
            await Promise.all(segmentsToLoad.map(segment => this.loadIndividualRange(query, segment)));
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
            this.callListenersByQuery(query, error);
        }
        this.stateByQuery.setStatus(query, RequestStatus.DONE);
        this.callListenersByQuery(query);
    }

    @action.bound private async loadIndividualRange(
        query: TQuery,
        segment: Segment,
    ): Promise<FetchByQueryResult<TModel>> {
        const result = await this.fetchByQuery(query, segment);
        transaction(() => {
            result.entities.forEach(entity => this.add(entity));
            const ids = new Set(result.entities.map(entity => this.extractId(entity)));
            this.stateByQuery.getState(query).paginationRange.add(new SegmentWithIds(segment.offset, ids));
        });
        return result;
    }
}
