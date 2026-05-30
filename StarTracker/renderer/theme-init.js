(function () {
  var key = "sc-debrief-theme";
  var stored = localStorage.getItem(key);
  var theme = stored === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
})();
