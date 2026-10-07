export const pickAdaptiveAudio = (audioList) => {
    if (!Array.isArray(audioList) || audioList.length === 0) return null;
    return audioList.find((a) => (a.mimeType || "").includes("audio/mp4")) || audioList[0];
};

export const isGoogleVideoUrl = (url) =>
    typeof url === "string" && url.includes("googlevideo.com") && !url.includes("/stream/fetch");

export const proxyStreamUrl = (url) => {
    const base = process.env.REACT_APP_SERVER_URL || "/api";
    return `${base}/stream/fetch?u=${encodeURIComponent(url)}`;
};
