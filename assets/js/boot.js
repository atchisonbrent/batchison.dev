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

  // Stale-module watchdog. main.js sets __mainReady as its last statement; if
  // that hasn't happened shortly after load, the module graph is broken -
  // in practice a stale/mixed cached module (seen on Chrome iOS). Recovery:
  // re-fetch the graph with cache:"reload" (replaces the browser's HTTP-cache
  // entries - a plain reload would reuse them), then reload once. The
  // sessionStorage guard stops a reload loop when JS is broken for real.
  var RK = "batchison-js-recovery";
  window.addEventListener("load", function () {
    setTimeout(function () {
      if (window.__mainReady) {
        try { sessionStorage.removeItem(RK); } catch (e) {}
        return;
      }
      try {
        if (sessionStorage.getItem(RK)) return;
        sessionStorage.setItem(RK, "1");
      } catch (e) { return; }
      var entry = document.querySelector('script[type="module"]');
      if (!entry || !window.fetch) return;
      var seen = {};
      function refetch(url) {
        if (seen[url]) return Promise.resolve();
        seen[url] = true;
        return fetch(url, { cache: "reload" })
          .then(function (res) { return res.text(); })
          .then(function (src) {
            var deps = [];
            var re = /from\s+"(\.\/[\w./-]+)"/g;
            for (var m = re.exec(src); m; m = re.exec(src)) {
              deps.push(refetch(new URL(m[1], url).href));
            }
            return Promise.all(deps);
          });
      }
      refetch(entry.src).catch(function () {}).then(function () {
        window.location.reload();
      });
    }, 3000);
  });
})();
