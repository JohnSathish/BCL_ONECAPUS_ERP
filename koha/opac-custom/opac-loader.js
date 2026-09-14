(function () {
  if (document.getElementById('dbc-opac-js')) return;
  var css = document.createElement('link');
  css.id = 'dbc-opac-css';
  css.rel = 'stylesheet';
  css.href = '/opac-custom/opac-dbc.css?v=7';
  document.head.appendChild(css);
  var s = document.createElement('script');
  s.id = 'dbc-opac-js';
  s.src = '/opac-custom/opac-dbc.js?v=6';
  document.head.appendChild(s);
})();
