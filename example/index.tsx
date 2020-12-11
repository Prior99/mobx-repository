import * as React from "react";
import { render } from "react-dom";
import { observer } from "mobx-react";
import { action, makeObservable, observable } from "mobx";
import { PaginatedSearchableRepository, Pagination, FetchByQueryResult } from "mobx-repository";

export interface IGithubRepositoriesQuery {
    name: string;
}

export interface IGithubRepository {
    description: string;
    forks: number;
    stars: number;
    name: string;
    id: number;
    owner: {
        login: string;
    };
}

export class GithubRepository implements IGithubRepository {
    @observable public description: string;
    @observable public forks: number;
    @observable public stars: number;
    @observable public name: string;
    @observable public id: number;
    @observable public owner: { login: string };

    constructor(options: IGithubRepository) {
        this.description = options.description;
        this.forks = options.forks;
        this.stars = options.stars;
        this.name = options.name;
        this.id = options.id;
        this.owner = options.owner;
        makeObservable(this);
    }

    public get lol(): boolean {
        return true;
    }
}

export class StoreGithubRepositories extends PaginatedSearchableRepository<IGithubRepositoriesQuery, GithubRepository> {
    protected async fetchByQuery(
        query: IGithubRepositoriesQuery,
        pagination: Pagination,
    ): Promise<FetchByQueryResult<GithubRepository>> {
        const { name } = query;
        const { offset, count } = pagination;
        const page = Math.floor(offset / count) + 1;
        const response = await fetch(
            `https://api.github.com/search/repositories?q=${name}&page=${page}&per_page=${count}`,
        );
        if (!response.ok) {
            throw response;
        }
        const { items } = await response.json();
        const entities = items.map(item => new GithubRepository(item));
        return { entities };
    }

    protected async fetchById(id: string): Promise<GithubRepository | undefined> {
        const response = await fetch(`https://api.github.com/repos/${id}`);
        if (response.status === 404) {
            return;
        }
        if (!response.ok) {
            throw response;
        }
        const result = await response.json();
        return new GithubRepository(result);
    }

    protected extractId(entity: GithubRepository): string {
        return `${entity.owner.login}/${entity.name}`;
    }
}

@observer
export class GithubRepositoryList extends React.Component {
    private store = new StoreGithubRepositories();
    private count = 10;

    @observable private offset = 0;
    @observable private name = "mobx";

    constructor(props: unknown) {
        super(props);
        makeObservable(this);
        this.store.addErrorListener(err => alert("An error occured!"));
    }

    public render(): JSX.Element {
        const { name, offset, count } = this;
        const items = this.store.byQuery({ name }, { offset, count });
        return (
            <div>
                <input value={name} onChange={action(evt => (this.name = evt.currentTarget.value))} />
                <ul>
                    {items.map(repo => (
                        <li key={repo.id}>
                            <input value={repo.name} onChange={action(evt => (repo.name = evt.currentTarget.value))} />
                        </li>
                    ))}
                </ul>
                <button onClick={() => (this.offset -= this.count)}>Previous</button>
                {Math.floor(offset / count)}
                <button onClick={() => (this.offset += this.count)}>Next</button>
            </div>
        );
    }
}

render(<GithubRepositoryList />, document.getElementById("app"));
