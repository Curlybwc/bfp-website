// BFP public website — disclosure controls (Jen, 2026-11-26): the
// rental requirements stand behind one expandable button instead of
// listed out. A button carrying data-disclosure-btn toggles the panel
// named by its aria-controls; collapsed by default. Without JS the
// panels are shown (see the noscript style in the base layout), so the
// requirements are never trapped behind a script.
(function () {
  document.querySelectorAll("[data-disclosure-btn]").forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute("aria-controls"));
    if (!panel) return;
    btn.addEventListener("click", function () {
      var open = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", open ? "false" : "true");
      panel.hidden = open;
    });
  });
})();
