import { observable, action } from "mobx";
import { bind } from "bind-decorator";

import { RequestStatus, RequestState } from "./request-state";
import { Listener, ErrorListener } from "./listener";
import { Repository } from "./repository";

export interface Indexable<TEntity, TId = string> {
    byId(id: TId): TEntity | undefined;
    byIdAsync(id: TId): Promise<TEntity | undefined>;
    waitForId(id: TId): Promise<void>;
    isLoaded(id: TId): boolean;
    isKnown(id: TId): boolean;
    add(entity: TEntity): void;
    evict(id: TId): void;
    reloadId(id: TId): Promise<TEntity>;
}

export abstract class IndexableRepository<TEntity, TId = string> implements Indexable<TEntity, TId>, Repository {
    @observable protected entities = new Map<TId, TEntity>();
    protected stateById = new RequestState<TId>();
    protected listenersById = new Map<TId, Listener[]>();
    protected errorListeners = new Set<ErrorListener>();

    protected abstract fetchById(id: TId): Promise<TEntity>;

    protected abstract extractId(entity: TEntity): TId;

    @bind public byId(id: TId): TEntity | undefined {
        this.loadById(id);
        return this.entities.get(id);
    }

    @bind public addErrorListener(listener: ErrorListener): void {
        this.errorListeners.add(listener);
    }

    @bind public removeErrorListener(listener: ErrorListener): void {
        this.errorListeners.delete(listener);
    }

    @bind public async byIdAsync(id: TId): Promise<TEntity | undefined> {
        await this.loadById(id);
        return this.entities.get(id);
    }

    @bind public waitForId(id: TId): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.listenersById.has(id)) {
                this.listenersById.set(id, []);
            }
            this.listenersById.get(id)!.push({ resolve, reject });
        });
    }

    @bind public isLoaded(id: TId): boolean {
        return this.entities.has(id);
    }

    @bind public isKnown(id: TId): boolean {
        return this.stateById.isStatus(
            id,
            RequestStatus.ERROR,
            RequestStatus.IN_PROGRESS,
            RequestStatus.NOT_FOUND,
            RequestStatus.DONE,
        );
    }

    @action.bound public add(entity: TEntity): void {
        this.entities.set(this.extractId(entity), entity);
    }

    @action.bound public reset(): void {
        this.stateById.reset();
        this.listenersById.forEach(listeners => {
            listeners.forEach(({ reject }) => reject(new Error("Repository was reset while waiting.")));
        });
        this.listenersById.clear();
        this.entities.clear();
    }

    @action.bound public evict(id: TId): void {
        this.entities.delete(id);
        this.callListenersById(id, new Error("Entity evicted while waiting."));
        this.stateById.delete(id);
    }

    @action.bound public async reloadId(id: TId): Promise<TEntity> {
        this.evict(id);
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

    @action.bound private async loadById(id: TId): Promise<void> {
        if (this.stateById.isStatus(id, RequestStatus.DONE)) {
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
