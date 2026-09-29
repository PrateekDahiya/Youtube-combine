import {
    reducer,
    computeNext,
    computePrev,
    normalizeVideo,
    LOOP_OFF,
    LOOP_ALL,
    LOOP_ONE,
} from "./QueueContext";

const blank = () => ({
    queue: [],
    currentIndex: -1,
    isOpen: false,
    loopMode: LOOP_OFF,
    shuffle: false,
    history: [],
});

const vid = (id) => ({
    video_id: id,
    title: "t-" + id,
    thumbnail_link: "http://x/" + id + ".jpg",
    channel_name: "c",
    channel_id: "ch",
    duration: 60,
    isShort: 0,
});

const withQueue = (ids, extra) => ({
    ...blank(),
    queue: ids.map(vid),
    currentIndex: 0,
    ...(extra || {}),
});

describe("normalizeVideo", () => {
    test("keeps known fields, coerces isShort, rejects missing id", () => {
        expect(normalizeVideo(null)).toBeNull();
        expect(normalizeVideo({})).toBeNull();
        const v = normalizeVideo({ video_id: "a", title: "T", isShort: 1, extra: 1 });
        expect(v).toEqual({
            video_id: "a",
            title: "T",
            thumbnail_link: "",
            channel_name: "",
            channel_id: "",
            duration: 0,
            isShort: 1,
        });
    });
});

describe("computeNext", () => {
    test("empty queue returns -1", () => {
        expect(computeNext(blank())).toBe(-1);
    });
    test("advances within list, stops at end when loop off", () => {
        const s = withQueue(["a", "b", "c"]);
        expect(computeNext(s)).toBe(1);
        expect(computeNext({ ...s, currentIndex: 2 })).toBe(-1);
    });
    test("loop all wraps to 0", () => {
        const s = withQueue(["a", "b"], { loopMode: LOOP_ALL, currentIndex: 1 });
        expect(computeNext(s)).toBe(0);
    });
    test("loop one repeats current", () => {
        const s = withQueue(["a", "b"], { loopMode: LOOP_ONE, currentIndex: 1 });
        expect(computeNext(s)).toBe(1);
    });
    test("shuffle picks a different index", () => {
        const s = withQueue(["a", "b", "c"], { shuffle: true });
        const next = computeNext(s, () => 0.99);
        expect(next).not.toBe(0);
        expect(next).toBeGreaterThanOrEqual(0);
        expect(next).toBeLessThan(3);
    });
    test("shuffle with single video stays", () => {
        const s = withQueue(["a"], { shuffle: true });
        expect(computeNext(s)).toBe(-1);
    });
});

describe("computePrev", () => {
    test("empty queue returns -1", () => {
        expect(computePrev(blank())).toBe(-1);
    });
    test("steps back, stops at start when loop off", () => {
        const s = withQueue(["a", "b"], { currentIndex: 1 });
        expect(computePrev(s)).toBe(0);
        expect(computePrev({ ...s, currentIndex: 0 })).toBe(-1);
    });
    test("loop all wraps to last", () => {
        const s = withQueue(["a", "b", "c"], { loopMode: LOOP_ALL, currentIndex: 0 });
        expect(computePrev(s)).toBe(2);
    });
});

describe("reducer", () => {
    test("ENQUEUE adds, opens popup, dedupes, starts at 0", () => {
        let s = reducer(blank(), { type: "ENQUEUE", video: vid("a") });
        expect(s.queue.map((v) => v.video_id)).toEqual(["a"]);
        expect(s.currentIndex).toBe(0);
        expect(s.isOpen).toBe(true);
        s = reducer(s, { type: "ENQUEUE", video: vid("a") });
        expect(s.queue.length).toBe(1);
        s = reducer(s, { type: "ENQUEUE", video: null });
        expect(s.queue.length).toBe(1);
    });
    test("DEQUEUE adjusts current index", () => {
        const s = withQueue(["a", "b", "c"], { currentIndex: 1 });
        const after = reducer(s, { type: "DEQUEUE", videoId: "a" });
        expect(after.queue.map((v) => v.video_id)).toEqual(["b", "c"]);
        expect(after.currentIndex).toBe(0);
        const emptied = reducer(
            reducer(after, { type: "DEQUEUE", videoId: "b" }),
            { type: "DEQUEUE", videoId: "c" }
        );
        expect(emptied.queue).toEqual([]);
        expect(emptied.currentIndex).toBe(-1);
    });
    test("PLAY_AT sets index and records history without duplicates", () => {
        let s = withQueue(["a", "b"]);
        s = reducer(s, { type: "PLAY_AT", index: 1 });
        expect(s.currentIndex).toBe(1);
        expect(s.history.map((v) => v.video_id)).toEqual(["b"]);
        s = reducer(s, { type: "PLAY_AT", index: 0 });
        expect(s.history.map((v) => v.video_id)).toEqual(["a", "b"]);
        s = reducer(s, { type: "PLAY_AT", index: 99 });
        expect(s.currentIndex).toBe(0);
    });
    test("ADVANCE and REWIND walk the list", () => {
        let s = withQueue(["a", "b"]);
        s = reducer(s, { type: "ADVANCE" });
        expect(s.currentIndex).toBe(1);
        s = reducer(s, { type: "ADVANCE" });
        expect(s.currentIndex).toBe(1);
        s = reducer(s, { type: "REWIND" });
        expect(s.currentIndex).toBe(0);
        s = reducer(s, { type: "REWIND" });
        expect(s.currentIndex).toBe(0);
    });
    test("CYCLE_LOOP rotates off -> all -> one -> off", () => {
        let s = blank();
        s = reducer(s, { type: "CYCLE_LOOP" });
        expect(s.loopMode).toBe(LOOP_ALL);
        s = reducer(s, { type: "CYCLE_LOOP" });
        expect(s.loopMode).toBe(LOOP_ONE);
        s = reducer(s, { type: "CYCLE_LOOP" });
        expect(s.loopMode).toBe(LOOP_OFF);
    });
    test("TOGGLE_SHUFFLE, SET_OPEN, CLEAR, CLEAR_HISTORY", () => {
        let s = reducer(blank(), { type: "TOGGLE_SHUFFLE" });
        expect(s.shuffle).toBe(true);
        s = reducer(s, { type: "SET_OPEN", open: true });
        expect(s.isOpen).toBe(true);
        s = { ...withQueue(["a"]), history: [vid("a")] };
        s = reducer(s, { type: "CLEAR_HISTORY" });
        expect(s.history).toEqual([]);
        s = reducer(s, { type: "CLEAR" });
        expect(s.queue).toEqual([]);
        expect(s.currentIndex).toBe(-1);
    });
});
