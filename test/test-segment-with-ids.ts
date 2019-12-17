import { Segment, SegmentWithIds, tidySegments } from "../src";

describe("SegmentWithIds", () => {
    describe("`intersect`", () => {
        it.each([
            // Intersection overlaps with beginning of segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 8, count: 3 },
                ],
                expected: new SegmentWithIds(10, new Set([110])),
            },
            // Intersection overlaps with end of segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 11, count: 4 },
                ],
                expected: new SegmentWithIds(11, new Set([111, 112])),
            },
            // Intersection is contained withing segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 11, count: 1 },
                ],
                expected: new SegmentWithIds(11, new Set([111])),
            },
            // Intersection is before segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 7, count: 1 },
                ],
                expected: undefined,
            },
            // Intersection is after segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 113, count: 1 },
                ],
                expected: undefined,
            },
            // Segment is contained within intersection.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 8, count: 10 },
                ],
                expected: { offset: 10, count: 3, ids: new Set([110, 111, 112]) },
            },
            // Intersection is equal to segment.
            {
                given: [
                    new SegmentWithIds(10, new Set([110, 111, 112])),
                    { offset: 10, count: 3 },
                ],
                expected: new SegmentWithIds(10, new Set([110, 111, 112])),
            },
        ])("test set %#", (
            { given, expected }: { given: [SegmentWithIds<number>, Segment], expected: SegmentWithIds<number> },
        ) => {
            expect(given[0].intersect(given[1])).toEqual(expected);
        });
    });

    describe("`combine`", () => {
        it.each([
            {
                given: [
                    new SegmentWithIds(10, new Set([110])),
                    new SegmentWithIds(10, new Set([110, 111, 112, 113, 114])),
                ],
                expected: new SegmentWithIds(10, new Set([110, 111, 112, 113, 114])),
            },
            {
                given: [
                    new SegmentWithIds(10, new Set([110])),
                    new SegmentWithIds(11, new Set([111])),
                ],
                expected: new SegmentWithIds(10, new Set([110, 111])),
            },
            {
                given: [
                    new SegmentWithIds(12, new Set([112, 113, 114, 115, 116, 117, 118])),
                    new SegmentWithIds(10, new Set([110, 111, 112, 113, 114])),
                ],
                expected: new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116, 117, 118])),
            },
            {
                given: [
                    new SegmentWithIds(10, new Set([110])),
                    new SegmentWithIds(10, new Set([110])),
                ],
                expected: new SegmentWithIds(10, new Set([110])),
            },
        ])("test set %#", ({ given, expected }: {
            given: [SegmentWithIds<number>, SegmentWithIds<number>],
            expected: SegmentWithIds<number>,
        }) => {
            expect(given[0].combine(given[1])).toEqual(expected);
            expect(given[1].combine(given[0])).toEqual(expected);
        });
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
                new SegmentWithIds(10, new Set([110])),
            ],
            expected: [
                new SegmentWithIds(10, new Set([110])),
            ]
        },
        {
            given: [
                new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119])),
                new SegmentWithIds(20, new Set([120, 121, 122, 123, 124, 125, 126, 127, 128, 129])),
            ],
            expected: [
                new SegmentWithIds(
                    10,
                    new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                ),
            ]
        },
        {
            given: [
                new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119])),
                new SegmentWithIds(18, new Set([118, 119, 120, 121, 122, 123, 124, 125, 126, 127, 128, 129])),
            ],
            expected: [
                new SegmentWithIds(
                    10,
                    new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                ),
            ]
        },
        {
            given: [
                new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119])),
                new SegmentWithIds(20, new Set([120, 121, 122, 123, 124, 125, 126, 127, 128, 129])),
                new SegmentWithIds(35, new Set([135, 136, 137, 138, 139])),
            ],
            expected: [
                new SegmentWithIds(10,
                    new Set([
                        110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
                        120, 121, 122, 123, 124, 125, 126, 127, 128, 129,
                    ]),
                ),
                new SegmentWithIds(35, new Set([135, 136, 137, 138, 139])),
            ]
        },
        {
            given: [
                new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116])),
                new SegmentWithIds(12, new Set([112, 113])),
                new SegmentWithIds(13, new Set([113, 114, 115, 116, 117, 118, 119])),
                new SegmentWithIds(22, new Set([122, 123, 124])),
                new SegmentWithIds(27, new Set([127, 128, 129])),
            ],
            expected: [
                new SegmentWithIds(10, new Set([110, 111, 112, 113, 114, 115, 116, 117, 118, 119])),
                new SegmentWithIds(22, new Set([122, 123, 124])),
                new SegmentWithIds(27, new Set([127, 128, 129])),
            ]
        },
    ])("test set %#", (
        { given, expected }: { given: SegmentWithIds<number>[], expected: SegmentWithIds<number>[] },
    ) => {
        expect(tidySegments(given)).toEqual(expected);
    });
});
