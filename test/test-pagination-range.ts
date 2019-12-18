import { PaginationRange } from "../src/pagination-range";
import { SegmentWithIds } from "../src/segment-with-ids";
import { Segment } from "../src/segment";

describe("PaginationRange", () => {
    let range: PaginationRange<number>;

    beforeEach(() => {
        range = new PaginationRange();
    });

    describe("after adding two separate segments", () => {
        let segment1: SegmentWithIds<number>;
        let segment2: SegmentWithIds<number>;
        let segment3: SegmentWithIds<number>;

        beforeEach(() => {
            segment1 = new SegmentWithIds(5, new Set([105, 106, 107, 108, 109, 110, 111, 112]));
            segment2 = new SegmentWithIds(20, new Set([120, 121, 122, 123, 124]));
            segment3 = new SegmentWithIds(7, new Set([107, 108, 109, 110, 111, 112, 113, 114]));

            range.add(segment1);
            range.add(segment2);
            range.add(segment3);
        });

        it("returns loaded range", () =>
            expect(range.loadedSegments).toEqual([
                { offset: 5, count: 10 },
                { offset: 20, count: 5 },
            ]));

        it.each([
            {
                segment: new Segment(1, 7),
                expected: new Set([105, 106, 107]),
            },
            {
                segment: new Segment(11, 1),
                expected: new Set([111]),
            },
            {
                segment: new Segment(21, 3),
                expected: new Set([121, 122, 123]),
            },
            {
                segment: new Segment(1, 40),
                expected: new Set([
                    105,
                    106,
                    107,
                    108,
                    109,
                    110,
                    111,
                    112,
                    120,
                    121,
                    122,
                    123,
                    124,
                    107,
                    108,
                    109,
                    110,
                    111,
                    112,
                    113,
                    114,
                ]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment; expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(2, 16),
                expected: [new Segment(2, 3), new Segment(15, 3)],
            },
            {
                requested: new Segment(2, 6),
                expected: [new Segment(2, 3)],
            },
            {
                requested: new Segment(2, 20),
                expected: [new Segment(2, 3), new Segment(15, 5)],
            },
            {
                requested: new Segment(2, 30),
                expected: [new Segment(2, 3), new Segment(15, 5), new Segment(25, 7)],
            },
        ])(
            "`getMissingSegments` test set %#",
            ({ requested, expected }: { requested: Segment; expected: Segment[] }) => {
                expect(range.getMissingSegments(requested)).toEqual(expected);
            },
        );
    });

    describe("after adding three separate segments", () => {
        beforeEach(() => {
            [
                new SegmentWithIds(3, new Set([103, 104])),
                new SegmentWithIds(6, new Set([106])),
                new SegmentWithIds(8, new Set([108])),
                new SegmentWithIds(9, new Set([109])),
            ].forEach(segment => range.add(segment));
        });

        it("returns loaded range", () =>
            expect(range.loadedSegments).toEqual([new Segment(3, 2), new Segment(6, 1), new Segment(8, 2)]));

        it.each([
            {
                segment: new Segment(1, 7),
                expected: new Set([103, 104, 106]),
            },
            {
                segment: new Segment(8, 10),
                expected: new Set([108, 109]),
            },
            {
                segment: new Segment(1, 40),
                expected: new Set([103, 104, 106, 108, 109]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment; expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(8, 2),
                expected: true,
            },
            {
                requested: new Segment(1, 12),
                expected: false,
            },
            {
                requested: new Segment(3, 2),
                expected: true,
            },
        ])("`isFullyLoaded` test set %#", ({ requested, expected }: { requested: Segment; expected: boolean }) => {
            expect(range.isFullyLoaded(requested)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(1, 12),
                expected: [new Segment(1, 2), new Segment(5, 1), new Segment(7, 1), new Segment(10, 3)],
            },
            {
                requested: new Segment(3, 2),
                expected: [],
            },
        ])(
            "`getMissingSegments` test set %#",
            ({ requested, expected }: { requested: Segment; expected: Segment[] }) => {
                expect(range.getMissingSegments(requested)).toEqual(expected);
            },
        );
    });

    describe("after adding one segments", () => {
        beforeEach(() => range.add(new SegmentWithIds(1, new Set([101, 102]))));

        it("returns loaded range", () =>
            expect(range.loadedSegments).toEqual([new Segment(1, 2)]));

        it.each([
            {
                segment: new Segment(1, 7),
                expected: new Set([101, 102]),
            },
            {
                segment: new Segment(4, 1),
                expected: new Set([]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment; expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(8, 2),
                expected: false,
            },
            {
                requested: new Segment(1, 2),
                expected: true,
            },
        ])("`isFullyLoaded` test set %#", ({ requested, expected }: { requested: Segment; expected: boolean }) => {
            expect(range.isFullyLoaded(requested)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(1, 2),
                expected: [],
            },
            {
                requested: new Segment(1, 12),
                expected: [new Segment(3, 10)],
            },
        ])(
            "`getMissingSegments` test set %#",
            ({ requested, expected }: { requested: Segment; expected: Segment[] }) => {
                expect(range.getMissingSegments(requested)).toEqual(expected);
            },
        );
    });

    describe("after adding connected segments", () => {
        beforeEach(() => {
            [
                new SegmentWithIds(1, new Set([101, 102, 103])),
                new SegmentWithIds(4, new Set([104, 105, 106, 107])),
                new SegmentWithIds(8, new Set([108, 109, 110, 111, 112])),
            ].forEach(segment => range.add(segment));
        });

        it("returns loaded range", () =>
            expect(range.loadedSegments).toEqual([new Segment(1, 12)]));

        it.each([
            {
                segment: new Segment(0, 14),
                expected: new Set([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]),
            },
            {
                segment: new Segment(1, 12),
                expected: new Set([101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112]),
            },
            {
                segment: new Segment(4, 1),
                expected: new Set([104]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment; expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(2, 7),
                expected: true,
            },
            {
                requested: new Segment(1, 12),
                expected: true,
            },
            {
                requested: new Segment(0, 2),
                expected: false,
            },
            {
                requested: new Segment(10, 4),
                expected: false,
            },
        ])("`isFullyLoaded` test set %#", ({ requested, expected }: { requested: Segment; expected: boolean }) => {
            expect(range.isFullyLoaded(requested)).toEqual(expected);
        });

        it.each([
            {
                requested: new Segment(2, 7),
                expected: [],
            },
            {
                requested: new Segment(1, 12),
                expected: [],
            },
            {
                requested: new Segment(1, 2),
                expected: [],
            },
            {
                requested: new Segment(0, 12),
                expected: [new Segment(0, 1)],
            },
            {
                requested: new Segment(0, 18),
                expected: [new Segment(0, 1), new Segment(13, 5)],
            },
        ])(
            "`getMissingSegments` test set %#",
            ({ requested, expected }: { requested: Segment; expected: Segment[] }) => {
                expect(range.getMissingSegments(requested)).toEqual(expected);
            },
        );
    });
});
