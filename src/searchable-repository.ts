import { action, transaction } from "mobx";
import { bind } from "bind-decorator";

import { IndexableRepository } from "./indexable-repository";
import { PromiseCallbacks } from "./listeners";
import { RequestStatus, RequestStates } from "./request-states";


/**
 * The request state associated with a request from [[SearchableRepository]].
 */
export interface StateSearchable<TId> {
    /**
     * All ids that belong to the specific request.
     */
    resultingIds: Set<TId>;
}

/**
 * The result of fetching entities by query.
 */
export interface FetchByQueryResult<TEntity> {
    /**
     * List of all entities matched by this query.
     */
    entities: TEntity[];
}

/**
 * An object that can be queried.
 */
export interface Searchable<TQuery, TEntity> {
    /**
     * Search for entities within the repository.
     * The result will be cached based on the query.
     *
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
     *         // The current query as entered by the user.
     *         @observable private search = 0;
     * 
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         public render() {
     *             const { search } = this;
     *             const list = this.myRepository.byQuery({ search });
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
     *                 </div>
     *             );
     *         }
     *     }
     * ```
     *
     * @param query The query to perform.
     *
     * @return An array of all entities that match the query and are currently loaded.
     */
    byQuery(query: TQuery): TEntity[];

    /**
     * Reload a query asynchronously.
     * This will resolve to an array with all entities matching the query, reloading all from the server.
     *
     * @param query The query to reload.
     *
     * @return A Promise resolving to an array of all entities that matched the query, freshly fetched from the server.
     */
    reloadQuery(query: TQuery): Promise<TEntity[]>;

    /**
     * Load a query asynchronously.
     * Has the same call signature as [[Searchable.byQuery]], but returns a Promise.
     * This will resolve to an array with all entities matching the query.
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
     *         public async getNames(query: MyQuery): Promise<name> {
     *             const result = await this.myRepository.byQueryAsync(query);
     *             return result.map(entity => entity.name);
     *         }
     *     }
     * ```
     *
     * @throws Will throw if loading the entity failed or if an entity contained within this query was evicted after
     *     being loaded but before this Promise resolved.
     *
     * @param query The query to perform.
     *
     * @return A Promise resolving to an array of all entities that matched the query.
     */
    byQueryAsync(query: TQuery): Promise<TEntity[]>;

    /**
     * Waits for a specified query to be available, without triggering it to load or resolving to it.
     *
     * #### Example
     * ```
     * const myRepository: MyRepository = ...;
     *
     * async function spyOnQuery(query: MyQuery): Promise<void> {
     *     await myRepository.waitForQuery(query);
     *     console.info(`The query ${JSON.stringify(query)} is now available.`);
     * }
     *
     * spyOnQuery({ search: "my name" });
     *
     * myRepository.byQuery({ search: "my name" });
     * ```
     *
     * @throws Will throw if loading any part of the query failed, or if an entity contained within this query was
     *     evicted after being loaded but before this Promise resolved.
     *
     * @param query The query to wait for.
     * @param pagination An optional pagination such as `{ offset: 0, count: 100 }`.
     *
     * @return A Promise resolving once the query is was loaded.
     */
    waitForQuery(query: TQuery): Promise<void>;
}

/**
 * An abstract class implementing [[Searchable]] providing all its caching operations.
 * In addition to the abstract methods of [[IndexableRepository]], which this class extends, one additional abstract
 * method needs to be implemented: [[SearchableRepository.fetchByQuery]]. It will be invoked if a given query was not
 * yet loaded and needs to resolve to an array of entities matching the given query.
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
 * class MyRepository extends SearchableRepository<MyQuery, MyEntity, number> {
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
 *     protected async fetchByQuery(query: MyQuery): Promise<FetchByQueryResult<MyEntity>> {
 *         const { search } = query;
 *         const response = await fetch(`http://example.com/api/my-entity?search=${search}`);
 *         if (response.status === 404) {
 *             return { entities: [] };
 *         }
 *         const body = await response.json();
 *         return { entities: body.searchResult };
 *     }
 * }
 * ```
 */
export abstract class SearchableRepository<TQuery, TEntity, TId = string> extends IndexableRepository<TEntity, TId>
    implements Searchable<TQuery, TEntity> {
    /**
     * The state of all requests performed to load entities by query.
     * This includes the request's states as well as the resulting ids.
     */
    protected stateByQuery = new RequestStates<TQuery, StateSearchable<TId>>(() => ({
        resultingIds: new Set(),
    }));

    /**
     * All listeners attached to this repository in [[SearchableRepository.waitForQuery]].
     */
    protected listenersByQuery = new Map<string, PromiseCallbacks[]>();

    /**
     * Perform the actual loading of all entities matching the given query.
     * It is okay to have this method reject with an error, but a result must be returned otherwise.
     * If no entities could be found, return an empty array.
     *
     * #### Example
     * ```
     * protected async fetchByQuery(query: MyQuery): Promise<FetchByQueryResult<MyEntity>> {
     *     const { search } = query;
     *     const response = await fetch(`http://example.com/api/my-entity?search=${search}`);
     *     if (response.status === 404) {
     *         return { entities: [] };
     *     }
     *     const body = await response.json();
     *     return { entities: body.searchResult };
     * }
     * ```
     *
     * @param query The query to execute.
     *
     * @return The array of resulting entities, wrapped in [[FetchByQueryResult]].
     */
    protected abstract async fetchByQuery(query: TQuery): Promise<FetchByQueryResult<TEntity>>;

    /** @inheritdoc */
    @bind public byQuery(query: TQuery): TEntity[] {
        setTimeout(() => this.loadByQuery(query));
        return this.resolveEntities(query);
    }

    /** @inheritdoc */
    @bind public async byQueryAsync(query: TQuery): Promise<TEntity[]> {
        await this.loadByQuery(query);
        return this.resolveEntities(query);
    }

    /** @inheritdoc */
    @bind public waitForQuery(query: TQuery): Promise<void> {
        const key = JSON.stringify(query);
        return new Promise((resolve, reject) => {
            if (!this.listenersByQuery.has(key)) {
                this.listenersByQuery.set(key, []);
            }
            this.listenersByQuery.get(key)!.push({ resolve, reject });
        });
    }

    /** @inheritdoc */
    @action.bound public evict(id: TId): void {
        super.evict(id);
        this.stateByQuery.forEach(info => {
            if (info.state.resultingIds.has(id)) {
                this.stateByQuery.delete(info.id);
            }
        });
    }

    /** @inheritdoc */
    @action.bound public async reloadQuery(query: TQuery): Promise<TEntity[]> {
        return await transaction(async () => {
            this.stateByQuery.delete(query);
            return await this.byQueryAsync(query);
        });
    }

    /** @inheritdoc */
    @action.bound public reset(): void {
        super.reset();
        this.listenersByQuery.forEach(listener => {
            listener.forEach(({ reject }) => reject(new Error("Repository was reset while waiting.")));
        });
        this.listenersByQuery.clear();
        this.stateByQuery.reset();
    }

    @bind private resolveEntities(query: TQuery): TEntity[] {
        const { resultingIds } = this.stateByQuery.getState(query);
        return [...resultingIds].map(id => this.entities.get(id)!);
    }

    @bind private callListenersByQuery(query: TQuery, error?: Error): void {
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

    @action.bound private async loadByQuery(query: TQuery): Promise<void> {
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
                this.stateByQuery.setStatus(query, RequestStatus.DONE);
                this.callListenersByQuery(query);
            });
        } catch (error) {
            this.stateByQuery.setStatus(query, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
            this.callListenersByQuery(query, error);
        }
    }
}
