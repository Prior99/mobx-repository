import { observable, action, computed } from "mobx";
import bind from "bind-decorator";
import { tidySegments, SegmentWithIds } from "./segment-with-ids";
import { Segment } from "./segment";

export class PaginationRange<T> {
    @observable private segments: SegmentWithIds<T>[] = [];

    @action.bound public add(segment: SegmentWithIds<T>): void {
        this.segments = tidySegments([...this.segments, segment]);
    }

    @computed public get loadedSegments(): Segment[] {
        return this.segments.map(({ offset, count }) => new Segment(offset, count));
    }

    @bind getIds(segment: Segment): Set<T> {
        return new Set(
            this.segments
                .reduce((result: SegmentWithIds<T>[], existing: SegmentWithIds<T>) => {
                    const intersection = existing.intersect(segment);
                    if (intersection) {
                        return [...result, intersection];
                    }
                    return result;
                }, [])
                .reduce((result, intersection) => [...result, ...intersection.ids], []),
        );
    }

    @bind public getMissingSegments(requested: Segment): Segment[] {
        interface State {
            remaining: Segment;
            lastSegment?: Segment;
            result: Segment[];
        }

        const { lastSegment, result, remaining } = this.segments.reduce(
            (state: State, existing: Segment) => {
                const { remaining, lastSegment, result } = state;
                if (!remaining) {
                    return state;
                }
                const [intoSegments, newRemaining] = remaining.split(existing.offset);
                const subtracted = intoSegments.subtract(lastSegment);
                return {
                    remaining: newRemaining,
                    lastSegment: existing,
                    result: [...result, subtracted],
                };
            },
            {
                remaining: requested,
                result: [],
            },
        );

        if (remaining) {
            result.push(remaining.subtract(lastSegment));
        }

        return result.filter(segment => segment.count > 0);
    }

    @bind public isFullyLoaded(requested: Segment): boolean {
        return this.getMissingSegments(requested).length === 0;
    }
}
