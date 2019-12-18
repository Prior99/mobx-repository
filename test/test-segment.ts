import { Segment, sortSegments } from "../src";

describe("Segment", () => {
    describe("`split`", () => {
        it.each([
            {
                segment: new Segment(10, 10),
                at: 15,
                expected: [new Segment(10, 5), new Segment(15, 5)],
            },
            {
                segment: new Segment(1, 2),
                at: 1,
                expected: [new Segment(1, 2)],
            },
            {
                segment: new Segment(10, 10),
                at: 8,
                expected: [new Segment(10, 10)],
            },
            {
                segment: new Segment(10, 10),
                at: 19,
                expected: [new Segment(10, 10)],
            },
        ])(
            "test set %#",
            ({ segment, at, expected }: { segment: Segment; at: number; expected: [Segment, Segment] }) => {
                expect(segment.split(at)).toEqual(expected);
            },
        );
    });

    describe("`overlaps`", () => {
        it.each([
            {
                given: [new Segment(10, 1), new Segment(10, 5)],
                expected: true,
            },
            {
                given: [new Segment(10, 1), new Segment(11, 1)],
                expected: true,
            },
            {
                given: [new Segment(12, 7), new Segment(10, 5)],
                expected: true,
            },
            {
                given: [new Segment(10, 1), new Segment(12, 1)],
                expected: false,
            },
        ])("test set %#", ({ given, expected }: { given: [Segment, Segment]; expected: boolean }) => {
            expect(given[0].overlaps(given[1])).toBe(expected);
            expect(given[1].overlaps(given[0])).toBe(expected);
        });
    });
});

describe("`sortSegments`", () => {
    it.each([
        {
            given: [],
            expected: [],
        },
        {
            given: [new Segment(10, 1)],
            expected: [new Segment(10, 1)],
        },
        {
            given: [new Segment(20, 10), new Segment(10, 10), new Segment(35, 5)],
            expected: [new Segment(10, 10), new Segment(20, 10), new Segment(35, 5)],
        },
        {
            given: [new Segment(12, 2), new Segment(27, 3), new Segment(10, 5), new Segment(22, 3), new Segment(13, 7)],
            expected: [
                new Segment(10, 5),
                new Segment(12, 2),
                new Segment(13, 7),
                new Segment(22, 3),
                new Segment(27, 3),
            ],
        },
    ])("test set %#", ({ given, expected }: { given: Segment[]; expected: Segment[] }) => {
        expect(sortSegments(given)).toEqual(expected);
    });
});
