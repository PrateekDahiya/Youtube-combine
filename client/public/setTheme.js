(function () {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
        document.body.classList.add(storedTheme);
    } else {
        document.body.classList.add("light");
    }
    document.body.classList.remove("hidden");
})();
