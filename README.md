# mobx-repository

Object oriented typescript repository for managing the model.

## Example

```
import * as React from "react";
import { render } from "react-dom";
import { observer } from "mobx-react";
import { action, observable } from "mobx";
import { PaginatedSearchableRepository, Pagination, FetchByQueryResult } from "mobx-repository";

export interface GithubRepositoriesQuery {
    name: string;
}

export interface GithubRepository {
    description: string;
    forks: number;
    stars: number;
    name: string;
    id: number;
    owner: {
        login: string;
    };
}

export class StoreGithubRepositories extends PaginatedSearchableRepository<GithubRepositoriesQuery, GithubRepository> {
    protected async fetchByQuery(
        query: GithubRepositoriesQuery,
        pagination: Pagination,
    ): Promise<FetchByQueryResult<GithubRepository>> {
        const { name } = query;
        const { offset, count } = pagination;
        const page = Math.floor(offset / count);
        const response = await fetch(
            `https://api.github.com/search/repositories?q=${name}&page=${page}&per_page=${count}`,
        );
        const { items: entities } = await response.json();
        return { entities };
    }

    protected async fetchById(id: string): Promise<GithubRepository | undefined> {
        const response = await fetch(`https://api.github.com/repos/${id}`);
        if (response.status === 404) {
            return;
        }
        const result = await response.json();
        return result;
    }

    protected extractId(entity: GithubRepository): string {
        return `${entity.owner.login}/${entity.name}`;
    }
}

@observer
export class GithubRepositoryList extends React.Component {
    private store = new StoreGithubRepositories();
    private count = 10;

    @observable private offset = 0
    @observable private name = "app";

    public render(): JSX.Element {
        const { name, offset, count } = this;
        const items = this.store.byQuery({ name }, {offset, count});
        return (
            <div>
                <input value={name} onChange={action(evt => this.name = evt.currentTarget.value)} />
                <ul>
                    {items.map(repo => <li key={repo.id}>{repo.name} - {repo.description}</li>)}
                </ul>
                <button onClick={() => this.offset -= this.count}>Previous</button>
                {Math.floor(offset / count)}
                <button onClick={() => this.offset += this.count}>Next</button>
            </div>
        );
    }
}

render(<GithubRepositoryList />, document.getElementById("app"));
```

## Contributing

Yarn is used as package manager.

* Install dependencies: `yarn`
* Build: `yarn build`
* Test: `yarn test`
* Lint: `yarn lint`
* Build the docs: `yarn docs`

## Contributors

* Frederick Gnodtke (Prior99)
