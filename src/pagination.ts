/**
 * Expresses a range of entities within a query designated by the absolute offset within the query
 * and the number of entities.
 */
export interface Pagination {
    /**
     * The absolute offset (index) within the query.
     */
    offset: number;
    /**
     * The number of entities.
     */
    count: number;
}
