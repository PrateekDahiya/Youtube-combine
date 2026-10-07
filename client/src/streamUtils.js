export const pickAdaptiveAudio = (audioList) => {
    if (!Array.isArray(audioList) || audioList.length === 0) return null;
    return audioList.find((a) => (a.mimeType || "").includes("audio/mp4")) || audioList[0];
};
