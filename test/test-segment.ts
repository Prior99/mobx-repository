import { Segment, sortSegments } from "../src";

describe("Segment", () => {
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
        "`split` test set %#",
        ({ segment, at, expected }: { segment: Segment; at: number; expected: [Segment, Segment] }) => {
            expect(segment.split(at)).toEqual(expected);
        },
    );

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
    ])("`overlaps`test set %#", ({ given, expected }: { given: [Segment, Segment]; expected: boolean }) => {
        expect(given[0].overlaps(given[1])).toBe(expected);
        expect(given[1].overlaps(given[0])).toBe(expected);
    });

    it.each([
        {
            given: [new Segment(1, 2), new Segment(1, 2)],
            expected: true,
        },
        {
            given: [new Segment(1, 10), new Segment(1, 10)],
            expected: true,
        },
        {
            given: [new Segment(8, 8), new Segment(8, 8)],
            expected: true,
        },
        {
            given: [new Segment(0, 0), new Segment(0, 0)],
            expected: true,
        },
        {
            given: [new Segment(5, 1), new Segment(1, 5)],
            expected: false,
        },
    ])("`equals` test set %#", ({ given, expected }: { given: [Segment, Segment]; expected: boolean }) => {
        expect(given[0].equals(given[1])).toBe(expected);
        expect(given[1].equals(given[0])).toBe(expected);
    });
    it.each([
        {
            outer: new Segment(1, 3),
            inner: new Segment(1, 3),
            expected: true,
        },
        {
            outer: new Segment(1, 3),
            inner: new Segment(2, 4),
            expected: false,
        },
        {
            outer: new Segment(1, 3),
            inner: new Segment(2, 1),
            expected: true,
        },
        {
            outer: new Segment(2, 1),
            inner: new Segment(1, 3),
            expected: false,
        },
        {
            outer: new Segment(2, 3),
            inner: new Segment(1, 3),
            expected: false,
        },
        {
            outer: new Segment(1, 1),
            inner: new Segment(3, 1),
            expected: false,
        },
        {
            outer: new Segment(3, 1),
            inner: new Segment(1, 1),
            expected: false,
        },
    ])(
        "`contains` test set %#",
        ({ outer, inner, expected }: { outer: Segment; inner: Segment; expected: boolean }) => {
            expect(outer.contains(inner)).toBe(expected);
        },
    );

    it.each([
        {
            outer: new Segment(1, 3),
            inner: new Segment(1, 3),
            expected: true,
        },
        {
            outer: new Segment(1, 3),
            inner: new Segment(2, 4),
            expected: false,
        },
        {
            outer: new Segment(1, 3),
            inner: new Segment(2, 1),
            expected: true,
        },
        {
            outer: new Segment(2, 1),
            inner: new Segment(1, 3),
            expected: false,
        },
        {
            outer: new Segment(2, 3),
            inner: new Segment(1, 3),
            expected: false,
        },
        {
            outer: new Segment(1, 1),
            inner: new Segment(3, 1),
            expected: false,
        },
        {
            outer: new Segment(3, 1),
            inner: new Segment(1, 1),
            expected: false,
        },
    ])(
        "`containedIn` test set %#",
        ({ outer, inner, expected }: { outer: Segment; inner: Segment; expected: boolean }) => {
            expect(inner.containedIn(outer)).toBe(expected);
        },
    );

    it.each([
        {
            minuend: new Segment(1, 3),
            subtrahend: new Segment(1, 3),
            expected: [],
        },
        {
            minuend: new Segment(1, 3),
            subtrahend: new Segment(2, 3),
            expected: [new Segment(1, 1)],
        },
        {
            minuend: new Segment(1, 3),
            subtrahend: new Segment(2, 1),
            expected: [new Segment(1, 1), new Segment(3, 1)],
        },
        {
            minuend: new Segment(2, 1),
            subtrahend: new Segment(1, 3),
            expected: [],
        },
        {
            minuend: new Segment(2, 3),
            subtrahend: new Segment(1, 3),
            expected: [new Segment(3, 1)],
        },
        {
            minuend: new Segment(1, 1),
            subtrahend: new Segment(3, 1),
            expected: [new Segment(1, 1)],
        },
        {
            minuend: new Segment(3, 1),
            subtrahend: new Segment(1, 1),
            expected: [new Segment(3, 1)],
        },
        {
            minuend: new Segment(2, 5),
            subtrahend: new Segment(4, 5),
            expected: [new Segment(2, 2)],
        },
        {
            minuend: new Segment(4, 5),
            subtrahend: new Segment(2, 5),
            expected: [new Segment(6, 2)],
        },
    ])(
        "`subtract` test set %#",
        ({ subtrahend, minuend, expected }: { subtrahend: Segment; minuend: Segment; expected: Segment[] }) => {
            expect(minuend.subtract(subtrahend)).toEqual(expected);
        },
    );
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
