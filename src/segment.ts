import { bind } from "bind-decorator";

import { Pagination } from "./pagination";

/**
 * Create a new list of segments, sorted by their offset.
 * Performs a shallow copy.
 * 
 * @param segments Unsorted list of segments.
 * 
 * @return Sorted shallow copy of input.
 */
export function sortSegments<T extends Segment>(segments: T[]): T[] {
    return [...segments].sort((a, b) => a.offset - b.offset);
}

/**
 * Represents one segment within a pagination.
 */
export class Segment implements Pagination {
    /**
     * The absolute offset (index) within the pagination.
     */
    public readonly offset: number;
    /**
     * The number of entities.
     */
    public readonly count: number;

    /**
     * @param pagination Initialize a segment from a [[Pagination]].
     */
    constructor(pagination: Pagination);
    /**
     * @param offset The absolute offset (index) within the pagination.
     * @param count The number of entities.
     */
    constructor(offset: number, count?: number);
    constructor(arg1: Pagination | number, arg2?: number) {
        if (typeof arg1 === "object") {
            this.offset = arg1.offset;
            this.count = arg1.count;
        } else {
            this.offset = arg1;
            if (arg2 !== undefined) {
                this.count = arg2;
            }
        }
    }

    /**
     * Checks whether two segments overlap.
     * Will also return `true` if the segments are adjacent.
     * 
     * #### Example
     * ```
     * expect((new Segment(1, 3)).overlaps(new Segment(2, 5))).toBe(true);
     * expect((new Segment(1, 3)).overlaps(new Segment(7, 3))).toBe(false);
     * expect((new Segment(1, 3)).overlaps(new Segment(4, 1))).toBe(true);
     * ```
     * 
     * @param other Segment to compare with.
     * 
     * @return `true` if the segments were adjacent or overlapping and `false` otherwise.
     */
    @bind public overlaps(other: Segment): boolean {
        if (this.offset === other.offset) {
            return true;
        }
        const [first, second] = sortSegments([this, other]);
        return first.end >= second.offset;
    }

    /**
     * Split the segment into two segments at the given offset.
     * If the offset is without the segment or the segment's start or end, an array
     * with only one segment that is a shallow copy of this segment is returned.
     * The offset of the second segment will be the specified offset to split at.
     * 
     * #### Example
     * ```
     * expect((new Segment(1, 3)).split(2)).toEqual([new Segment(1, 1), new Segment(2, 2)]);
     * expect((new Segment(1, 3)).split(1)).toEqual([new Segment(1, 3)]);
     * ```
     * 
     * @param at Offset to split at.
     */
    @bind public split(at: number): [Segment, Segment] | [Segment] {
        if (at <= this.offset || at >= this.end - 1) {
            return [new Segment(this.offset, this.count)];
        }
        const firstSegmentCount = at - this.offset;
        return [new Segment(this.offset, firstSegmentCount), new Segment(at, this.count - firstSegmentCount)];
    }

    /**
     * Checks whether this segment contains the specified other segment.
     * 
     * #### Example
     * ```
     * expect((new Segment(1, 7)).contains(new Segment(2, 3))).toBe(true);
     * expect((new Segment(1, 7)).contains(new Segment(6, 5))).toBe(false);
     * ```
     * 
     * @param other Segment to check.
     * 
     * @return `true` if the other segment is completely contained within this one, and `false` otherwise.
     */
    @bind public contains(other: Segment): boolean {
        return other.offset >= this.offset && other.end <= this.end;
    }

    /**
     * Checks whether this segment contained within the specified other segment.
     * 
     * #### Example
     * ```
     * expect((new Segment(1, 7)).containedIn(new Segment(1, 9))).toBe(true);
     * expect((new Segment(1, 7)).containedIn(new Segment(6, 5))).toBe(false);
     * ```
     * 
     * @param other Segment to check.
     * 
     * @return `true` if the other segment completely contains this one, and `false` otherwise.
     */
    @bind public containedIn(other: Segment): boolean {
        return other.contains(this);
    }

    /**
     * Eliminate a given second segment from this segment, returning, one segment, no segments or two segments.
     * 
     * #### Example
     * ```
     * expect((new Segment(1, 7)).subtract(new Segment(1, 3))).toEqual([new Segment(4, 4)]);
     * expect((new Segment(1, 7)).subtract(new Segment(2, 3))).toEqual([new Segment(1, 1), new Segment(5, 3)]);
     * expect((new Segment(1, 7)).subtract(new Segment(1, 7))).toEqual([]);
     * ```
     * 
     * @param subtrahend The segment to remove from this one.
     * 
     * @return A set of new segments without the specified subtrahend.
     */
    @bind public subtract(subtrahend: Segment | undefined): [] | [Segment] | [Segment, Segment] {
        if (!subtrahend || !this.overlaps(subtrahend)) {
            return [new Segment(this)];
        }
        if (this.equals(subtrahend) || this.containedIn(subtrahend)) {
            return [];
        }
        if (this.offset === subtrahend.offset) {
            return [new Segment(subtrahend.end, this.end - subtrahend.end)];
        }
        if (this.end === subtrahend.end) {
            return [new Segment(this.offset, this.count - subtrahend.count)];
        }
        if (this.contains(subtrahend)) {
            const [before, after] = this.split(subtrahend.offset);
            return [before, new Segment(after.offset + subtrahend.count, after.count - subtrahend.count)];
        }
        if (this.offset < subtrahend.offset) {
            return [new Segment(this.offset, this.count - (this.end - subtrahend.offset))];
        }
        // Hence, this condition must be true: `this.offset > subtrahend.offset`.
        return [new Segment(subtrahend.end, this.end - subtrahend.end)];
    }

    /**
     * The exclusive end of this segment. The first "item" that is no longer contained within this segment.
     */
    public get end(): number {
        return this.offset + this.count;
    }

    /**
     * Check whether two segments designate the same range.
     * 
     * @param other Other segment to compare with.
     * 
     * @return `true` if both offsets and counts were equal and `false` otherwise.
     */
    @bind public equals(other: Segment): boolean {
        return this.offset === other.offset && this.count === other.count;
    }
}
