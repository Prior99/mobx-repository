import { bind } from "bind-decorator";

import { Segment, sortSegments } from "./segment";

/**
 * A segment used for pagination ranges with the resulting ids.
 */
export class SegmentWithIds<TId> extends Segment {
    /**
     * @param offset The offset of this segment.
     * @param ids Set of associated ids.
     */
    constructor(offset: number, public readonly ids: Set<TId>) {
        super(offset);
    }

    /**
     * Check whether a specified id is included within this segment.
     * 
     * @param id The id to check.
     * 
     * @return `true` if the id is included in this segment and `false` otherwise.
     */
    @bind public hasId(id: TId): boolean {
        return this.ids.has(id);
    }

    /** @inheritdoc */
    public get count(): number {
        return this.ids.size;
    }

    /**
     * Create a new [[SegmentWithIds]] by combining the specified segment with this one.
     * 
     * #### Example
     * ```
     * expect(
     *     (new SegmentWithIds(5, new Set([105, 106, 107, 108, 109])))
     *         .combine(new SegmentWithIds(7, new Set(107, 108, 109, 110, 111, 112))),
     * ).toEqual(
     *     new SegmentWithIds(5, new Set([105, 106, 107, 108, 109, 110, 111, 112])),
     * );
     * ```
     *
     * @param other [[SegmentWithIds]] to combine with this one.
     * 
     * @return A new [[SegmentWithIds]].
     */
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

    /**
     * Create a new [[SegmentWithIds]] by intersecting the specified segment with this one.
     * 
     * #### Example
     * ```
     * expect(
     *     (new SegmentWithIds(5, new Set([105, 106, 107, 108, 109])))
     *         .intersect(new SegmentWithIds(7, new Set(107, 108, 109, 110, 111, 112))),
     * ).toEqual(
     *     new SegmentWithIds(7, new Set([107, 108, 109])),
     * );
     * ```
     *
     * @param other [[SegmentWithIds]] to intersect with this one.
     * 
     * @return A new [[SegmentWithIds]].
     */
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

/**
 * Trivialize a list of instances of [[SegmentWithIds]].
 * 
 * #### Example
 * ```
 * const dirty = [
 *     new SegmentWithIds(7, new Set([107, 108, 109])),
 *     new SegmentWithIds(12, new Set([12])),
 *     new SegmentWithIds(4, new Set([104, 105, 106])),
 *     new SegmentWithIds(3, new Set([103, 104])),
 * ];
 * 
 * expect(tidySegments(dirty)).toEqual([
 *     new SegmentWithIds(3, new Set([103, 104, 105, 106, 107, 108, 109])),
 *     new SegmentWithIds(12, new Set([12])),
 * ]);
 * ```
 * 
 * @param segments List of segments to trivialize.
 * 
 * @return Tidied list of segments.
 */
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
