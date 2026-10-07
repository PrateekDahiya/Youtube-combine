import { render, screen, fireEvent } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import VideoPlayer from "./Videoplayer";

const baseProps = {
    mode: "progressive",
    streamUrl: "http://localhost/video-a.mp4",
    audioUrl: "",
    type: "video",
    muted: false,
    qualityoptions: [360, 720],
    video_resolution: 0,
};

describe("VideoPlayer quality switching", () => {
    test("mounts a fresh video element when the stream URL changes", () => {
        const { container, rerender } = render(<VideoPlayer {...baseProps} />);
        const first = container.querySelector(".video-layer video");
        expect(first).not.toBeNull();
        expect(first.getAttribute("src")).toBe("http://localhost/video-a.mp4");

        rerender(<VideoPlayer {...baseProps} streamUrl="http://localhost/video-b.mp4" />);
        const second = container.querySelector(".video-layer video");
        expect(second).not.toBeNull();
        expect(second).not.toBe(first);
        expect(second.getAttribute("src")).toBe("http://localhost/video-b.mp4");
    });

    test("mounts a fresh audio element when the audio URL changes", () => {
        const { container, rerender } = render(
            <VideoPlayer {...baseProps} mode="adaptive" audioUrl="http://localhost/audio-a.mp4" />
        );
        const firstAudio = container.querySelector(".video-layer audio");
        expect(firstAudio).not.toBeNull();

        rerender(
            <VideoPlayer
                {...baseProps}
                mode="adaptive"
                streamUrl="http://localhost/video-b.mp4"
                audioUrl="http://localhost/audio-b.mp4"
            />
        );
        const secondAudio = container.querySelector(".video-layer audio");
        expect(secondAudio).not.toBeNull();
        expect(secondAudio).not.toBe(firstAudio);
        expect(secondAudio.getAttribute("src")).toBe("http://localhost/audio-b.mp4");
    });

    test("quality menu reports the selected option to the parent", async () => {
        const onQualityChange = jest.fn();
        render(
            <VideoPlayer
                {...baseProps}
                onQualityChange={onQualityChange}
                streamData={{
                    progressive: [{ resolution: 360, url: "http://localhost/p360.mp4" }],
                    adaptive: {
                        video: [{ resolution: 720, url: "http://localhost/a720.mp4" }],
                        audio: [{ url: "http://localhost/au.mp4" }],
                    },
                }}
            />
        );
        const settingsButton = document.querySelector(".settings-menu > .ctrl-btn");
        await act(async () => {
            fireEvent.click(settingsButton);
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Quality"));
        });
        await act(async () => {
            fireEvent.click(screen.getByText("720p"));
        });
        expect(onQualityChange).toHaveBeenCalledWith(
            720,
            "adaptive",
            "http://localhost/a720.mp4",
            "http://localhost/au.mp4"
        );
    });

    test("local mode lists manifest labels and reports label selection", async () => {
        const onQualityChange = jest.fn();
        render(
            <VideoPlayer
                {...baseProps}
                mode="local"
                streamUrl="http://localhost/v-720p.mp4"
                onQualityChange={onQualityChange}
                qualityoptions={["720p", "360p"]}
            />
        );
        const settingsButton = document.querySelector(".settings-menu > .ctrl-btn");
        await act(async () => {
            fireEvent.click(settingsButton);
        });
        await act(async () => {
            fireEvent.click(screen.getByText("Quality"));
        });
        await act(async () => {
            fireEvent.click(screen.getByText("360p"));
        });
        expect(onQualityChange).toHaveBeenCalledWith("360p", "local", "", "");
    });

    test("buffering spinner appears while waiting", async () => {
        const { container } = render(<VideoPlayer {...baseProps} />);
        const video = container.querySelector(".video-layer video");
        expect(document.querySelector(".buffer-spinner")).toBeNull();
        await act(async () => {
            fireEvent(video, new window.Event("waiting"));
        });
        expect(document.querySelector(".buffer-spinner")).not.toBeNull();
        await act(async () => {
            fireEvent(video, new window.Event("playing"));
        });
        expect(document.querySelector(".buffer-spinner")).toBeNull();
    });
});
