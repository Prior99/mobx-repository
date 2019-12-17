import { tidySegments, Segment, sortSegments, combineSegments, doSegmentsOverlap, PaginationRange, splitSegment, SegmentWithIds, intersectSegments } from "../src/pagination-range";

describe("`intersectSegments`", () => {
    it.each([
        // Intersection overlaps with beginning of segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 8, count: 3 },
            ],
            expected: {
                offset: 10,
                count: 1,
                ids: new Set([110]),
            },
        },
        // Intersection overlaps with end of segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 11, count: 4 },
            ],
            expected: {
                offset: 11,
                count: 2,
                ids: new Set([111, 112]),
            },
        },
        // Intersection is contained withing segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 11, count: 1 },
            ],
            expected: {
                offset: 11,
                count: 1,
                ids: new Set([111]),
            },
        },
        // Intersection is before segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 7, count: 1 },
            ],
            expected: undefined,
        },
        // Intersection is after segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 113, count: 1 },
            ],
            expected: undefined,
        },
        // Segment is contained within intersection.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 8, count: 10 },
            ],
            expected: { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
        },
        // Intersection is equal to segment.
        {
            given: [
                { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
                { offset: 10, count: 3 },
            ],
            expected: { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
        },
    ])("test set %#", (
        { given, expected }: { given: [SegmentWithIds<number>, Segment], expected: SegmentWithIds<number> },
    ) => {
        expect(intersectSegments(...given)).toEqual(expected);
    });
});

describe("`splitSegment`", () => {
    it.each([
        {
            segment: { offset: 10, count: 10 },
            at: 15,
            expected: [
                { offset: 10, count: 5 },
                { offset: 15, count: 5 },
            ],
        },
        {
            segment: { offset: 1, count: 2 },
            at: 1,
            expected: [
                { offset: 1, count: 2 },
            ],
        },
        {
            segment: { offset: 10, count: 10 },
            at: 8,
            expected: [
                { offset: 10, count: 10 },
            ],
        },
        {
            segment: { offset: 10, count: 10 },
            at: 19,
            expected: [
                { offset: 10, count: 10 },
            ],
        },
    ])("test set %#", ({ segment, at, expected }: { segment: Segment, at: number, expected: [Segment, Segment] }) => {
        expect(splitSegment(segment, at)).toEqual(expected);
    });
});

describe("`doSegmentsOverlap`", () => {
    it.each([
        {
            given: [
                { offset: 10, count: 1 },
                { offset: 10, count: 5 },
            ],
            expected: true,
        },
        {
            given: [
                { offset: 10, count: 1 },
                { offset: 11, count: 1 },
            ],
            expected: true,
        },
        {
            given: [
                { offset: 12, count: 7 },
                { offset: 10, count: 5 },
            ],
            expected: true,
        },
        {
            given: [
                { offset: 10, count: 1 },
                { offset: 12, count: 1 },
            ],
            expected: false,
        },
    ])("test set %#", ({ given, expected }: { given: [Segment, Segment], expected: boolean }) => {
        expect(doSegmentsOverlap(...given)).toBe(expected);
    });
});

describe("`combineSegments`", () => {
    it.each([
        {
            given: [
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
                {
                    offset: 10,
                    count: 5,
                    ids: new Set([110, 111, 112, 113, 114]),
                },
            ],
            expected: {
                offset: 10,
                count: 5,
                ids: new Set([110, 111, 112, 113, 114]),
            },
        },
        {
            given: [
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
                {
                    offset: 11,
                    count: 1,
                    ids: new Set([111]),
                },
            ],
            expected: {
                offset: 10,
                count: 2,
                ids: new Set([110, 111]),
            },
        },
        {
            given: [
                {
                    offset: 12,
                    count: 7,
                    ids: new Set([112, 113, 114, 115, 116, 117, 118]),
                },
                {
                    offset: 10,
                    count: 5,
                    ids: new Set([110, 111, 112, 113, 114]),
                },
            ],
            expected: {
                offset: 10,
                count: 9,
                ids: new Set([110, 111, 112, 113, 114, 115, 116, 117, 118]),
            },
        },
        {
            given: [
                {
                    offset: 10,
                    count: 5,
                    ids: new Set([110, 111, 112, 113, 114])
                },
                {
                    offset: 16,
                    count: 2,
                    ids: new Set([116, 117]),
                },
            ],
            expected: {
                offset: 10,
                count: 8,
                ids: new Set([110, 111, 112, 113, 114, 116, 117]),
            },
        },
        {
            given: [
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
            ],
            expected: {
                offset: 10,
                count: 1,
                ids: new Set([110]),
            },
        },
    ])("test set %#", ({ given, expected }: {
        given: [SegmentWithIds<number>, SegmentWithIds<number>],
        expected: SegmentWithIds<number>,
    }) => {
        expect(combineSegments(...given)).toEqual(expected);
    });
});

describe("`sortSegments`", () => {
    it.each([
        {
            given: [],
            expected: [],
        },
        {
            given: [
                { offset: 10, count: 1 },
            ],
            expected: [
                { offset: 10, count: 1 },
            ]
        },
        {
            given: [
                { offset: 20, count: 10 },
                { offset: 10, count: 10 },
                { offset: 35, count: 5 },
            ],
            expected: [
                { offset: 10, count: 10 },
                { offset: 20, count: 10 },
                { offset: 35, count: 5 },
            ]
        },
        {
            given: [
                { offset: 12, count: 2 },
                { offset: 27, count: 3 },
                { offset: 10, count: 5 },
                { offset: 22, count: 3 },
                { offset: 13, count: 7 },
            ],
            expected: [
                { offset: 10, count: 5 },
                { offset: 12, count: 2 },
                { offset: 13, count: 7 },
                { offset: 22, count: 3 },
                { offset: 27, count: 3 },
            ]
        },
    ])("test set %#", ({ given, expected }: { given: Segment[], expected: Segment[] }) => {
        expect(sortSegments(given)).toEqual(expected);
    });
});

describe("`tidySegments`", () => {
    it.each([
        {
            given: [],
            expected: [],
        },
        {
            given: [
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
            ],
            expected: [
                {
                    offset: 10,
                    count: 1,
                    ids: new Set([110]),
                },
            ]
        },
        {
            given: [
                {
                    offset: 10,
                    count: 10,
                    ids: new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119]),
                },
                {
                    offset: 20,
                    count: 10,
                    ids: new Set([120, 121, 122, 123, 124, 125, 126, 127, 128, 129]),
                },
            ],
            expected: [
                {
                    offset: 10,
                    count: 20,
                    ids: new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                },
            ]
        },
        {
            given: [
                {
                    offset: 10,
                    count: 10,
                    ids: new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119]),
                },
                {
                    offset: 18,
                    count: 12,
                    ids: new Set([118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129]),
                },
            ],
            expected: [
                {
                    offset: 10,
                    count: 20,
                    ids: new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                },
            ]
        },
        {
            given: [
                {
                    offset: 10,
                    count: 10,
                    ids: new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119]),
                },
                {
                    offset: 20,
                    count: 10,
                    ids: new Set([120, 121, 122, 123, 124, 125, 126, 127, 128, 129]),
                },
                {
                    offset: 35,
                    count: 5,
                    ids: new Set([135, 136, 137, 138, 139]),
                },
            ],
            expected: [
                {
                    offset: 10,
                    count: 20,
                    ids: new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                },
                {
                    offset: 35,
                    count: 5,
                    ids: new Set([135, 136, 137, 138, 139]),
                },
            ]
        },
        {
            given: [
                {
                    offset: 10,
                    count: 5,
                    ids: new Set([110, 111, 112, 113, 114]),
                },
                {
                    offset: 12,
                    count: 2,
                    ids: new Set([112, 113]),
                },
                {
                    offset: 13,
                    count: 7,
                    ids: new Set([113, 114, 115, 116, 117, 118, 119]),
                },
                {
                    offset: 22,
                    count: 3,
                    ids: new Set([122, 123, 124]),
                },
                {
                    offset: 27,
                    count: 3,
                    ids: new Set([127, 128, 129]),
                },
            ],
            expected: [
                {
                    offset: 10,
                    count: 10,
                    ids: new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119]),
                },
                {
                    offset: 22,
                    count: 3,
                    ids: new Set([122, 123, 124]),
                },
                {
                    offset: 27,
                    count: 3,
                    ids: new Set([127, 128, 129]),
                },
            ]
        },
    ])("test set %#", (
        { given, expected }: { given: SegmentWithIds<number>[], expected: SegmentWithIds<number>[] },
    ) => {
        expect(tidySegments(given)).toEqual(expected);
    });
});

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
            segment1 = {
                offset: 5,
                count: 8,
                ids: new Set([105, 106, 107, 108, 109, 110, 111, 112]),
            };
            segment2 = {
                offset: 20,
                count: 5,
                ids: new Set([120, 121, 122, 123, 124]),
            };
            segment3 = {
                offset: 7,
                count: 8,
                ids: new Set([107, 108, 109, 110, 111, 112, 113, 114]),
            };

            range.add(segment1);
            range.add(segment2);
            range.add(segment3);
        });

        it("returns loaded range", () => expect(range.loadedSegments).toEqual([
            { offset: 5, count: 10 },
            { offset: 20, count: 5 },
        ]))

        it.each([
            {
                segment: { offset: 1, count: 7 },
                expected: new Set([105, 106, 107]),
            },
            {
                segment: { offset: 11, count: 10 },
                expected: new Set([111, 112, 113, 114, 120]),
            },
            {
                segment: { offset: 21, count: 3 },
                expected: new Set([121, 122, 123]),
            },
            {
                segment: { offset: 1, count: 40 },
                expected: new Set([
                    105, 106, 107, 108, 109, 110, 111, 112,
                    120, 121, 122, 123, 124,
                    107, 108, 109, 110, 111, 112, 113, 114,
                ]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment, expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: { offset: 2, count: 16 },
                expected: [
                    { offset: 2, count: 3 },
                    { offset: 15, count: 3 }
                ],
            },
            {
                requested: { offset: 2, count: 6 },
                expected: [
                    { offset: 2, count: 3 },
                ],
            },
            {
                requested: { offset: 2, count: 20 },
                expected: [
                    { offset: 2, count: 3 },
                    { offset: 15, count: 5 }
                ],
            },
            {
                requested: { offset: 2, count: 30 },
                expected: [
                    { offset: 2, count: 3 },
                    { offset: 15, count: 5 },
                    { offset: 25, count: 7 },
                ],
            },
        ])("`getMissingSegments` test set %#", ({ requested, expected }: { requested: Segment, expected: Segment[] }) => {
            expect(range.getMissingSegments(requested)).toEqual(expected);
        });
    });

    describe("after adding three separate segments", () => {
        beforeEach(() => {
            [
                {
                    offset: 3,
                    count: 2,
                    ids: new Set([103, 104]),
                },
                {
                    offset: 6,
                    count: 1,
                    ids: new Set([106]),
                },
                {
                    offset: 8,
                    count: 1,
                    ids: new Set([108]),
                },
                {
                    offset: 9,
                    count: 1,
                    ids: new Set([109])
                },
            ].forEach(segment => range.add(segment));
        });

        it("returns loaded range", () => expect(range.loadedSegments).toEqual([
            { offset: 3, count: 2 },
            { offset: 6, count: 1 },
            { offset: 8, count: 2 },
        ]));

        it.each([
            {
                segment: { offset: 1, count: 7 },
                expected: new Set([103, 104, 106]),
            },
            {
                segment: { offset: 8, count: 10 },
                expected: new Set([108, 109]),
            },
            {
                segment: { offset: 1, count: 40 },
                expected: new Set([103, 104, 106, 108, 109 ]),
            },
        ])("`getIds` test set %#", ({ segment, expected }: { segment: Segment, expected: Set<number> }) => {
            expect(range.getIds(segment)).toEqual(expected);
        });

        it.each([
            {
                requested: { offset: 8, count: 2 },
                expected: false,
            },
            {
                requested: { offset: 1, count: 12 },
                expected: false,
            },
        ])("`isFullyLoaded` test set %#", ({ requested, expected }: { requested: Segment, expected: boolean }) => {
            expect(range.isFullyLoaded(requested)).toEqual(expected);
        });

        it.each([
            {
                requested: { offset: 1, count: 12 },
                expected: [
                    { offset: 1, count: 2 },
                    { offset: 5, count: 1 },
                    { offset: 7, count: 1 },
                    { offset: 10, count: 3 },
                ],
            },
        ])("`getMissingSegments` test set %#", ({ requested, expected }: { requested: Segment, expected: Segment[] }) => {
            expect(range.getMissingSegments(requested)).toEqual(expected);
        });
    });
});