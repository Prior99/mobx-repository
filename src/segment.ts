import { Pagination } from "./pagination";
import { bind } from "bind-decorator";

export function sortSegments<T extends Segment>(segments: T[]): T[] {
    return [...segments].sort((a, b) => a.offset - b.offset);
}

export class Segment implements Pagination {
    public readonly offset: number;
    public readonly count: number;

    constructor(pagination: Pagination);
    constructor(offset: number, count: number);
    constructor(arg1: Pagination | number, arg2?: number) {
        if (typeof arg1 === "object") {
            this.offset = arg1.offset;
            this.count = arg1.count;
        } else {
            this.offset = arg1;
            this.count = arg2;
        }
    }

    @bind public overlaps(other: Segment): boolean {
        if (this.offset === other.offset) {
            return true;
        }
        const [first, second] = sortSegments([this, other]);
        return first.end >= second.offset;
    }

    @bind public split(at: number): [Segment, Segment] | [Segment] {
        if (at <= this.offset || at >= this.end - 1) {
            return [new Segment(this.offset, this.count)];
        }
        const firstSegmentCount = at - this.offset;
        return [new Segment(this.offset, firstSegmentCount), new Segment(at, this.count - firstSegmentCount)];
    }

    @bind public contains(other: Segment): boolean {
        return other.offset >= this.offset && other.end <= this.end;
    }

    @bind public containedIn(other: Segment): boolean {
        return other.contains(this);
    }

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

    public get end(): number {
        return this.offset + this.count;
    }

    @bind public equals(other: Segment): boolean {
        return this.offset === other.offset && this.count === other.count;
    }
}
