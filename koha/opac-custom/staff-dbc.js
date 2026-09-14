(function () {
  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  function fmt(n) {
    return Number(n || 0).toLocaleString('en-IN');
  }

  function stats() {
    return (
      window.DBC_STAFF_STATS || {
        items: 0,
        patrons: 0,
        onloan: 0,
        overdue: 0,
        serials: 0,
        aq: 0,
        holds: 0,
        todayOut: 0,
        todayIn: 0,
      }
    );
  }

  function tickClock() {
    var el = document.getElementById('dbc-clock');
    if (!el) return;
    var now = new Date();
    el.innerHTML =
      '<div>' +
      now.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }) +
      '</div><b>' +
      now.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Asia/Kolkata',
      }) +
      '</b><div>Welcome back</div>';
  }

  function bannerHtml() {
    return (
      '<div style="display:flex;gap:14px;align-items:center">' +
      '<img class="crest" src="/staff-custom/logo.png" alt="Don Bosco College">' +
      '<div><h2>Don Bosco College Library</h2>' +
      '<p>Tura, Meghalaya</p>' +
      '<p class="tag">Learn | Explore | Grow</p></div></div>' +
      '<div class="quote">&ldquo;A good library service is a pillar of a good education.&rdquo;<br><small>&mdash; Don Bosco</small></div>'
    );
  }

  function statCards(rows) {
    var html = '';
    for (var i = 0; i < rows.length; i++) {
      html +=
        '<div class="dbc-stat ' +
        rows[i].cls +
        '"><div><strong>' +
        fmt(rows[i].n) +
        '</strong><em>' +
        rows[i].label +
        '</em></div></div>';
    }
    return html;
  }

  function welcomeHtml(text) {
    return (
      '<div><strong>Welcome to Don Bosco College Library staff interface</strong>' +
      '<div>' +
      text +
      '</div></div>' +
      '<div><em>Education is a matter of the heart.</em> &mdash; Don Bosco</div>'
    );
  }

  function quickPanel() {
    var wrap = document.createElement('div');
    wrap.className = 'dbc-circ-side';
    wrap.innerHTML =
      '<div class="dbc-clock" id="dbc-clock"></div>' +
      '<div class="dbc-panel"><h3>Quick actions</h3><div class="dbc-qa">' +
      '<a href="/cgi-bin/koha/circ/circulation.pl">Check out</a>' +
      '<a href="/cgi-bin/koha/circ/returns.pl">Check in</a>' +
      '<a href="/cgi-bin/koha/circ/renew.pl">Renew</a>' +
      '<a href="/cgi-bin/koha/catalogue/search.pl">Search catalog</a>' +
      '<a href="/cgi-bin/koha/circ/overdue.pl">Overdues</a>' +
      '<a href="/cgi-bin/koha/circ/view_holdsqueue.pl">Holds queue</a>' +
      '</div></div>';
    return wrap;
  }

  function enhanceLogin() {
    if (document.getElementById('dbc-login-shell')) return;
    var login = document.getElementById('login');
    if (!login) return;
    var shell = document.createElement('div');
    shell.id = 'dbc-login-shell';
    var left = document.createElement('div');
    left.className = 'dbc-login-left';
    left.innerHTML =
      '<div class="dbc-login-brand"><img src="/staff-custom/logo.png" alt="Don Bosco College Tura">' +
      '<div><h1>Don Bosco College Library</h1><p>Tura, Meghalaya</p>' +
      '<p class="values">Knowledge | Character | Service</p></div></div>' +
      '<div class="dbc-login-quote">&ldquo;Books are windows to a wider world.&rdquo;<small>&mdash; Don Bosco</small></div>' +
      '<div class="dbc-login-pills"><span>Read More</span><span>Learn Always</span><span>Grow Together</span><span>Build A Better Tomorrow</span></div>' +
      '<div class="dbc-login-wave">Your Learning Partner</div>' +
      '<div style="font-size:12px;opacity:.9;margin-top:10px">Chandmari, Tura - 794002 | +91 9402152496 | library@donboscocollege.ac.in</div>';
    var right = document.createElement('div');
    right.className = 'dbc-login-right';
    login.parentNode.insertBefore(shell, login);
    shell.appendChild(left);
    shell.appendChild(right);
    right.appendChild(login);
    var h1 = login.querySelector('h1');
    if (h1 && !document.getElementById('dbc-login-head')) {
      var head = document.createElement('div');
      head.id = 'dbc-login-head';
      head.className = 'dbc-login-head';
      head.innerHTML =
        '<h2>Welcome to<br>Don Bosco College Library</h2>' +
        '<p>Staff Login<br>Sign in to access the library management system</p>';
      h1.insertAdjacentElement('afterend', head);
    }
    if (!document.getElementById('dbc-login-help')) {
      var help = document.createElement('div');
      help.id = 'dbc-login-help';
      help.className = 'dbc-login-help';
      help.innerHTML =
        '<div>Need help?<br>Contact Administrator</div>' +
        '<div><a href="https://koha-community.org/documentation/" target="_blank" rel="noopener">Koha Documentation</a></div>' +
        '<div>System Status<br>Online</div>';
      login.appendChild(help);
      var copy = document.createElement('div');
      copy.className = 'dbc-login-copy';
      copy.textContent = 'Powered by Koha  |  Free  |  Open Source  |  For a Better Education';
      login.appendChild(copy);
    }
  }

  function enhanceHome() {
    if (document.getElementById('dbc-staff-banner')) return;
    var s = stats();
    var main = document.getElementById('container-main');
    if (!main) return;
    var col = main.querySelector('.col-md-9') || main;

    var banner = document.createElement('div');
    banner.id = 'dbc-staff-banner';
    banner.className = 'dbc-staff-banner';
    banner.innerHTML = bannerHtml();

    var stat = document.createElement('div');
    stat.className = 'dbc-stats';
    stat.innerHTML = statCards([
      { cls: 's1', n: s.items, label: 'Total items' },
      { cls: 's2', n: s.patrons, label: 'Patrons' },
      { cls: 's3', n: s.onloan, label: 'Items on loan' },
      { cls: 's4', n: s.overdue, label: 'Overdue items' },
      { cls: 's5', n: s.serials, label: 'Serials' },
      { cls: 's6', n: s.aq, label: 'Acquisitions' },
    ]);

    col.insertBefore(stat, col.firstChild);
    col.insertBefore(banner, col.firstChild);

    var welcome = document.createElement('div');
    welcome.className = 'dbc-welcome';
    welcome.innerHTML = welcomeHtml(
      'Manage your library resources efficiently and support our academic community.',
    );
    col.appendChild(welcome);

    var side = main.querySelector('.col-md-3');
    if (side) {
      side.insertBefore(quickPanel(), side.firstChild);
      tickClock();
      setInterval(tickClock, 1000);
    }
  }

  var CIRC_BLURB = {
    'Check out': 'Issue items to a patron',
    'Check in': 'Return items to the collection',
    Renew: 'Extend an existing loan',
    'Set library': 'Choose your working library',
    'Set library and desk': 'Choose library and circulation desk',
    'Set desk': 'Choose your circulation desk',
    'Fast cataloging': 'Add a title at the desk',
    'Checkout notes': 'Review notes from checkouts',
    'Pending on-site checkouts': 'Items used in the library',
    'Holds queue': 'Fill holds in priority order',
    'Holds to pull': 'Items to pick from the shelves',
    'Holds awaiting pickup': 'Held items waiting at the desk',
    'Curbside pickups': 'Manage curbside appointments',
    'Hold ratios': 'Demand versus copies on hand',
    'Bookings to collect': 'Booked items ready to collect',
    'Recalls queue': 'Active recalls to process',
    'Recalls to pull': 'Recalled items still on the shelf',
    'Overdue recalls': 'Recalled items past due',
    'Recalls awaiting pickup': 'Recalled items at the desk',
    'Old recalls': 'Inactive recall history',
    'Article requests': 'Patron article and scan requests',
    Transfer: 'Send an item to another library',
    'Transfers to send': 'Stock rotation items to dispatch',
    'Transfers to receive': 'Incoming items from other libraries',
    Overdues: 'Items past their due date',
    'Overdues with fines': 'Overdues that also have fines',
  };

  function enhanceCirculationHome() {
    if (document.getElementById('dbc-staff-banner')) return;
    var main =
      document.querySelector('body#circ_circulation-home .main') || document.querySelector('.main');
    if (!main) return;
    var col = main.querySelector('.col-lg-8') || main.querySelector('.col-md-10') || main;
    col.classList.add('dbc-circ-col');

    var s = stats();
    var banner = document.createElement('div');
    banner.id = 'dbc-staff-banner';
    banner.className = 'dbc-staff-banner';
    banner.innerHTML = bannerHtml();

    var stat = document.createElement('div');
    stat.className = 'dbc-stats dbc-stats-circ';
    stat.innerHTML = statCards([
      { cls: 's3', n: s.onloan, label: 'Items on loan' },
      { cls: 's4', n: s.overdue, label: 'Overdue items' },
      { cls: 's2', n: s.holds, label: 'Holds' },
      { cls: 's1', n: s.todayOut, label: 'Checked out today' },
      { cls: 's5', n: s.todayIn, label: 'Checked in today' },
      { cls: 's6', n: s.patrons, label: 'Patrons' },
    ]);

    var h1 = col.querySelector('h1');
    if (h1) {
      h1.textContent = 'Circulation desk';
      h1.classList.add('dbc-page-title');
    }

    col.insertBefore(stat, col.firstChild);
    col.insertBefore(banner, col.firstChild);

    var links = col.querySelectorAll('a.circ-button');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      if (a.querySelector('.dbc-circ-copy')) continue;
      var label = (a.textContent || '').replace(/\s+/g, ' ').trim();
      var icon = a.querySelector('i');
      var blurb = CIRC_BLURB[label] || 'Open this circulation tool';
      a.classList.add('dbc-circ-card');
      a.innerHTML = '';
      if (icon) a.appendChild(icon);
      var copy = document.createElement('span');
      copy.className = 'dbc-circ-copy';
      copy.innerHTML = '<strong>' + label + '</strong><em>' + blurb + '</em>';
      a.appendChild(copy);
    }

    var sections = col.querySelectorAll('h3');
    for (var j = 0; j < sections.length; j++) {
      sections[j].classList.add('dbc-section-title');
    }

    var layout = document.createElement('div');
    layout.className = 'dbc-circ-layout';
    var tools = document.createElement('div');
    tools.className = 'dbc-circ-tools';
    var firstRow = col.querySelector('.row');
    if (firstRow && firstRow.id !== 'intranet-circulation-home-html') {
      firstRow.parentNode.insertBefore(layout, firstRow);
      tools.appendChild(firstRow);
      layout.appendChild(tools);
      var side = quickPanel();
      layout.appendChild(side);
      tickClock();
      setInterval(tickClock, 1000);
    }

    var extraHtml = document.getElementById('intranet-circulation-home-html');
    if (extraHtml && !extraHtml.textContent.trim()) extraHtml.style.display = 'none';

    var welcome = document.createElement('div');
    welcome.className = 'dbc-welcome';
    welcome.innerHTML = welcomeHtml(
      'Issue, return, renew, and manage holds from one circulation desk.',
    );
    col.appendChild(welcome);
  }

  ready(function () {
    if (document.body && document.body.id === 'main_auth') {
      enhanceLogin();
      return;
    }

    if (!document.getElementById('dbc-staff-footer')) {
      var foot = document.createElement('div');
      foot.id = 'dbc-staff-footer';
      foot.className = 'dbc-staff-footer';
      foot.innerHTML =
        'Don Bosco College Library, Chandmari, Tura - 794002 | ' +
        '<a href="tel:+919402152496">+91 9402152496</a> | ' +
        '<a href="mailto:library@donboscocollege.ac.in">library@donboscocollege.ac.in</a> | ' +
        'Mon - Fri: 6:00 AM - 6:45 PM | Sat: 6:00 AM - 4:00 PM | Sun and Holidays: Closed | Koha 24.11';
      document.body.appendChild(foot);
    }

    if (document.body.id === 'main_intranet-main') enhanceHome();
    if (document.body.id === 'circ_circulation-home') enhanceCirculationHome();
  });
})();
