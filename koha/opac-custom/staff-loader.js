(function () {
  if (document.getElementById('dbc-staff-js')) return;
  var css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = '/staff-custom/staff-dbc.css?v=6';
  document.head.appendChild(css);
  function loadMain() {
    if (document.getElementById('dbc-staff-js')) return;
    var s = document.createElement('script');
    s.id = 'dbc-staff-js';
    s.src = '/staff-custom/staff-dbc.js?v=4';
    document.head.appendChild(s);
  }
  var stats = document.createElement('script');
  stats.src = '/staff-custom/staff-stats.js?v=1';
  stats.onload = loadMain;
  stats.onerror = loadMain;
  document.head.appendChild(stats);
})();
