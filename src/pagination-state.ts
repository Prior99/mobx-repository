import { PaginationRange } from "./pagination-range";

export class PaginationState<TId = string> {
    public paginationCompleted = false;
    public paginationRange = new PaginationRange<TId>();
}