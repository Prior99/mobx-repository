import { observable, action, computed } from "mobx";
import bind from "bind-decorator";

export interface Segment {
    offset: number;
    count: number;
}

export interface SegmentWithIds<TId> extends Segment {
    ids: Set<TId>
}

export function sortSegments<T extends Segment>(segments: T[]): T[] {
    return [...segments].sort((a, b) => a.offset - b.offset);
}

export function combineSegments<T>(a: SegmentWithIds<T>, b: SegmentWithIds<T>): SegmentWithIds<T> {
    if (a.offset === b.offset) {
        return {
            ids: new Set([...a.ids, ...b.ids]),
            offset: a.offset,
            count: Math.max(a.count, b.count),
        };
    }
    const [first, second] = sortSegments([a, b]);
    const overlapAmount = first.offset + first.count - second.offset;
    return {
        ids: new Set([...first.ids, ...second.ids]),
        offset: first.offset,
        count: first.count + second.count - overlapAmount,
    }
}

export function doSegmentsOverlap<T extends Segment>(a: T, b: T): boolean {
    if (a.offset === b.offset) { return true; }
    const [first, second] = sortSegments([a, b]);
    return first.offset + first.count >= second.offset;
}

export function tidySegments<T>(segments: SegmentWithIds<T>[]): SegmentWithIds<T>[] {
    let changed = false;
    do {
        changed = false;
        outer: for (let a of segments) {
            for (let b of segments) {
                if (a === b) { break; }
                if (doSegmentsOverlap(a, b)) {
                    segments = segments.filter(segment => [a, b].indexOf(segment) === -1);
                    segments.push(combineSegments(a, b));
                    changed = true;
                    break outer;
                }
            }
        }
    } while (changed);
    return sortSegments(segments);
}

export function splitSegment(segment: Segment, at: number): [Segment, Segment] | [Segment] {
    if (at <= segment.offset || at >= segment.offset + segment.count - 1) {
        return [{ ...segment }];
    }
    const firstSegmentCount = at - segment.offset;
    return [
        {
            offset: segment.offset,
            count: firstSegmentCount,
        },
        {
            offset: at,
            count: segment.count - firstSegmentCount,
        },
    ];
}

function subtract(a: Segment, b: Segment | undefined): Segment {
    if (!b) { return a; }
    return {
        offset: a.offset + b.count,
        count: a.count - b.count,
    };
}

export function intersectSegments<T1, T2 extends Segment>(
    segment: SegmentWithIds<T1>,
    intersection: T2,
): SegmentWithIds<T1> | undefined {
    if (
        intersection.offset > segment.offset + segment.count ||
        intersection.offset + intersection.count < segment.offset
    ) {
        return;
    }
    if (segment.offset === intersection.offset) {
        const count = Math.min(segment.count, intersection.count);
        return {
            offset: segment.offset,
            count,
            ids: new Set([...segment.ids].slice(0, count)),
        };
    }
    if (segment.offset > intersection.offset) {
        const offset = segment.offset;
        const count = Math.min(intersection.offset + intersection.count - segment.offset, segment.count);
        return {
            offset,
            count,
            ids: new Set([...segment.ids].slice(0, count)),
        };
    }
    if (intersection.offset > segment.offset) {
        const offset = intersection.offset;
        const count = Math.min(segment.offset + segment.count - intersection.offset, intersection.count);
        const idStartIndex = intersection.offset - segment.offset;
        return {
            offset,
            count,
            ids: new Set([...segment.ids].slice(idStartIndex, idStartIndex + count)),
        };
    }
}

export class PaginationRange<T> {
    @observable private segments: SegmentWithIds<T>[] = [];

    @action.bound public add(segment: SegmentWithIds<T>): void {
        this.segments = tidySegments([...this.segments, segment]);
    }

    @computed public get loadedSegments(): Segment[] {
        return this.segments.map(({ offset, count }) => ({ offset, count }));
    }

    @bind getIds(segment: Segment): Set<T> {
        return new Set(
            this.segments
                .reduce((result: SegmentWithIds<T>[], existing: SegmentWithIds<T>) => {
                    const intersection = intersectSegments(existing, segment);
                    if (intersection) {
                        return [...result, intersection];
                    }
                    return result;
                }, [])
                .reduce((result, intersection) => ([...result, ...intersection.ids]), [])
        );
    }

    @bind public getMissingSegments(requested: Segment): Segment[] {
        interface State {
            remaining: Segment;
            lastSegment?: Segment;
            result: Segment[];
        }

        const {
            lastSegment,
            result,
            remaining,
        } = this.segments.reduce((state: State, existing: Segment) => {
            const { remaining, lastSegment, result } = state;
            if (!remaining) { return state; }
            const [intoSegments, newRemaining] = splitSegment(remaining, existing.offset);
            const subtracted = subtract(intoSegments, lastSegment);
            return {
                remaining: newRemaining,
                lastSegment: existing,
                result: [...result, subtracted],
            };
        }, {
            remaining: requested,
            result: [],
        });

        if (remaining) {
            result.push(subtract(remaining, lastSegment));
        }

        return result.filter(segment => segment.count > 0);
    }

    @bind public isFullyLoaded(requested: Segment): boolean {
        return this.getMissingSegments(requested).length === 0;
    }
}