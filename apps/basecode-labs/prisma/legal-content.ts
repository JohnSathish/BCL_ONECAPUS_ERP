/** Published company policy copy for BaseCode Labs. Not a substitute for a signed contract or legal review. */

export const LEGAL_REVIEW_NOTE =
  'This page is published as BaseCode Labs company policy information. It should be reviewed by a qualified legal professional before being treated as final legal terms. If a signed quotation, license or service agreement says something different, that signed document prevails.';

const CONTACT = `
<h2 id="contact">Questions about this policy?</h2>
<p>BaseCode Labs Pvt. Ltd.<br />
Your Technology Growth Partner</p>
<p>Email: <a href="mailto:contact@basecodelabs.com">contact@basecodelabs.com</a><br />
Website: <a href="https://basecodelabs.com">https://basecodelabs.com</a><br />
Phone: +91 95663 63655</p>
<p>Please use the subject line “<strong>[Policy name] — Policy Enquiry</strong>” so we can route your message.</p>
<p>We publish <code>contact@basecodelabs.com</code> as the working privacy, support and policy mailbox. Do not use an unpublished legal@ address.</p>
`;

export type LegalSeed = {
  slug: string;
  title: string;
  shortDescription: string;
  icon: string;
  displayOrder: number;
  changeSummary: string;
  contentHtml: string;
};

export const LEGAL_SEEDS: LegalSeed[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    shortDescription:
      'How we collect, use, share and retain information on our website, CRM, ERP and apps.',
    icon: 'Shield',
    displayOrder: 1,
    changeSummary:
      'Initial website publication, incorporating the BCL OneCampus ERP privacy notice dated 10 July 2026.',
    contentHtml: `
<p class="meta"><strong>Product coverage:</strong> BaseCode Labs website, BaseCode Central, BCL OneCampus ERP and related mobile apps.<br />
<strong>Effective:</strong> 18 September 2026<br />
<strong>OneCampus notice dated:</strong> 10 July 2026</p>
<h2 id="introduction">Introduction</h2>
<p>BaseCode Labs Pvt. Ltd. (“BaseCode Labs”, “we”, “us”) operates public websites, an operations hub (BaseCode Central), licensed software including BCL OneCampus ERP, mobile applications, hosting and support. This notice explains how we handle personal and institutional information.</p>
<p>By using our website or products you acknowledge this notice. It is informational and does not constitute legal advice.</p>
<h2 id="collect">Information we collect</h2>
<p>Depending on how you interact with us, we may process:</p>
<ul>
<li>Name, email, phone number and organisation or institution</li>
<li>Enquiry messages, preferred contact method, budget notes and file names you attach</li>
<li>Account, login and role information for BaseCode Central, client portals and licensed products</li>
<li>Device type, browser, app version, IP address and technical logs</li>
<li>Cookies and similar storage as described in the Cookie Policy</li>
<li>Payment or billing references where a payment gateway is used (we do not store full card numbers, UPI PINs or banking passwords)</li>
</ul>
<p>For ERP and institutional mobile apps, the exact records collected (students, parents, staff, attendance, fees, examinations, library, HR and similar) depend on the institution and the modules it enables. The institution is the primary controller of those records. BaseCode Labs acts as a technology provider / processor except for limited account, billing, support or product-operations data we handle as an independent controller.</p>
<h2 id="use">How we use information</h2>
<ul>
<li>Provide websites, software, hosting and support</li>
<li>Create and administer accounts and licenses</li>
<li>Process enquiries and CRM leads</li>
<li>Process payments through third-party gateways where configured</li>
<li>Send service notifications (email, SMS or push where enabled)</li>
<li>Improve reliability and security, prevent abuse, keep audit logs</li>
<li>Comply with law and enforce written agreements</li>
</ul>
<p><strong>BaseCode Labs does not sell personal information.</strong></p>
<h2 id="sharing">Data sharing</h2>
<p>We may share information with hosting and cloud providers; email, SMS or push delivery providers; payment processors selected for an institution; analytics tools only when configured; and other processors needed to run the service. We may also share with the institution that administers an ERP account, or when required by law. We do not claim that data never leaves our servers.</p>
<h2 id="retention">Data retention</h2>
<p>Information may be kept while accounts or contracts are active, for accounting and tax records, security and backup copies, dispute resolution and legal requirements. Institutional academic and fee records follow the institution’s retention rules and the service agreement.</p>
<h2 id="rights">Your rights</h2>
<p>Subject to applicable law and institutional policy, you may request access, correction, deletion where allowed, or ask questions about processing. Website enquiry deletion or correction requests: email contact@basecodelabs.com. Student, parent or staff records in OneCampus should go first to the institution’s administrator; we will reasonably assist the institution.</p>
<h2 id="erp">Institutional ERP data</h2>
<p>Schools and colleges control institutional records. BaseCode Labs provides and operates the platform under the service agreement. Students, parents and staff use the institution’s tenant. See also Institutional Data &amp; ERP Privacy.</p>
${CONTACT}
`,
  },
  {
    slug: 'terms',
    title: 'Terms & Conditions',
    shortDescription: 'Website and general service terms. Signed contracts prevail for paid work.',
    icon: 'ScrollText',
    displayOrder: 2,
    changeSummary: 'Initial publication of website and general service terms.',
    contentHtml: `
<h2 id="acceptance">Acceptance of terms</h2>
<p>Using the BaseCode Labs website, submitting an enquiry, or using our services constitutes acceptance of these terms, together with the Privacy Policy and any signed quotation, license or service agreement. Signed commercial documents prevail if they conflict with this page.</p>
<h2 id="services">Services</h2>
<p>We provide website development, web applications, ERP and SaaS (including BCL OneCampus ERP), mobile applications, hosting, maintenance, technical support, custom software, APIs and integrations, and related digital services, as described in the relevant proposal or contract.</p>
<h2 id="client">Client responsibilities</h2>
<ul>
<li>Provide accurate information and required content, logos and approvals</li>
<li>Keep account credentials confidential and limit access to authorised people</li>
<li>Pay invoices according to the quotation or contract</li>
<li>Use software and hosting lawfully</li>
</ul>
<h2 id="prohibited">Prohibited activities</h2>
<p>You must not attempt unauthorised access; reverse engineer software where prohibited; attack infrastructure; upload malware; abuse APIs; circumvent licensing; share unauthorised credentials; or use services for unlawful activity. See also the Acceptable Use Policy.</p>
<h2 id="availability">Service availability</h2>
<p>Availability may be affected by scheduled or emergency maintenance, third-party infrastructure, internet failures, force majeure, security incidents, or client-side configuration. Specific uptime commitments, if any, appear only in a signed service agreement — this website does not invent SLA percentages.</p>
${CONTACT}
`,
  },
  {
    slug: 'software-license',
    title: 'Software License Agreement',
    shortDescription:
      'How BCL OneCampus ERP and other BaseCode Labs software is licensed, activated and suspended.',
    icon: 'KeyRound',
    displayOrder: 3,
    changeSummary: 'Initial software license policy for licensed products including OneCampus.',
    contentHtml: `
<h2 id="ownership">License ownership</h2>
<p>Unless a signed contract expressly transfers ownership of specific deliverables, BaseCode Labs software is <strong>licensed, not sold</strong>. We retain intellectual property in the product, frameworks and tools. Your rights are those granted in the license record, quotation and this policy.</p>
<h2 id="scope">License scope</h2>
<p>A license typically defines the institution, permitted campuses, user or student bands, enabled modules, subscription period, permitted devices or activation limits, and deployment environment (for example, the institution code used at activation). The live license record in BaseCode Central is the operational source of those limits.</p>
<h2 id="restrictions">Restrictions</h2>
<p>You may not copy, resell or redistribute the software; share license keys outside the licensed institution; reverse engineer where prohibited; circumvent subscription or activation limits; or modify the product except as the contract allows.</p>
<h2 id="activation">License activation</h2>
<p>Activation may require a license key, institution identifier, valid subscription period and remaining activation capacity. Heartbeats, status checks and device or session limits may apply as configured for that product. Renewal extends the period recorded on the license.</p>
<h2 id="suspension">Suspension and deactivation</h2>
<p>We may suspend or deactivate a license for expiry, non-payment, security abuse, unauthorised redistribution, or other contract violation, as well as at the client’s request through supported workflows.</p>
${CONTACT}
`,
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    shortDescription: 'Subscriptions, custom work, websites, hosting and third-party charges.',
    icon: 'Receipt',
    displayOrder: 4,
    changeSummary: 'Initial refund and cancellation policy distinguishing product types.',
    contentHtml: `
<h2 id="software">Software subscriptions</h2>
<p>ERP and SaaS fees follow the quotation and license period. Cancellation stops renewal at the end of the paid term unless the signed agreement says otherwise. Refunds for unused subscription time are not automatic; they are processed only as written in that agreement.</p>
<h2 id="custom">Custom development</h2>
<p>Project payments are commonly structured as advance, milestone and final amounts. If a client cancels after work has started, amounts covering completed discovery, design or development remain payable. Unused prepaid third-party costs may be handled case by case.</p>
<h2 id="websites">Website development</h2>
<p>Design approval, development commencement, hosting setup and domain registration are distinct steps. Work already approved or commenced is billable. Domain and hosting fees paid to registries or hosts follow those providers’ rules.</p>
<h2 id="hosting">Hosting</h2>
<p>Hosting is typically prepaid per term. Cancellation should be requested before the renewal date stated on the invoice or BaseCode Central record. After renewal, host and registrar charges are usually non-refundable.</p>
<h2 id="third">Third-party charges</h2>
<p>Domain registration, premium plugins, cloud usage, SMS, payment-gateway fees, app-store fees and similar charges are subject to the respective provider’s policies. BaseCode Labs cannot override those providers’ refund rules.</p>
${CONTACT}
`,
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie Policy',
    shortDescription:
      'Cookies actually used on this website, with settings for essential, functional and analytics.',
    icon: 'Cookie',
    displayOrder: 5,
    changeSummary: 'Describes visitor, session and optional Google Analytics cookies only.',
    contentHtml: `
<h2 id="essential">Essential cookies</h2>
<p><strong>Always active.</strong> After admin or client login we set an httpOnly session cookie so you stay signed in securely. These cookies are required for the service to work.</p>
<h2 id="functional">Functional cookies</h2>
<p>We may set a first-party visitor identifier (<code>bcl_vid</code>) so unique visitor counts on this website are not double-counted. Cookie preference (<code>bcl_cc</code>) remembers your banner choice. You can switch functional cookies off in Cookie Settings; unique-visitor counting will then be limited.</p>
<h2 id="analytics">Analytics cookies</h2>
<p>Google Analytics cookies load <strong>only</strong> if this deployment has <code>NEXT_PUBLIC_GA_ID</code> configured <strong>and</strong> you accept analytics in Cookie Settings. If analytics is not configured, we do not claim to use Google Analytics.</p>
<h2 id="marketing">Marketing cookies</h2>
<p>This website does not use advertising or marketing pixels. There is no marketing cookie category to enable.</p>
<h2 id="settings">Cookie Settings</h2>
<p>Use the cookie banner or the controls on this page to choose Essential (always on), Functional, and Analytics (when available). Withdrawing functional or analytics consent does not affect login cookies needed for BaseCode Central.</p>
${CONTACT}
`,
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    shortDescription: 'Prohibited uses of our websites, APIs, hosting and licensed software.',
    icon: 'Ban',
    displayOrder: 6,
    changeSummary: 'Initial acceptable use and abuse-reporting policy.',
    contentHtml: `
<h2 id="prohibited">Prohibited use</h2>
<p>You must not use BaseCode Labs websites, APIs, hosting or licensed software for hacking, credential theft, malware, spam, phishing, API abuse, DDoS or unauthorised scanning, illegal content, copyright infringement, fraud, or circumvention of security or license controls.</p>
<h2 id="report">Report abuse</h2>
<p>Email <a href="mailto:contact@basecodelabs.com?subject=Report%20Abuse">contact@basecodelabs.com</a> with the subject “Report Abuse”, including URLs, timestamps and any evidence you can share. We may suspend licenses or access while we investigate.</p>
${CONTACT}
`,
  },
  {
    slug: 'data-security',
    title: 'Data Processing & Security Policy',
    shortDescription: 'How we protect information — without promising absolute security.',
    icon: 'Lock',
    displayOrder: 7,
    changeSummary: 'Initial security policy limited to controls we actually operate.',
    contentHtml: `
<h2 id="controls">Technical controls</h2>
<p>Where implemented on a given product or site, we use HTTPS/TLS, password hashing (not plain-text passwords), role-based access, authentication and session cookies, access or audit logging, database access controls, backups, host firewalling, authenticated APIs, and operational monitoring. Not every control is present on every legacy client deployment.</p>
<h2 id="erp">ERP data</h2>
<p>Institution-managed information may include student, parent and staff records, attendance, fees, examinations, library and HR data. The institution decides what is entered and who may see it. BaseCode Labs provides the platform and related hosting/support under contract. We do not replace the institution’s duties as an educational data steward.</p>
<h2 id="limits">Limits</h2>
<p>No method of transmission or storage is completely secure. We do not promise absolute security. Institutions and users must protect credentials, devices and access rights under their control.</p>
${CONTACT}
`,
  },
  {
    slug: 'service-level',
    title: 'Service Level & Support Policy',
    shortDescription:
      'Support channels and issue categories. Numeric SLAs exist only in signed agreements.',
    icon: 'Headset',
    displayOrder: 8,
    changeSummary: 'Support policy without unpublished uptime or response-time guarantees.',
    contentHtml: `
<h2 id="channels">Support channels</h2>
<p>Public and project support: <a href="mailto:contact@basecodelabs.com">contact@basecodelabs.com</a>, phone +91 95663 63655 / +91 87784 63459, and WhatsApp via the published company number. Licensed clients may also use BaseCode Central or the channels named in their contract. This website does not invent a separate unpublished support portal URL.</p>
<h2 id="categories">Issue categories</h2>
<ul>
<li><strong>Critical</strong> — system unavailable or major operational failure</li>
<li><strong>High</strong> — major functionality affected</li>
<li><strong>Normal</strong> — a feature or operational problem</li>
<li><strong>Low</strong> — general question or enhancement request</li>
</ul>
<p>For public website enquiries we typically aim to respond within 24 hours on working days. ERP and hosting response targets, if any, are those written in the signed service agreement. This page does not publish invented minute-based SLAs.</p>
<h2 id="maintenance">Maintenance</h2>
<p>Scheduled maintenance, emergency maintenance, security updates and software updates may affect availability. We will give reasonable notice for planned work when the contract requires it.</p>
${CONTACT}
`,
  },
  {
    slug: 'website-usage',
    title: 'Website Usage Policy',
    shortDescription: 'How you may use basecodelabs.com and related public pages.',
    icon: 'Globe',
    displayOrder: 9,
    changeSummary: 'Initial public website usage policy.',
    contentHtml: `
<h2 id="content">Website content</h2>
<p>Content is provided so visitors can learn about BaseCode Labs and contact us. It is not legal, academic or financial advice.</p>
<h2 id="browsing">Acceptable browsing</h2>
<p>Use the site lawfully. Do not scrape in a way that degrades service, attempt to break authentication, or submit false enquiries.</p>
<h2 id="copyright">Copyright</h2>
<p>Page copy, branding and original graphics belong to BaseCode Labs or their respective owners. Client names and testimonials appear with permission as published on our site.</p>
<h2 id="accuracy">Accuracy and availability</h2>
<p>We try to keep information current. Pages may be unavailable during maintenance or hosting incidents. External links are not under our control.</p>
<h2 id="submitted">User-submitted information</h2>
<p>Enquiries, newsletter sign-ups and file names you attach become CRM records as described in the Privacy Policy.</p>
${CONTACT}
`,
  },
  {
    slug: 'intellectual-property',
    title: 'Intellectual Property Policy',
    shortDescription: 'BaseCode Labs IP, client materials, and custom work under contract.',
    icon: 'Copyright',
    displayOrder: 10,
    changeSummary: 'Initial IP policy; custom-code ownership follows the signed agreement.',
    contentHtml: `
<h2 id="bcl">BaseCode Labs IP</h2>
<p>Unless a contract assigns them, we retain rights in source code, frameworks, UI components, software architecture, product names, logos, templates, documentation and proprietary tools — including BCL OneCampus ERP.</p>
<h2 id="client">Client IP</h2>
<p>Clients retain rights in content they supply: logos, photographs, documents and institutional data. We use those materials only to deliver the engagement.</p>
<h2 id="custom">Custom development</h2>
<p>Ownership or license of custom source code follows the <strong>signed project agreement</strong> for that work. This website does not make a universal claim that all custom code always belongs to the client or always belongs to BaseCode Labs.</p>
${CONTACT}
`,
  },
  {
    slug: 'mobile-app-terms',
    title: 'Mobile App Terms',
    shortDescription: 'Institutional and product apps, notifications, devices and accounts.',
    icon: 'Smartphone',
    displayOrder: 11,
    changeSummary: 'Initial mobile application terms.',
    contentHtml: `
<h2 id="accounts">Accounts and authentication</h2>
<p>App accounts are usually created by the institution or by BaseCode Labs under a license. Authentication may use passwords, OTP, email or mobile verification, or biometric unlock on the device where the OS supports it.</p>
<h2 id="devices">Devices and sessions</h2>
<p>Apps may register a device for push notifications and session control. License or security policy may limit concurrent devices. You should log out on shared or lost devices and tell your institution if a device is stolen.</p>
<h2 id="permissions">Permissions and notifications</h2>
<p>Camera, storage, photos and notifications are requested only for features the institution enables. You may refuse optional permissions; some features will then be unavailable. Information shown in an institutional app is provided and managed by the institution.</p>
<h2 id="updates">Updates</h2>
<p>Store updates may be required for security. Older app versions may stop working when the institution upgrades the backend.</p>
${CONTACT}
`,
  },
  {
    slug: 'saas-policy',
    title: 'Subscription & SaaS Policy',
    shortDescription:
      'Subscription periods, limits, export and termination for licensed SaaS such as OneCampus.',
    icon: 'Cloud',
    displayOrder: 12,
    changeSummary: 'Initial SaaS and subscription policy.',
    contentHtml: `
<h2 id="period">Subscription period and renewal</h2>
<p>Licenses run for the period on the license record (commonly annual). Renewal extends that period after payment. User, storage and module limits are those sold and recorded for the tenant.</p>
<h2 id="activation">Activation and suspension</h2>
<p>See the Software License Agreement for keys, institution IDs and suspension for expiry, non-payment or abuse.</p>
<h2 id="export">Data export, backup and migration</h2>
<p>During an active subscription, institutions may export data through supported product features or by requesting assistance. Backups are operational copies, not a substitute for the institution’s own records policy. After termination, handling of export, archive or deletion follows the service agreement and reasonable technical timelines.</p>
${CONTACT}
`,
  },
  {
    slug: 'payment-policy',
    title: 'Payment & Billing Policy',
    shortDescription: 'Invoices, taxes, failed payments and third-party payment providers.',
    icon: 'CreditCard',
    displayOrder: 13,
    changeSummary: 'Initial payment and billing policy.',
    contentHtml: `
<h2 id="invoices">Invoices and due dates</h2>
<p>Invoices are issued as stated in the quotation or BaseCode Central. Payment is due by the date on the invoice unless the contract sets different terms.</p>
<h2 id="tax">Taxes</h2>
<p>Indian GST or other taxes are added where applicable under law and the invoice. We do not publish a tax opinion on this page.</p>
<h2 id="failed">Failed or late payments</h2>
<p>Failed gateway charges or overdue invoices may delay activation, renewal or support. Late-payment consequences, if any, are those in the signed agreement.</p>
<h2 id="gateways">Third-party payment providers</h2>
<p>Online fee collection inside OneCampus is processed by gateways the institution configures (for example Razorpay or other supported providers). Card and UPI credentials are handled by that provider. Refunds of gateway charges follow the provider and the institution’s fee rules.</p>
${CONTACT}
`,
  },
  {
    slug: 'account-security',
    title: 'Account & Security Policy',
    shortDescription: 'Passwords, OTP login, sessions and how to report a security issue.',
    icon: 'UserRoundCog',
    displayOrder: 14,
    changeSummary: 'Initial account security policy reflecting email OTP on this platform.',
    contentHtml: `
<h2 id="passwords">Passwords and OTP</h2>
<p>BaseCode Central and the client portal on this website sign in with <strong>email one-time codes</strong>, not reusable passwords. Other products may use passwords. Where passwords exist, use a unique password, change it if it may be compromised, and expect lockout after repeated failures as configured for that product. Password reset uses the product’s supported flow.</p>
<h2 id="sessions">Sessions</h2>
<p>Admins and clients receive a session cookie after OTP verification. You should sign out on shared computers. Product-specific session lists, revoke-device and logout-other-device tools exist where that product implements them (for example school or ERP apps). This public website’s portal shows license and service summaries; it does not invent a device-control console that is not built here.</p>
<h2 id="report">Report a security issue</h2>
<p>Email <a href="mailto:contact@basecodelabs.com?subject=Report%20a%20Security%20Issue">contact@basecodelabs.com</a> with the subject “Report a Security Issue”. Include product name, time and a description. Do not send exploit details to public inboxes if you need a coordinated disclosure — ask us for a secure channel in the first message.</p>
${CONTACT}
`,
  },
  {
    slug: 'third-party-services',
    title: 'Third-Party Services Policy',
    shortDescription: 'Processors we actually use or that institutions may enable in our products.',
    icon: 'Blocks',
    displayOrder: 15,
    changeSummary:
      'Lists hosting, email, optional Analytics, WhatsApp links, and ERP payment gateways.',
    contentHtml: `
<p>BaseCode Labs uses third parties to operate. This list is limited to services we actually use on this website or that institutions commonly enable in our products. It is not an exhaustive list of every possible future vendor.</p>
<table>
<thead><tr><th>Service</th><th>Purpose</th><th>Policy</th></tr></thead>
<tbody>
<tr><td>Infrastructure hosting for this website</td><td>Serve basecodelabs.com / this application</td><td>The host’s standard terms</td></tr>
<tr><td>Email transport (SMTP / Nodemailer)</td><td>OTP login codes and operational mail</td><td>The configured mail provider’s privacy policy</td></tr>
<tr><td>WhatsApp (wa.me link)</td><td>Optional chat with the published company number</td><td><a href="https://www.whatsapp.com/legal/privacy-policy">WhatsApp Privacy Policy</a></td></tr>
<tr><td>Google Analytics</td><td>Optional usage measurement, only if a GA ID is configured and you consent</td><td><a href="https://policies.google.com/privacy">Google Privacy Policy</a></td></tr>
<tr><td>Payment gateways (e.g. Razorpay and other supported providers)</td><td>Institution fee collection inside OneCampus when the institution enables them</td><td>The gateway’s own privacy policy and terms</td></tr>
<tr><td>App stores (Google Play / Apple)</td><td>Distribution of mobile apps</td><td>Google Play and Apple privacy terms</td></tr>
</tbody>
</table>
<p>We do not list Firebase, CDNs or SMS aggregators on this page unless this deployment is actually wired to them. Institutions may add their own SMS or payment vendors; those vendors are the institution’s processors.</p>
${CONTACT}
`,
  },
  {
    slug: 'disclaimer',
    title: 'Disclaimer',
    shortDescription: 'Limits of website information, software output and third-party content.',
    icon: 'Info',
    displayOrder: 16,
    changeSummary: 'Initial website and product disclaimer; contracts are not overridden.',
    contentHtml: `
<h2 id="general">General website information</h2>
<p>Public pages describe our company and products in good faith. They are not a warranty, academic opinion or substitute for a signed contract.</p>
<h2 id="output">Software output and institution data</h2>
<p>Reports, AI assistant text (where enabled) and dashboards depend on data entered by the institution. Outputs can be incomplete. Authorised people must verify academic, fee and HR decisions. Institution-managed data is the institution’s responsibility.</p>
<h2 id="availability">Availability</h2>
<p>We do not guarantee uninterrupted service on this website or in hosted products, except where a signed agreement states a specific commitment.</p>
<h2 id="links">External links</h2>
<p>Third-party sites, payment pages and app stores have their own terms. Linking is not an endorsement.</p>
<p>Nothing on this page reduces rights or duties written in a signed BaseCode Labs agreement.</p>
${CONTACT}
`,
  },
  {
    slug: 'institutional-data',
    title: 'Institutional Data & ERP Privacy',
    shortDescription:
      'How schools, BaseCode Labs, and students or staff share responsibility for ERP records.',
    icon: 'Building2',
    displayOrder: 17,
    changeSummary: 'Initial ERP roles notice complementing the Privacy Policy.',
    contentHtml: `
<h2 id="roles">Who does what</h2>
<ul>
<li><strong>School / college</strong> — controls institutional records and user access in its tenant</li>
<li><strong>BaseCode Labs</strong> — provides and operates the technology platform under the service agreement</li>
<li><strong>Students, parents and staff</strong> — use the institution’s platform with the permissions the institution grants</li>
</ul>
<h2 id="records">Typical record types</h2>
<p>Student and parent data, staff and HR data, attendance, fees, examination results, library and internal communications may all live in the tenant if those modules are enabled. Exact legal duties follow the institution’s contract and applicable law. This page does not replace that contract.</p>
${CONTACT}
`,
  },
];
