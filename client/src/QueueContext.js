import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";

const QueueContext = createContext(null);

const STORAGE_KEY = "vidvault_queue_v1";
const HISTORY_LIMIT = 50;

const LOOP_OFF = "off";
const LOOP_ALL = "all";
const LOOP_ONE = "one";

function normalizeVideo(video) {
    if (!video || !video.video_id) return null;
    return {
        video_id: video.video_id,
        title: video.title || "Untitled",
        thumbnail_link: video.thumbnail_link || "",
        channel_name: video.channel_name || "",
        channel_id: video.channel_id || "",
        duration: video.duration || 0,
        isShort: video.isShort ? 1 : 0,
    };
}

function loadPersisted() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.queue)) return null;
        return {
            queue: parsed.queue.filter((v) => v && v.video_id),
            currentIndex: typeof parsed.currentIndex === "number" ? parsed.currentIndex : -1,
            loopMode: [LOOP_OFF, LOOP_ALL, LOOP_ONE].includes(parsed.loopMode) ? parsed.loopMode : LOOP_OFF,
            shuffle: parsed.shuffle === true,
            history: Array.isArray(parsed.history) ? parsed.history.filter((v) => v && v.video_id) : [],
        };
    } catch (error) {
        return null;
    }
}

function computeNext(state, randomFn) {
    const { queue, currentIndex, loopMode, shuffle } = state;
    if (queue.length === 0) return -1;
    if (loopMode === LOOP_ONE && currentIndex >= 0 && currentIndex < queue.length) return currentIndex;
    if (shuffle && queue.length > 1) {
        const rand = randomFn || Math.random;
        let next = currentIndex;
        while (next === currentIndex) {
            next = Math.floor(rand() * queue.length);
        }
        return next;
    }
    if (currentIndex + 1 < queue.length) return currentIndex + 1;
    if (loopMode === LOOP_ALL) return 0;
    return -1;
}

function computePrev(state) {
    const { queue, currentIndex, loopMode } = state;
    if (queue.length === 0) return -1;
    if (currentIndex - 1 >= 0) return currentIndex - 1;
    if (loopMode === LOOP_ALL) return queue.length - 1;
    return -1;
}

const initialState = {
    queue: [],
    currentIndex: -1,
    isOpen: false,
    loopMode: LOOP_OFF,
    shuffle: false,
    history: [],
};

function initState() {
    const persisted = typeof window !== "undefined" ? loadPersisted() : null;
    return { ...initialState, ...(persisted || {}) };
}

function reducer(state, action) {
    switch (action.type) {
        case "ENQUEUE": {
            const video = normalizeVideo(action.video);
            if (!video) return state;
            if (state.queue.some((v) => v.video_id === video.video_id)) return state;
            const queue = [...state.queue, video];
            return {
                ...state,
                queue,
                currentIndex: state.currentIndex === -1 ? 0 : state.currentIndex,
                isOpen: true,
            };
        }
        case "DEQUEUE": {
            const queue = state.queue.filter((v) => v.video_id !== action.videoId);
            let currentIndex = state.currentIndex;
            const removedAt = state.queue.findIndex((v) => v.video_id === action.videoId);
            if (removedAt !== -1 && removedAt < currentIndex) currentIndex -= 1;
            if (currentIndex >= queue.length) currentIndex = queue.length - 1;
            return { ...state, queue, currentIndex };
        }
        case "CLEAR":
            return { ...state, queue: [], currentIndex: -1 };
        case "PLAY_AT": {
            const index = action.index;
            if (index < 0 || index >= state.queue.length) return state;
            const current = state.queue[index];
            const history = [{ ...current, playedAt: Date.now() }, ...state.history.filter((v) => v.video_id !== current.video_id)].slice(0, HISTORY_LIMIT);
            return { ...state, currentIndex: index, history };
        }
        case "ADVANCE": {
            const next = computeNext(state);
            if (next === -1) return state;
            const current = state.queue[next];
            const history = [{ ...current, playedAt: Date.now() }, ...state.history.filter((v) => v.video_id !== current.video_id)].slice(0, HISTORY_LIMIT);
            return { ...state, currentIndex: next, history };
        }
        case "REWIND": {
            const prev = computePrev(state);
            if (prev === -1) return state;
            const current = state.queue[prev];
            const history = [{ ...current, playedAt: Date.now() }, ...state.history.filter((v) => v.video_id !== current.video_id)].slice(0, HISTORY_LIMIT);
            return { ...state, currentIndex: prev, history };
        }
        case "SET_OPEN":
            return { ...state, isOpen: action.open };
        case "CYCLE_LOOP": {
            const order = [LOOP_OFF, LOOP_ALL, LOOP_ONE];
            const nextMode = order[(order.indexOf(state.loopMode) + 1) % order.length];
            return { ...state, loopMode: nextMode };
        }
        case "TOGGLE_SHUFFLE":
            return { ...state, shuffle: !state.shuffle };
        case "CLEAR_HISTORY":
            return { ...state, history: [] };
        default:
            return state;
    }
}

const QueueProvider = ({ children }) => {
    const [state, dispatch] = useReducer(reducer, undefined, initState);

    useEffect(() => {
        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({
                    queue: state.queue,
                    currentIndex: state.currentIndex,
                    loopMode: state.loopMode,
                    shuffle: state.shuffle,
                    history: state.history,
                })
            );
        } catch (error) {
            console.log("Error persisting queue:", error.message);
        }
    }, [state.queue, state.currentIndex, state.loopMode, state.shuffle, state.history]);

    const value = useMemo(
        () => ({
            ...state,
            currentVideo:
                state.currentIndex >= 0 && state.currentIndex < state.queue.length
                    ? state.queue[state.currentIndex]
                    : null,
            enqueue: (video) => dispatch({ type: "ENQUEUE", video }),
            dequeue: (videoId) => dispatch({ type: "DEQUEUE", videoId }),
            clearQueue: () => dispatch({ type: "CLEAR" }),
            playAt: (index) => dispatch({ type: "PLAY_AT", index }),
            advance: () => dispatch({ type: "ADVANCE" }),
            rewind: () => dispatch({ type: "REWIND" }),
            setOpen: (open) => dispatch({ type: "SET_OPEN", open }),
            cycleLoop: () => dispatch({ type: "CYCLE_LOOP" }),
            toggleShuffle: () => dispatch({ type: "TOGGLE_SHUFFLE" }),
            clearHistory: () => dispatch({ type: "CLEAR_HISTORY" }),
            peekNextIndex: (randomFn) => computeNext(state, randomFn),
            peekPrevIndex: () => computePrev(state),
        }),
        [state]
    );

    return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
};

const useQueue = () => {
    const ctx = useContext(QueueContext);
    if (!ctx) throw new Error("useQueue must be used inside QueueProvider");
    return ctx;
};

export {
    QueueProvider,
    useQueue,
    reducer,
    computeNext,
    computePrev,
    normalizeVideo,
    LOOP_OFF,
    LOOP_ALL,
    LOOP_ONE,
};
