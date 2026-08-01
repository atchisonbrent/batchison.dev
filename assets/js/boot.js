// Pre-paint boot: theme + scroll restore. Loaded as a BLOCKING script in
// <head> on purpose - it must set data-theme before first paint or dark-mode
// visitors get a light flash. Keep it tiny; everything else belongs in the
// deferred module graph under main.js.
(function () {
  var saved;
  try { saved = localStorage.getItem("batchison-theme"); } catch (e) {}
  var theme = saved || (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.classList.add("js-reveal");

  try { history.scrollRestoration = "auto"; } catch (e) {}
  var SK = "batchison-scroll";
  window.addEventListener("pagehide", function () {
    try { sessionStorage.setItem(SK, String(window.scrollY)); } catch (e) {}
  });
  window.addEventListener("DOMContentLoaded", function () {
    try {
      var y = parseInt(sessionStorage.getItem(SK), 10);
      if (y > 0) window.scrollTo(0, y);
    } catch (e) {}
  });
})();
