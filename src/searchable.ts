export interface Searchable<TQuery, TModel> {
    byQuery(query: TQuery): TModel[];
    byQueryAsync(query: TQuery): Promise<TModel[]>;
    waitForQuery(query: TQuery): Promise<void>;
}