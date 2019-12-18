import { observable, action, computed } from "mobx";
import bind from "bind-decorator";
import { tidySegments, SegmentWithIds } from "./segment-with-ids";
import { Segment } from "./segment";
import { Pagination } from "./pagination";

export class PaginationRange<T> {
    @observable private segments: SegmentWithIds<T>[] = [];

    @action.bound public add(segment: SegmentWithIds<T>): void {
        this.segments = tidySegments([...this.segments, segment]);
    }

    @computed public get loadedSegments(): Segment[] {
        return this.segments.map(({ offset, count }) => new Segment(offset, count));
    }

    @bind getIds(segment: Pagination): Set<T> {
        return new Set(
            this.segments
                .reduce((result: SegmentWithIds<T>[], existing: SegmentWithIds<T>) => {
                    const intersection = existing.intersect(new Segment(segment));
                    if (intersection) {
                        return [...result, intersection];
                    }
                    return result;
                }, [])
                .reduce((result, intersection) => [...result, ...intersection.ids], []),
        );
    }

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

    @bind public isFullyLoaded(requested: Pagination): boolean {
        return this.getMissingSegments(requested).length === 0;
    }
}
