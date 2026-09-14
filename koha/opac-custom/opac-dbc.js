(function () {
  document.documentElement.classList.add('dbc-theme');

  function ready(fn) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn);
    else fn();
  }

  ready(function () {
    var header = document.getElementById('header-region');
    if (!header || document.getElementById('dbc-brandbar')) return;

    var brand = document.createElement('div');
    brand.id = 'dbc-brandbar';
    brand.className = 'dbc-brandbar';
    brand.innerHTML =
      '<a class="dbc-brand" href="/cgi-bin/koha/opac-main.pl">' +
      '<img src="/opac-custom/logo.png" alt="Don Bosco College Tura">' +
      '<div><h1>Don Bosco College Library</h1><p>Learn | Explore | Grow</p></div></a>' +
      '<div class="dbc-quote"><img src="/opac-custom/don-bosco.png" alt="St. John Bosco">' +
      '<div><em>&ldquo;Books are windows to a wider world.&rdquo;</em><small>&mdash; Don Bosco</small></div></div>';
    header.insertAdjacentElement('afterend', brand);

    var isHome = document.body && document.body.id === 'opac-main';
    var isAbout = document.body && document.body.id === 'opac-library';
    var navHtml =
      '<a' +
      (isHome ? ' class="is-active"' : '') +
      ' href="/cgi-bin/koha/opac-main.pl">Home</a>' +
      '<a href="/cgi-bin/koha/opac-search.pl">Search</a>' +
      '<a href="https://nlist.inflibnet.ac.in/" target="_blank" rel="noopener">E-Resources</a>' +
      '<a href="/cgi-bin/koha/opac-search.pl?sort_by=acqdate_dsc">New Arrivals</a>' +
      '<a href="https://nlist.inflibnet.ac.in/" target="_blank" rel="noopener">Journals</a>' +
      '<a href="/cgi-bin/koha/opac-tags.pl">Tag Cloud</a>' +
      '<a' +
      (isAbout ? ' class="is-active"' : '') +
      ' href="/cgi-bin/koha/opac-library.pl">About</a>' +
      '<a href="mailto:library@donboscocollege.ac.in">Contact</a>';

    if (isHome) {
      var hero = document.createElement('div');
      hero.className = 'dbc-hero';
      hero.style.backgroundImage = 'url("/opac-custom/hero.png")';
      hero.innerHTML =
        '<div class="dbc-hero-inner">' +
        '<nav class="dbc-navpills" aria-label="Library">' +
        navHtml +
        '</nav>' +
        '<p class="lead">Welcome to</p>' +
        '<h2>Don Bosco College <span>Library</span></h2>' +
        '<p class="lead">Discover. Learn. Grow.</p>' +
        '<blockquote>&ldquo;A good library will never be too neat, or too dusty, because somebody will always be in it, taking books off the shelves and staying up late reading them.&rdquo; &mdash; Lemony Snicket</blockquote>' +
        '</div>';
      brand.insertAdjacentElement('afterend', hero);

      var search = document.getElementById('opac-main-search');
      if (search) {
        var wrap = document.createElement('div');
        wrap.className = 'dbc-searchwrap';
        search.parentNode.insertBefore(wrap, search);
        wrap.appendChild(search);
      }
    } else {
      var inner = document.createElement('div');
      inner.className = 'dbc-inner-navwrap';
      inner.innerHTML =
        '<nav class="dbc-inner-nav" aria-label="Library">' +
        navHtml +
        '</nav>' +
        '<div class="dbc-inner-search"></div>';
      brand.insertAdjacentElement('afterend', inner);
      var innerSearch = document.getElementById('opac-main-search');
      if (innerSearch) inner.querySelector('.dbc-inner-search').appendChild(innerSearch);
    }

    if (isAbout && !document.getElementById('dbc-about')) {
      var aboutMain = document.querySelector('.main');
      if (aboutMain) {
        fetch('/opac-custom/blocks/about.html')
          .then(function (r) {
            return r.ok ? r.text() : Promise.reject();
          })
          .then(function (html) {
            var box = document.createElement('div');
            box.className = 'dbc-about-page';
            box.innerHTML = html;
            aboutMain.innerHTML = '';
            aboutMain.appendChild(box);
            var links = box.querySelectorAll('.dbc-about-nav a');
            function mark() {
              var id = (location.hash || '#about').slice(1);
              for (var i = 0; i < links.length; i++) {
                var href = links[i].getAttribute('href') || '';
                links[i].classList.toggle('is-active', href === '#' + id);
              }
            }
            window.addEventListener('hashchange', mark);
            mark();
          })
          .catch(function () {});
      }
    }

    var loginModal = document.getElementById('loginModal');
    if (loginModal && !document.getElementById('dbc-opac-login-brand')) {
      var header = loginModal.querySelector('.modal-header');
      var title = document.getElementById('modalLoginLabel');
      if (header && title) {
        var brand = document.createElement('div');
        brand.id = 'dbc-opac-login-brand';
        brand.innerHTML =
          '<img src="/opac-custom/logo.png" alt="Don Bosco College Tura">' +
          '<div><p>Don Bosco College Library</p></div>';
        header.insertBefore(brand, title);
        title.textContent = 'Log in to your account';
        var sub = document.createElement('p');
        sub.className = 'dbc-login-sub';
        sub.textContent = 'Renew loans, check holds, and view your reading history.';
        title.insertAdjacentElement('afterend', sub);
      }
      var body = loginModal.querySelector('.modal-body');
      if (body && !loginModal.querySelector('.dbc-login-hint')) {
        var hint = document.createElement('p');
        hint.className = 'dbc-login-hint';
        hint.textContent =
          'Use your library card number or username and the password issued at the circulation desk.';
        body.appendChild(hint);
      }
      if (!loginModal.querySelector('.dbc-login-meta')) {
        var meta = document.createElement('div');
        meta.className = 'dbc-login-meta';
        meta.innerHTML =
          '<span>Need help? Ask at the library desk</span>' +
          '<span><a href="mailto:library@donboscocollege.ac.in">library@donboscocollege.ac.in</a></span>';
        loginModal.querySelector('.modal-content').appendChild(meta);
      }
    }

    if (!document.getElementById('dbc-footer')) {
      var foot = document.createElement('div');
      foot.id = 'dbc-footer';
      foot.className = 'dbc-footer';
      foot.innerHTML =
        'Don Bosco College Library, Chandmari, Tura - 794002, Meghalaya | ' +
        '<a href="tel:+919402152496">+91 9402152496</a> | ' +
        '<a href="mailto:library@donboscocollege.ac.in">library@donboscocollege.ac.in</a><br>' +
        'Mon - Fri: 6:00 AM - 6:45 PM | Sat: 6:00 AM - 4:00 PM | Sun and Holidays: Closed';
      document.body.appendChild(foot);
    }
  });
})();
