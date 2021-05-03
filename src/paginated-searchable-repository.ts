import { makeObservable, override, transaction } from "mobx";
import { bind } from "bind-decorator";
import deepEqual from "deep-equal";

import { RequestStates, RequestStatus } from "./request-states";
import { FetchByQueryResult, Searchable } from "./searchable-repository";
import { IndexableRepository } from "./indexable-repository";
import { Pagination } from "./pagination";
import { PromiseCallbacks } from "./listeners";
import { Segment } from "./segment";
import { SegmentWithIds } from "./segment-with-ids";
import { PaginationRange } from "./pagination-range";

/**
 * The request state associated with a request from [[PaginatedSearchableRepository]].
 */
export class StatePaginatedSearchable<TId = string> {
    /**
     * The range of loaded segments within the pagination.
     */
    public paginationRange = new PaginationRange<TId>();
    /**
     * If an upper limit was encountered, it's stored here.
     */
    public limit?: number;
}

/**
 * An object that can be queried with pagination enabled.
 */
export interface PaginatedSearchable<TQuery, TEntity> extends Searchable<TQuery, TEntity> {
    /**
     * Search for entities within the repository.
     * The result will be cached based on the query and pagination.
     *
     * Only ranges that weren't previously loaded will be loaded if a query is invoked multiple times with different
     * ranges.
     * If for example the ranges `0 ... 10`, `20 ... 25` and `50 ... 100` were already loaded and the method
     * is invoked again with a pagination range of `0 ... 200`, then only three calls with the ranges `11 ... 19`,
     * `26 ... 49` and `101 ... 200` * will be performed on the asynchronous provider (e.g. the REST API).
     *
     * Much like [[Indexable.byId]] this method will perform the loading in the background and immediately return.
     * Due to MobX's reactive nature, your observer should detect the change, re-render, call this method again and
     * then get the newly loaded entities.
     *
     * As repositories are implemented as caches, this operation can be performed without cost after the query was
     * initially loaded in the given range. The underlying asynchronous operation will only be performed once.
     *
     * #### Example
     * ```
     *     @observer
     *     class MyComponent extends React.Component<{ id: string }> {
     *         // The currently active page.
     *         @observable private page = 0;
     *
     *         // The current query as entered by the user.
     *         @observable private search = 0;
     *
     *         // The size of each page.
     *         private count = 10;
     *
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         @computed private get offset() {
     *             return this.page * this.count;
     *         }
     *
     *         public render() {
     *             const { offset, page, search, count } = this;
     *             const list = this.myRepository.byQuery({ search }, { offset, count });
     *
     *             // The render method will be invoked a second time,
     *             // and this time the entity should be loaded.
     *             return (
     *                 <div>
     *                     <input value={search} onChange={evt => this.search = evt.currentTarget.value} />
     *                     <ul>
     *                         {
     *                             list.map(entity => <li key={entity.id}>{entity.name}</li>)
     *                         }
     *                     <ul>
     *                     <button onClick={() => this.page++}>Previous Page</button>
     *                     <button onClick={() => this.page--}>Next Page</button>
     *                 </div>
     *             );
     *         }
     *     }
     * ```
     *
     * @param query The query to perform.
     * @param pagination An optional pagination such as `{ offset: 0, count: 100 }`.
     *
     * @return An array of all entities that match the query, are within the given pagination range and are currently
     *     loaded.
     */
    byQuery(query: TQuery, pagination?: Pagination): TEntity[];

    /**
     * Reload a query asynchronously.
     * This will resolve to an array with all entities matching the query, reloading all from the server.
     * The pagination does not designate which segment to reload: The whole query state will always be evicted,
     * the pagination is only used to designate which area should be loaded afterwards.
     *
     * @param query The query to reload.
     *
     * @return A Promise resolving to an array of all entities that matched the query, freshly fetched from the server.
     */
    reloadQuery(query: TQuery, pagination?: Pagination): Promise<TEntity[]>;

    /**
     * Load a query within the specified pagination range asynchronously.
     * Has the same call signature as [[PaginatedSearchable.byQuery]], but returns a Promise.
     * This will resolve to an array with all entities matching the query and within the pagination range.
     *
     *
     * As repositories are implemented as caches, this operation can be performed without cost after the query was
     * initially loaded in the given range. The underlying asynchronous operation will only be performed once.
     *
     * #### Example
     * ```
     *     class MyService {
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         public async getNames(query: MyQuery, pagination: Pagination): Promise<name> {
     *             const result = await this.myRepository.byQueryAsync(query, pagination);
     *             return result.map(entity => entity.name);
     *         }
     *     }
     * ```
     *
     * @throws Will throw if loading the entity failed or if an entity contained within this query was evicted after
     *     being loaded but before this Promise resolved.
     *
     * @param query The query to perform.
     * @param pagination An optional pagination such as `{ offset: 0, count: 100 }`.
     *
     * @return A Promise resolving to an array of all entities that matched the query and are within the given
     *     pagination range.
     */
    byQueryAsync(query: TQuery, pagination?: Pagination): Promise<TEntity[]>;

    /**
     * Waits for a specified query to be available in the given range, without triggering it to load or resolving to it.
     *
     * #### Example
     * ```
     * const myRepository: MyRepository = ...;
     *
     * async function spyOnQueryInRange(query: MyQuery, pagination: Pagination): Promise<void> {
     *     await myRepository.waitForQuery(query, pagination);
     *     console.info(
     *         `The query ${JSON.stringify(query)} is now completely available in range ${JSON.stringify(pagination)}.`,
     *     );
     * }
     *
     * spyOnQueryInRange({ search: "my name" }, { offset: 10, count: 40 });
     *
     * await myRepository.byQueryAsync({ search: "my name" }, { offset: 0, count: 20 });
     * // The Promise should not yet have resolved, as part of the range is missing.
     * await myRepository.byQueryAsync({ search: "my name" }, { offset: 21, count: 30 });
     * // The Promise should now have resolved, as the query is fully loaded.
     * ```
     *
     * @throws Will throw if loading any part of the query failed, or if an entity contained within this query was
     *     evicted after being loaded but before this Promise resolved.
     *
     * @param query The query to wait for.
     * @param pagination An optional pagination such as `{ offset: 0, count: 100 }`.
     *
     * @return A Promise resolving once the query is fully available in the given range of pagination.
     */
    waitForQuery(query: TQuery, partialPagination?: Partial<Pagination>): Promise<void>;

    /**
     * Checks whether a specified query was out of bounds earlier, in the specified range.
     *
     * @param query The query to check.
     * @param pagination The pagination to check.
     */
    wasOutOfBounds(query: TQuery, pagination: Pagination): boolean;
}

/**
 * A wrapper around [[PromiseCallbacks]], specifying for what the listener is waiting exactly.
 */
interface ListenerSpecification<TQuery> {
    /**
     * The query the listener is waiting for.
     */
    query: TQuery;

    /**
     * The pagination range the listener is waiting for.
     */
    pagination: Pagination;

    /**
     * The listener's callbacks.
     */
    listener: PromiseCallbacks;
}

/**
 * An abstract class implementing [[PaginatedSearchable]] providing all its caching operations.
 * In addition to the abstract methods of [[IndexableRepository]], which this class extends, one additional abstract
 * method needs to be implemented: [[PaginatedSearchableRepository.fetchByQuery]]. It will be invoked if a given
 * range of paginated search results is not yet loaded and needs to resolve to an array of entities matching the
 * given query and being within the range of the specified pagination.
 *
 * #### Example
 * ```
 * interface MyEntity {
 *     id: number;
 *     name: string;
 * }
 *
 * interface MyQuery {
 *     search: string;
 * }
 *
 * class MyRepository extends PaginatedSearchableRepository<MyQuery, MyEntity, number> {
 *     protected extractId(entity: MyEntity): number {
 *         return entity.id;
 *     }
 *
 *     protected async fetchById(id: number): Promise<MyEntity> {
 *         const response = await fetch(`http://example.com/api/my-entity/${id}`);
 *         if (response.status === 404) {
 *             return;
 *         }
 *         const body = await response.json();
 *         return body;
 *     }
 *
 *     protected async fetchByQuery(query: MyQuery, pagination: Pagination): Promise<FetchByQueryResult<MyEntity>> {
 *         const { search } = query;
 *         const { offset, count } = pagination;
 *         const url = `http://example.com/api/my-entity?search=${search}&start=${offset}&count=${count}`;
 *         const response = await fetch(url);
 *         if (response.status === 404) {
 *             return { entities: [] };
 *         }
 *         const body = await response.json();
 *         return { entities: body.searchResult };
 *     }
 * }
 * ```
 */
export abstract class PaginatedSearchableRepository<TQuery, TEntity, TId = string, TBatchId = string>
    extends IndexableRepository<TEntity, TId, TBatchId>
    implements PaginatedSearchable<TQuery, TEntity> {

    constructor(cloneEntity?: (entity: TEntity) => TEntity) {
        super(cloneEntity);
        makeObservable(this);
    }

    /**
     * The state of all requests performed to load entities by query.
     * This includes the request's states as well as the currently loaded range of pagination.
     */
    protected stateByQuery = new RequestStates<TQuery, StatePaginatedSearchable<TId>>(
        () => new StatePaginatedSearchable(),
    );

    /**
     * All listeners attached to this repository in [[PaginatedSearchableRepository.waitForQuery]].
     */
    protected listenersByQuery = new Set<ListenerSpecification<TQuery>>();
    /**
     * This value is used if a provided pagination is under specified.
     * Can be overridden to change the default page size.
     */
    protected defaultCount = 10;

    /**
     * Perform the actual loading of all entities matching the given query and within the specified pagination range.
     * It is okay to have this method reject with an error, but a result must be returned otherwise.
     * If no entities could be found, return an empty array.
     *
     * #### Example
     * ```
     * protected async fetchByQuery(query: MyQuery, pagination: Pagination): Promise<FetchByQueryResult<MyEntity>> {
     *     const { search } = query;
     *     const { offset, count } = pagination;
     *     const url = `http://example.com/api/my-entity?search=${search}&start=${offset}&count=${count}`;
     *     const response = await fetch(url);
     *     if (response.status === 404) {
     *         return { entities: [] };
     *     }
     *     const body = await response.json();
     *     return { entities: body.searchResult };
     * }
     * ```
     *
     * @param query The query to execute.
     * @param pagination The pagination range to load.
     *
     * @return The array of resulting entities, wrapped in [[FetchByQueryResult]].
     */
    protected abstract fetchByQuery(query: TQuery, pagination: Segment): Promise<FetchByQueryResult<TEntity>>;

    /** @inheritdoc */
    @bind public byQuery(query: TQuery, pagination: Partial<Pagination> = {}): TEntity[] {
        setTimeout(() => this.loadByQuery(query, pagination));
        return this.resolveEntities(query, pagination);
    }

    /** @inheritdoc */
    @bind public async byQueryAsync(query: TQuery, pagination: Partial<Pagination> = {}): Promise<TEntity[]> {
        await this.loadByQuery(query, pagination);
        return this.resolveEntities(query, pagination);
    }

    /** @inheritdoc */
    @bind public waitForQuery(query: TQuery, partialPagination: Partial<Pagination> = {}): Promise<void> {
        const pagination = this.completePagination(partialPagination);
        return new Promise((resolve, reject) => {
            const listener = { resolve, reject };
            this.listenersByQuery.add({ query, pagination, listener });
        });
    }

    @bind protected resolveEntities(query: TQuery, partialPagination: Partial<Pagination>): TEntity[] {
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

    /** @inheritdoc */
    @override public evict(id: TId): void {
        super.evict(id);
        this.stateByQuery.forEach(info => {
            if (info.state.paginationRange.hasId(id)) {
                this.stateByQuery.delete(info.id);
                this.callListenersByQuery(info.id, new Error("Entity was evicted while waiting."));
            }
        });
    }

    /** @inheritdoc */
    @bind public async reloadQuery(query: TQuery, pagination: Partial<Pagination> = {}): Promise<TEntity[]> {
        return await transaction(async () => {
            this.stateByQuery.delete(query);
            return await this.byQueryAsync(query, pagination);
        });
    }

    /** @inheritdoc */
    @override public reset(): void {
        super.reset();
        this.listenersByQuery.forEach(({ listener }) =>
            listener.reject(new Error("Repository was reset while waiting.")),
        );
        this.listenersByQuery.clear();
        this.stateByQuery.reset();
    }

    @bind private callListenersByQuery(query: TQuery, error?: Error): void {
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

    /** @inheritdoc */
    @bind public wasOutOfBounds(query: TQuery, pagination: Pagination): boolean {
        const { limit } = this.stateByQuery.getState(query);
        if (typeof limit !== "number") { return false; }
        return limit < pagination.count + pagination.offset;
    }

    @bind private async loadByQuery(query: TQuery, partialPagination: Partial<Pagination>): Promise<void> {
        const pagination = this.completePagination(partialPagination);
        if (
            this.isQueryDoneInRange(query, pagination) ||
            this.stateByQuery.isStatus(query, RequestStatus.ERROR) ||
            this.wasOutOfBounds(query, pagination)
        ) {
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
            this.stateByQuery.setStatus(query, RequestStatus.DONE);
            this.callListenersByQuery(query);
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
            this.callListenersByQuery(query, error);
        }
    }

    @bind private async loadIndividualRange(
        query: TQuery,
        segment: Segment,
    ): Promise<FetchByQueryResult<TEntity>> {
        const result = await this.fetchByQuery(query, segment);
        transaction(() => {
            result.entities.forEach(entity => this.add(entity));
            const ids = new Set(result.entities.map(entity => this.extractId(entity)));
            const state = this.stateByQuery.getState(query);
            state.paginationRange.add(new SegmentWithIds(segment.offset, ids));
            if (result.entities.length < segment.count) {
                state.limit = segment.offset + result.entities.length;
            }
        });
        return result;
    }

    @bind private completePagination(partialPagination: Partial<Pagination>): Pagination {
        return { count: partialPagination.count ?? this.defaultCount, offset: partialPagination.offset ?? 0 };
    }
}
