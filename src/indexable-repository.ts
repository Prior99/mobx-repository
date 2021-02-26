import { observable, action, makeObservable } from "mobx";
import { bind } from "bind-decorator";
import clone from "clone";

import { RequestStatus, RequestStates } from "./request-states";
import { PromiseCallbacks, ErrorListener } from "./listeners";
import { Repository } from "./repository";

export interface LoadOptions {
    force?: boolean;
}

/**
 * An indexable object which provides basic access to a set of entities by id.
 */
export interface Indexable<TEntity, TId = string, TBatchId = string> {
    /**
     * Access an entity synchronously by its id.
     * This will return `undefined` at first (if the entity is not yet in the cache), but load the entity
     * in the background. Due to MobX's reactive nature, your observer should detect the change, re-render,
     * call this method again and then get the newly cached entity.
     *
     * As repositories are implemented as caches, this operation can be performed without cost after the
     * entity was initially loaded. The underlying asynchronous operation will only be performed once.
     *
     * #### Example
     *
     * ```
     *     @observer
     *     class MyComponent extends React.Component<{ id: string }> {
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         public render() {
     *             const myEntity = this.myRepository.byId(this.props.id);
     *
     *             // Handle the case that the entity is currently loading.
     *             if (!myEntity) {
     *                 return (
     *                     <div>Loading...</div>
     *                 );
     *             }
     *
     *             // The render method will be invoked a second time,
     *             // and this time the entity should be loaded.
     *             return (
     *                 <div>{myEntity.name}</div>
     *             );
     *         }
     *     }
     * ```
     *
     * @param id The id of the entity to access.
     *
     * @return The entity if it was currently cached or `undefined` if it was not yet cached.
     */
    byId(id: TId): TEntity | undefined;

    /**
     * Access an entity asynchronously by its id.
     * Has the same call signature as [[Indexable.byId]], but returns a Promise.
     * This will resolve to the entity if no error occurred while loading it.
     *
     * As repositories are implemented as caches, this operation can be performed without cost after the
     * entity was initially loaded. The underlying asynchronous operation will only be performed once.
     *
     * #### Example
     * ```
     *     class MyService {
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         public async getName(id: string): Promise<name> {
     *             const myEntity = await this.myRepository.byIdAsync(id);
     *             if (!myEntity) {
     *                 throw new Error("Entity not found or failed to be loaded.");
     *             }
     *             return myEntity.name;
     *         }
     *     }
     * ```
     *
     * @throws Will throw if loading the entity failed or if the entity was evicted after being loaded but before
     *     this Promise resolved.
     *
     * @param id The id of the entity to retrieve.
     *
     * @return A Promise resolving to the entity or `undefined` if it failed to load.
     */
    byIdAsync(id: TId): Promise<TEntity | undefined>;

    /**
     * Waits for a specified id to be available, without triggering it to load or resolving to it.
     *
     * #### Example
     * ```
     * const myRepository: MyRepository = ...;
     *
     * async function spyOnId(id: string): Promise<void> {
     *     await myRepository.waitForId(id);
     *     console.info(`Entity with id "${id}" was loaded.`);
     * }
     *
     * spyOnId("some-unique-id-119");
     *
     * myRepository.byId("some-unique-id-119");
     * ```
     *
     * @throws Will throw if loading the entity failed,
     *     if the entity was evicted while loading or if the repository was reset while waiting.
     *
     * @param id The id of the entity to wait for.
     *
     * @return A Promise resolving once the entity with the specified id was loaded.
     */
    waitForId(id: TId): Promise<void>;

    /**
     * Checks whether an entity is currently in the cache.
     *
     * #### Example
     * ```
     * const myRepository: MyRepository = ...;
     * expect(myRepository.isLoaded("some-unique-id-119")).toBe(false);
     * await myRepository.byIdAsync("some-unique-id-119")
     * expect(myRepository.isLoaded("some-unique-id-119")).toBe(true);
     * ```
     *
     * @param id The id of the entity to check.
     *
     * @return `true` if the entity is currently cached and `false` otherwise.
     */
    isLoaded(id: TId): boolean;

    /**
     * Checks whether an entity is currently in the cache, being loaded, failed to load or was not found previously.
     *
     * #### Example
     * ```
     * const myRepository: MyRepository = ...;
     * expect(myRepository.isKnown("some-unique-id-119")).toBe(false);
     * myRepository.byId("some-unique-id-119")
     * // The entity is not yet loaded, as `byId` loads the entity in the background and immediately returns.
     * expect(myRepository.isLoaded("some-unique-id-119")).toBe(false);
     * // However, the entity is known at this point as it is currently loading.
     * expect(myRepository.isKnown("some-unique-id-119")).toBe(true);
     * ```
     * @param id The id of the entity to check.
     *
     * @return `true` if the entity is currently cached, loading, failed to load or was not found previously
     *     and `false` otherwise.
     */
    isKnown(id: TId): boolean;

    /**
     * Access the mutable copy of an entity inside batch `batchId` synchronously by its id.
     * See [[IndexableRepository.byId]] for information on how the reactivity works.
     *
     * This method searches for the entity in the cache and loads it otherwise.
     * The loaded entity is copied and stored uniquely under `batchId`/`id`.
     *
     * #### Example
     *
     * ```
     *     @observer
     *     class MyComponent extends React.Component<{ id: string }> {
     *         // Get access to the repository.
     *         // For example using dependency-injection, context or props.
     *         private myRepository!: MyRepository;
     *
     *         @computed private get mutableCopy() {
     *             return this.repository.mutableCopyById("uniqueSessionId", this.props.id)
     *         }
     *
     *         @action.bound public changeValue(event: React.SyntheticEvent<HTMLInputElement>): void {
     *             this.mutableCopy.value = event.target.value;
     *         }
     *
     *         public render() {
     *             // Handle the case that the entity is currently loading.
     *             if (!mutableCopy) {
     *                 return (
     *                     <div>Loading...</div>
     *                 );
     *             }
     *
     *             // The render method will be invoked a second time,
     *             // and this time the entity should be loaded.
     *             return (
     *                 <input type="text" onchange={changeValue}>
     *             );
     *         }
     *     }
     * ```
     *
     * @param batchId The id of the batch of mutable entities.
     *
     * @param id The id of the entity to access.
     *
     * @return A mutable copy of the entity if it was currently copied or `undefined` if it was not yet cached.
     */
    mutableCopyById(batchId: TBatchId, id: TId): TEntity | undefined;

    /**
     * Replace the current mutable copy of an entity in the batch `batchId` with `entity`.
     *
     * @param batchId The id of the batch of mutable entities.
     *
     * @param id The id of the entity to discard.
     *
     * @param id The id of the entity to discard.
     */
    setMutableCopy(batchId: TBatchId, entity: TEntity): void;

    /**
     * Discard the changes applied to the mutable copy of the entity `id` in the batch `batchId`.
     *
     * @param batchId The id of the batch of mutable entities.
     *
     * @param id The id of the entity to discard.
     */
    discardMutableCopy(batchId: TBatchId, id: TId): void;

    /**
     * Manually add an entity to the cache.
     *
     * @param entity The id of the entity to retrieve.
     */
    add(entity: TEntity): void;

    /**
     * Remove an entity from the cache.
     * This might result in pending calls to `byIdAsync` or `waitForId` to reject.
     *
     * @param id The id of the entity to evict from the cache.
     */
    evict(id: TId): void;

    /**
     * Evict an entity from the cache and then load it again.
     * This might result in pending calls to `byIdAsync` or `waitForId` to reject.
     *
     * @param id The id of the entity to reload.
     *
     * @return The entity if it was currently cached or `undefined` if it was not yet cached.
     *
     * @return A Promise resolving to the entity or `undefined` if it failed to load.
     */
    reloadId(id: TId): Promise<TEntity>;
}

/**
 * An abstract class implementing [[Indexable]] and providing all its caching operations.
 * Two abstract methods need to be implemented: `fetchById` and `extractId`.
 * The method [[IndexableRepository.fetchById]] is responsible for performing the actual call to the asynchronous
 * provider (e.g. REST API) and [[IndexableRepository.extractId]] needs to return an unique identifier for any provided
 * entity.
 *
 * #### Example
 * ```
 * interface MyEntity {
 *     id: number;
 *     name: string;
 * }
 *
 * class MyRepository extends IndexableRepository<MyEntity, number> {
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
 * }
 * ```
 */
export abstract class IndexableRepository<TEntity, TId = string, TBatchId = string> implements Indexable<TEntity, TId, TBatchId>, Repository {
    private cloneEntity: (entity: TEntity) => TEntity;

    /**
     * A map including all entities in the cache.
     * Indexed by the ids extracted in [[IndexableRepository.extractId]].
     */
    @observable public entities = new Map<TId, TEntity>();

    /**
     * A map holding batches of mutable copies of entities.
     * Indexed by a call-site supplied `TBatchId`.
     *
     * A batch is a namespace for mutable copies.
     * It grants precisely control over which mutable copy you want to work with.
     * A batch is indexed by the ids extracted in [[IndexableRepository.extractId]].
     */
    @observable public mutableCopyBatches = new Map<TBatchId, Map<TId, TEntity>>();

    constructor(cloneEntity: (entity: TEntity) => TEntity = clone) {
        this.cloneEntity = cloneEntity;
        makeObservable(this);
    }

    /**
     * The state of all requests performed to load entities by id.
     */
    protected stateById = new RequestStates<TId>();

    /**
     * Listeners attached via [[IndexableRepository.waitForId]].
     */
    protected listenersById = new Map<TId, PromiseCallbacks[]>();

    /**
     * All instances of [[ErrorListener]] attached to this repository.
     */
    protected errorListeners = new Set<ErrorListener>();

    /**
     * Implement the actual loading of one entity in this method.
     * If the entity could not be found, the method is expected to return `undefined`.
     * It is okay to have this method reject with an error.
     *
     * #### Example
     * ```
     * protected async fetchById(id: number): Promise<MyEntity> {
     *     const response = await fetch(`http://example.com/api/my-entity/${id}`);
     *     if (response.status === 404) {
     *         return;
     *     }
     *     const body = await response.json();
     *     return body;
     * }
     * ```
     *
     * @throws The method may throw an error, for example if the entity couldn't be loaded.
     *
     * @param id The id of the entity to load.
     *
     * @return A Promise that resolves with the entity if it could be loaded, or `undefined` if it couldn't be found.
     */
    protected abstract fetchById(id: TId): Promise<TEntity | undefined>;

    /**
     * Implement the extraction of a unique id from a given entity.
     * The id will be used as key for the repository's cache.
     *
     * #### Example
     * ```
     * protected async extractId(entity: MyEntity): number {
     *     return entity.id;
     * }
     * ```
     *
     * @param entity The entity to retrieve the unique id from.
     *
     * @return An id that must be unique within this repository.
     */
    protected abstract extractId(entity: TEntity): TId;

    /** @inheritdoc */
    @bind public byId(id: TId): TEntity | undefined {
        setTimeout(() => this.loadById(id));
        return this.entities.get(id);
    }

    /** @inheritdoc */
    @bind public addErrorListener(listener: ErrorListener): void {
        this.errorListeners.add(listener);
    }

    /** @inheritdoc */
    @bind public removeErrorListener(listener: ErrorListener): void {
        this.errorListeners.delete(listener);
    }

    /** @inheritdoc */
    @bind public async byIdAsync(id: TId): Promise<TEntity | undefined> {
        await this.loadById(id);
        return this.entities.get(id);
    }

    /** @inheritdoc */
    @bind public waitForId(id: TId): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.listenersById.has(id)) {
                this.listenersById.set(id, []);
            }
            this.listenersById.get(id)!.push({ resolve, reject });
        });
    }

    /** @inheritdoc */
    @bind public isLoaded(id: TId): boolean {
        return this.entities.has(id);
    }

    /** @inheritdoc */
    @bind public isKnown(id: TId): boolean {
        return this.isLoaded(id) || this.stateById.isStatus(
            id,
            RequestStatus.ERROR,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NOT_FOUND,
            RequestStatus.DONE,
        );
    }

    @bind private batchById(batchId: TBatchId): Map<TId, TEntity> {
        if (!this.mutableCopyBatches.has(batchId)) {
            this.mutableCopyBatches.set(batchId, new Map<TId, TEntity>());
        }
        return this.mutableCopyBatches.get(batchId);
    }

    /** @inheritdoc */
    @bind public mutableCopyById(batchId: TBatchId, id: TId): TEntity | undefined {
        const batch = this.batchById(batchId);
        if (!batch.has(id)) {
            if (this.isLoaded(id)) {
                // If the resource is already loaded then this method will be synchronous.
                const entity = this.byId(id);
                batch.set(id, this.cloneEntity(entity));
            } else {
                // Otherwise we need to asynchronously load the entity first.
                setTimeout(async () => {
                    const entity = await this.byIdAsync(id);
                    batch.set(id, this.cloneEntity(entity));
                });
            }
        }
        return batch.get(id);
    }

    /** @inheritdoc */
    @bind public setMutableCopy(batchId: TBatchId, entity: TEntity): void {
        const batch = this.batchById(batchId);
        batch.set(this.extractId(entity), entity);
    }

    /** @inheritdoc */
    @bind public discardMutableCopy(batchId: TBatchId, id: TId): void {
        const batch = this.batchById(batchId);
        batch.delete(id);
    }

    /** @inheritdoc */
    @action.bound public add(entity: TEntity): void {
        this.entities.set(this.extractId(entity), entity);
    }

    /** @inheritdoc */
    @action.bound public reset(): void {
        this.stateById.reset();
        this.listenersById.forEach(listeners => {
            listeners.forEach(({ reject }) => reject(new Error("Repository was reset while waiting.")));
        });
        this.listenersById.clear();
        this.entities.clear();
        this.mutableCopyBatches.clear();
    }

    /** @inheritdoc */
    @action.bound public evict(id: TId): void {
        this.entities.delete(id);
        this.callListenersById(id, new Error("Entity evicted while waiting."));
        this.stateById.delete(id);
    }

    /** @inheritdoc */
    @bind public async reloadId(id: TId): Promise<TEntity> {
        await this.loadById(id, { force: true });
        return await this.byIdAsync(id);
    }

    private callListenersById(id: TId, error?: Error): void {
        if (!this.listenersById.has(id)) {
            return;
        }
        this.listenersById.get(id)!.forEach(({ resolve, reject }) => {
            if (error) {
                reject(error);
            } else {
                resolve();
            }
        });
        this.listenersById.delete(id);
    }

    @bind private async loadById(id: TId, { force = false }: LoadOptions = {}): Promise<void> {
        if (!force && (this.isLoaded(id) || this.stateById.isStatus(id, RequestStatus.DONE))) {
            return;
        }
        if (this.stateById.isStatus(id, RequestStatus.IN_PROGRESS, RequestStatus.ERROR)) {
            await this.waitForId(id);
            return;
        }
        this.stateById.setStatus(id, RequestStatus.IN_PROGRESS);
        try {
            const result = await this.fetchById(id);
            if (result === undefined) {
                this.stateById.setStatus(id, RequestStatus.NOT_FOUND);
                return;
            }
            if (this.extractId(result) !== id) {
                const error = new Error("Fetched entity has different id than requested.");
                this.errorListeners.forEach(callback => callback(error));
                throw error;
            }
            this.stateById.setStatus(id, RequestStatus.DONE);
            this.add(result);
            this.callListenersById(id);
        } catch (error) {
            this.stateById.setStatus(id, RequestStatus.ERROR, error);
            this.errorListeners.forEach(callback => callback(error));
            this.callListenersById(id, error);
        }
    }
}
