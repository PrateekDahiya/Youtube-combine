const svgUri = (svg) =>
    "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);

const avatarSvg = (bg, fg) =>
    "<svg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'>" +
    "<rect width='128' height='128' fill='" + bg + "'/>" +
    "<circle cx='64' cy='46' r='22' fill='" + fg + "'/>" +
    "<ellipse cx='64' cy='106' rx='36' ry='24' fill='" + fg + "'/>" +
    "</svg>";

const thumbSvg = (bg, fg) =>
    "<svg xmlns='http://www.w3.org/2000/svg' width='640' height='360' viewBox='0 0 640 360'>" +
    "<rect width='640' height='360' fill='" + bg + "'/>" +
    "<circle cx='320' cy='180' r='52' fill='none' stroke='" + fg + "' stroke-width='6'/>" +
    "<polygon points='300,152 300,208 352,180' fill='" + fg + "'/>" +
    "</svg>";

const THEME_ASSETS = {
    light: {
        avatar: svgUri(avatarSvg("#e3e3e3", "#9d9d9d")),
        thumb: svgUri(thumbSvg("#e3e3e3", "#9d9d9d")),
    },
    dark: {
        avatar: svgUri(avatarSvg("#262626", "#8a8a8a")),
        thumb: svgUri(thumbSvg("#1f1f1f", "#8a8a8a")),
    },
};

const currentTheme = () => {
    if (typeof document !== "undefined") {
        if (document.body.classList.contains("dark")) return "dark";
        if (document.body.classList.contains("light")) return "light";
    }
    try {
        return localStorage.getItem("theme") === "dark" ? "dark" : "light";
    } catch (e) {
        return "light";
    }
};

const avatarFallback = () => THEME_ASSETS[currentTheme()].avatar;
const thumbFallback = () => THEME_ASSETS[currentTheme()].thumb;

const handleImgError = (fallback) => (e) => {
    const img = e && e.currentTarget;
    if (!img || img.dataset.fbk) return;
    img.dataset.fbk = "1";
    img.src = typeof fallback === "function" ? fallback() : fallback;
};

const hideImgOnError = (e) => {
    const img = e && e.currentTarget;
    if (!img || img.dataset.fbk) return;
    img.dataset.fbk = "1";
    img.style.display = "none";
};

export { avatarFallback, thumbFallback, handleImgError, hideImgOnError };
