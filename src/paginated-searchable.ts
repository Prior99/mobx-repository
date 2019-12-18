import { Searchable } from "./searchable";
import { Pagination } from "./pagination";

export interface PaginatedSearchable<TQuery, TModel> extends Searchable<TQuery, TModel> {
    byQuery(query: TQuery, pagination?: Pagination): TModel[];
    byQueryAsync(query: TQuery, pagination?: Pagination): Promise<TModel[]>;
}
