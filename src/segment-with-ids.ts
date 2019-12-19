import { bind } from "bind-decorator";

import { Segment, sortSegments } from "./segment";

export class SegmentWithIds<TId> extends Segment {
    constructor(offset: number, public readonly ids: Set<TId>) {
        super(offset);
    }

    @bind public hasId(id: TId): boolean {
        return this.ids.has(id);
    }

    public get count(): number {
        return this.ids.size;
    }

    @bind public combine(other: SegmentWithIds<TId>): SegmentWithIds<TId> {
        if (this.offset === other.offset) {
            const ids = new Set([...this.ids, ...other.ids]);
            return new SegmentWithIds(this.offset, ids);
        }
        const [first, second] = sortSegments([this, other]);
        const ids = new Set([...first.ids, ...second.ids]);
        const overlapAmount = first.end >= second.end ? second.count : first.end - second.offset;
        const expectedSize = first.count + second.count - overlapAmount;
        if (ids.size !== expectedSize) {
            throw new Error(`Invalid number of ids after combining: ${ids.size} !== ${expectedSize}`);
        }
        return new SegmentWithIds(first.offset, ids);
    }

    @bind public intersect(intersection: Segment): SegmentWithIds<TId> | undefined {
        if (intersection.offset > this.end || intersection.end < this.offset) {
            return;
        }
        if (this.offset === intersection.offset) {
            const count = Math.min(this.count, intersection.count);
            const ids = new Set([...this.ids].slice(0, count));
            return new SegmentWithIds(this.offset, ids);
        }
        if (this.offset > intersection.offset) {
            const count = Math.min(intersection.end - this.offset, this.count);
            const ids = new Set([...this.ids].slice(0, count));
            return new SegmentWithIds(this.offset, ids);
        }
        // Hence, this condition must be true: `this.offset < intersection.offset`.
        const count = Math.min(this.end - intersection.offset, intersection.count);
        const idStartIndex = intersection.offset - this.offset;
        const ids = new Set([...this.ids].slice(idStartIndex, idStartIndex + count));
        return new SegmentWithIds(intersection.offset, ids);
    }
}

export function tidySegments<T>(segments: SegmentWithIds<T>[]): SegmentWithIds<T>[] {
    let changed = false;
    do {
        changed = false;
        outer: for (const a of segments) {
            for (const b of segments) {
                if (a === b) {
                    break;
                }
                if (a.overlaps(b)) {
                    segments = segments.filter(segment => [a, b].indexOf(segment) === -1);
                    segments.push(a.combine(b));
                    changed = true;
                    break outer;
                }
            }
        }
    } while (changed);
    return sortSegments(segments);
}
