/**
 * Canonical Transient author guidelines (replaces Google Sites / Google Form copy).
 * Used by seed/ensure scripts and default CMS page bodies.
 */

export const TRANSIENT_AUTHOR_GUIDELINES_HTML = `
<h2>Guidelines for Authors</h2>
<p><strong>TRANSIENT</strong> is a peer-reviewed journal of natural sciences and allied subjects published by Don Bosco College, Tura (ISSN 2250-0650).</p>
<p>
  Manuscripts must be prepared following the journal template and submitted
  <strong>online through this journal portal</strong>
  (Author Desk → New submission). Google Forms and Google Sites submission links are no longer used.
</p>
<p>
  <a href="/journals-portal/author/submissions/new">Start a new submission →</a>
  &nbsp;·&nbsp;
  <a href="/journals-portal/downloads">Downloads / templates</a>
</p>

<h3>Article categories</h3>
<p>Select one category when submitting:</p>
<ul>
  <li><strong>Strategy papers</strong></li>
  <li><strong>Review articles</strong> — science-related topics with critical analysis; preferably within about 15 pages including tables and figures</li>
  <li><strong>Research papers</strong> — original research; preferably within about 10 pages including diagrams, figures and tables</li>
  <li><strong>Short communications</strong> — preferably within about 5 pages including tables and figures</li>
  <li><strong>Maiden reports</strong></li>
</ul>
<p><em>Note:</em> Page limits are suggestive rather than absolute; clarity and completeness take priority.</p>

<h3>Manuscript structure</h3>
<ul>
  <li><strong>Title</strong> — running sentence case; capitalise only important words</li>
  <li><strong>Authors</strong> — full names with affiliations (department, institute, address, country)</li>
  <li><strong>Corresponding author</strong> — one corresponding email address</li>
  <li><strong>Abstract</strong> — 120–250 words; a single paragraph is preferred</li>
  <li><strong>Keywords</strong> — minimum 3 and maximum 5</li>
  <li><strong>Body</strong> — Introduction; Methodology (with sub-sections as needed); Results and Conclusion</li>
  <li><strong>Tables</strong> — caption <em>before</em> the table; number and cite as Table 1, Table 2, … Provide table data separately as an Excel file when possible</li>
  <li><strong>Figures</strong> — caption <em>after</em> the figure; number and cite as Figure 1, Figure 2, … Prefer vector images; raster images at least 300 dpi</li>
  <li><strong>Acknowledgement</strong> — grants or contributors who are not listed as authors</li>
  <li><strong>References</strong> — see referencing pattern below</li>
</ul>

<h3>General instructions</h3>
<ol>
  <li>Scientific names and local/vernacular names must be italicised.</li>
  <li>Tables and graphs must be properly numbered and referenced in the text. Provide tables and figures as separate files where possible. All measurements must use metric units.</li>
  <li>
    <strong>Manuscript submission:</strong> Submit through the Transient Author Desk on this portal
    (<a href="/journals-portal/login">sign in or register</a>, then
    <a href="/journals-portal/author/submissions/new">New submission</a>).
    Upload the manuscript PDF (and supporting files). Do <strong>not</strong> use the former Google Form links.
  </li>
  <li>
    <strong>Review process:</strong> Manuscripts undergo preliminary editorial screening followed by peer review.
    Authors are normally given <strong>14 days</strong> to return a revised manuscript after reviewer comments.
  </li>
  <li>
    <strong>Final acceptance:</strong> The editorial team makes the final decision based on reviewer input.
    Minor grammatical and stylistic changes may be made during proofreading.
  </li>
  <li>
    <strong>Copyright:</strong> The publisher reserves copyright to published papers as stated in the journal policy.
  </li>
</ol>

<h3>Reference writing pattern</h3>
<p>The standard reference style for Transient is <strong>APA</strong>. IEEE style may be accepted where appropriate to the discipline. Include a DOI (or ISBN for books) wherever available. Avoid non-standard references (unpublished work, generic websites, etc.) unless essential.</p>

<h3>Disclaimer</h3>
<p>
  The information, facts and opinions presented in the Journal reflect the views of the author(s) and not of
  Transient or its Editorial Board or the Publisher. Transient is not responsible for the content or liable for any
  untoward consequences arising from the use of information contained therein. Publication of articles does not
  constitute endorsement or approval by the Journal and/or its Publisher.
</p>
`.trim();

export const TRANSIENT_PEER_REVIEW_HTML = `
<h2>Peer review policy</h2>
<p>All submissions to Transient undergo preliminary editorial screening followed by expert peer review.</p>
<ul>
  <li>Editors may decline manuscripts that are out of scope or not prepared to journal standards before review.</li>
  <li>Peer reviewers evaluate originality, methodology, clarity, and contribution to the field.</li>
  <li>Authors are normally given <strong>14 days</strong> to submit a revised manuscript after receiving reviewer comments.</li>
  <li>Final acceptance is decided by the editorial team. Minor grammatical and stylistic edits may be applied at proof stage.</li>
</ul>
<p>
  To submit a manuscript, use the
  <a href="/journals-portal/author/submissions/new">Author Desk</a>
  on this portal. Google Form submission is discontinued.
</p>
`.trim();
