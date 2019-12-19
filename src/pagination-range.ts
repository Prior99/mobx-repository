import bind from "bind-decorator";
import { observable, action, computed } from "mobx";

import { tidySegments, SegmentWithIds } from "./segment-with-ids";
import { Segment } from "./segment";
import { Pagination } from "./pagination";

/**
 * A set of all currently loaded pagination segments for a specific query.
 */
export class PaginationRange<TId> {
    @observable private segments: SegmentWithIds<TId>[] = [];

    /**
     * Designate a new segment to be loaded.
     * 
     * @param segment The segment that was loaded, with its offset and all included ids.
     */
    @action.bound public add(segment: SegmentWithIds<TId>): void {
        this.segments = tidySegments([...this.segments, segment]);
    }

    /**
     * All segments that are currently loaded, with their offsets and counts.
     */
    @computed public get loadedSegments(): Segment[] {
        return this.segments.map(({ offset, count }) => new Segment(offset, count));
    }

    /**
     * Lookup all ids that are included within a range.
     * This range can contain multiple segments that are loaded and will ignore "gaps".
     *
     * @param pagination The range to lookup the ids of.
     * 
     * @return A set with all ids withing the provided range.
     */
    @bind getIds(pagination: Pagination): Set<TId> {
        return new Set(
            this.segments
                .reduce((result: SegmentWithIds<TId>[], existing: SegmentWithIds<TId>) => {
                    const intersection = existing.intersect(new Segment(pagination));
                    if (intersection) {
                        return [...result, intersection];
                    }
                    return result;
                }, [])
                .reduce((result, intersection) => [...result, ...intersection.ids], []),
        );
    }

    /**
     * Calculate all missing sub-segments within a given pagination.
     * 
     * @param requested The range to calculate the missing segments of.
     * 
     * @return A list of missing segments in the specified range. If the range is fully loaded,
     *     an empty array will be returned.
     */
    @bind public getMissingSegments(requested: Pagination): Segment[] {
        let missingSegments: Segment[] = [new Segment(requested)];
        for (const existing of this.segments) {
            const newMissingSegments: Segment[] = [];
            for (const missing of missingSegments) {
                newMissingSegments.push(...missing.subtract(existing));
            }
            missingSegments = newMissingSegments;
        }
        return missingSegments;
    }

    /**
     * Check whether a provided range is fully loaded.
     * 
     * @param requested The range to check.
     * 
     * @return `true` if the range is loaded and `false` if at least one id is missing.
     */
    @bind public isFullyLoaded(requested: Pagination): boolean {
        return this.getMissingSegments(requested).length === 0;
    }

    /**
     * Check if any known segment contains the specified id.
     * 
     * @param id The id to look up.
     * 
     * @return `true` if any segment within this range has this id and `false` otherwise.
     */
    @bind public hasId(id: TId): boolean {
        return this.segments.some(segment => segment.hasId(id));
    }
}
