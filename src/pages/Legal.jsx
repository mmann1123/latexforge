import { useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';

export default function Legal() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.scrollTo(0, 0);
    }
  }, [hash]);

  return (
    <div className="legal-page">
      <div className="legal-container">
        <Link to="/login" className="legal-back">&larr; Back to home</Link>

        <h1>LaTeX Forge Legal</h1>
        <p className="legal-updated">Last updated: April 6, 2026</p>

        <nav className="legal-nav">
          <a href="#terms">Terms of Service</a>
          <a href="#privacy">Privacy Policy</a>
          <a href="#cookies">Cookie Policy</a>
          <a href="#security">Security</a>
          <a href="#use">Acceptable Use</a>
        </nav>

        {/* ── Terms of Service ── */}
        <section id="terms">
          <h2>Terms of Service</h2>

          <h3>1. Service Description</h3>
          <p>
            LaTeX Forge is a free, web-based collaborative LaTeX editor currently in beta.
            It is provided as an open-source project under the GNU General Public License v3
            and is intended for academic and nonprofit use. The service allows users to create,
            edit, compile, and share LaTeX documents through a web browser.
          </p>

          <h3>2. Beta Service</h3>
          <p>
            LaTeX Forge is currently offered as a beta service. Beta features are provided
            "as-is" and may be changed, suspended, or removed at any time without notice.
            Beta services may contain bugs, errors, or inaccuracies. By using the beta service,
            you acknowledge that it may not function as intended in all cases.
          </p>

          <h3>3. Account Eligibility</h3>
          <p>
            Access is limited to users with Google-authenticated institutional email accounts,
            including .edu, .ac.uk, .ca, .org, and other recognized academic domains. Additional
            accounts may be granted access at the administrator's discretion. You must provide
            accurate and complete information during registration and keep your account
            information current.
          </p>

          <h3>4. User Content</h3>
          <p>
            You retain full ownership of all content you create, upload, or store on LaTeX Forge.
            We do not claim any intellectual property rights over your documents, images, or other
            files. By uploading content, you grant LaTeX Forge a limited license to store, process,
            and transmit your content solely to provide the service (e.g., storing files in Cloud
            Storage, sending files to the compilation server).
          </p>
          <p>
            You are responsible for ensuring you have the right to upload and share any content
            you add to the platform, including third-party files, fonts, images, and bibliographic
            data. If you share a project with collaborators, you control who has access and at
            what permission level (editor or viewer).
          </p>

          <h3>5. Backup Responsibility</h3>
          <p>
            While LaTeX Forge uses Google Cloud infrastructure with built-in redundancy, you are
            responsible for maintaining local copies of your important files. We strongly recommend
            regularly exporting your projects using the ZIP download feature. LaTeX Forge shall not
            be liable for any loss or corruption of data, howsoever caused.
          </p>

          <h3>6. Service Availability</h3>
          <p>
            LaTeX Forge is provided on an "as-is" and "as-available" basis without warranties of
            any kind, whether express or implied, including but not limited to implied warranties
            of merchantability, fitness for a particular purpose, or non-infringement. We make no
            guarantees regarding uptime, availability, reliability, or error-free operation. We
            reserve the right to modify, suspend, or discontinue the service at any time without
            notice.
          </p>

          <h3>7. Limitation of Liability</h3>
          <p>
            To the fullest extent permitted by law, LaTeX Forge and its maintainers shall not be
            liable for any indirect, incidental, special, consequential, or punitive damages arising
            from your use of or inability to use the service, including but not limited to data loss,
            service interruptions, compilation errors, or loss of profits, even if advised of the
            possibility of such damages.
          </p>

          <h3>8. Indemnification</h3>
          <p>
            You agree to indemnify and hold harmless LaTeX Forge and its maintainers from and
            against any claims, damages, losses, liabilities, and expenses (including reasonable
            legal fees) arising out of or related to your use of the service, your violation of
            these terms, or your violation of any rights of a third party.
          </p>

          <h3>9. Account Termination</h3>
          <p>
            We reserve the right to suspend or terminate accounts that violate these terms, the
            Acceptable Use Policy, or that are inactive for an extended period. Grounds for
            immediate suspension include: violations of the Acceptable Use Policy, fraudulent
            activity, illegal use, or failure to comply with these terms. You may delete your
            account and associated data at any time by contacting the administrator.
          </p>

          <h3>10. Governing Law</h3>
          <p>
            These terms shall be governed by and construed in accordance with the laws of the
            United States and the District of Columbia, without regard to conflict of law principles.
            Any disputes arising from these terms or your use of the service shall be subject to the
            exclusive jurisdiction of the courts located in Washington, D.C.
          </p>

          <h3>11. Changes to Terms</h3>
          <p>
            We may update these terms from time to time. When we make material changes, we will
            notify you by posting a notice within the application or by sending an email to the
            address associated with your account. The "last updated" date at the top of this page
            will be revised accordingly. Continued use of the service after changes constitutes
            acceptance of the revised terms.
          </p>
        </section>

        {/* ── Privacy Policy ── */}
        <section id="privacy">
          <h2>Privacy Policy</h2>

          <h3>1. Information We Collect</h3>
          <p>When you use LaTeX Forge, we collect:</p>
          <ul>
            <li><strong>Account information:</strong> Your Google account name, email address, and unique identifier (UID), collected during sign-in via Google OAuth</li>
            <li><strong>User content:</strong> LaTeX documents, images, bibliography files, and other files you create or upload to your projects</li>
            <li><strong>Collaboration data:</strong> Project sharing settings, invitation records, and real-time editing presence information (cursor position, active file)</li>
            <li><strong>Usage analytics:</strong> Page views and general usage patterns collected via Google Analytics (only if you consent to analytics cookies)</li>
          </ul>

          <h3>2. How We Use Your Information</h3>
          <ul>
            <li><strong>Authentication:</strong> To verify your identity and enforce access controls</li>
            <li><strong>Document storage:</strong> To save and sync your projects across devices</li>
            <li><strong>Collaboration:</strong> To enable real-time editing, sharing, and commenting</li>
            <li><strong>Compilation:</strong> To send your LaTeX files to our compilation server and return PDF output</li>
            <li><strong>Service improvement:</strong> To understand usage patterns and improve the application (analytics data only)</li>
            <li><strong>Security:</strong> To protect against unauthorized access and enforce the email allowlist</li>
          </ul>

          <h3>3. Legal Basis for Processing</h3>
          <p>We process your personal data on the following legal bases:</p>
          <ul>
            <li><strong>Contractual necessity:</strong> Account setup, document storage, and service delivery are required to provide you with the service</li>
            <li><strong>Legitimate interest:</strong> Security enforcement, service improvement, and abuse prevention</li>
            <li><strong>Consent:</strong> Analytics cookies are only set with your explicit consent via the cookie banner. You may withdraw consent at any time</li>
          </ul>

          <h3>4. Third-Party Services</h3>
          <p>LaTeX Forge relies on the following third-party services to operate:</p>
          <ul>
            <li><strong>Google Firebase:</strong> Authentication, database (Firestore), and file storage (Cloud Storage)</li>
            <li><strong>Google Cloud Run:</strong> LaTeX compilation backend</li>
            <li><strong>Google Analytics (GA4):</strong> Anonymous usage statistics (only with your consent)</li>
          </ul>
          <p>
            These services process data on our behalf and are subject to their own privacy policies.
            Google's privacy policy is available
            at <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">policies.google.com/privacy</a>.
            We do not share your data with any other third parties.
          </p>

          <h3>5. Data Storage and Security</h3>
          <p>
            Your data is stored on Google Cloud infrastructure in the United States. Data is
            encrypted in transit (HTTPS/TLS) and at rest (Google Cloud default encryption).
            Access to project data is controlled by Firebase security rules that enforce
            per-project permissions (owner, editor, viewer). See
            the <a href="#security">Security Overview</a> for more details.
          </p>

          <h3>6. Data Retention</h3>
          <ul>
            <li>Your documents and project files persist until you delete them</li>
            <li>Account data is retained until you request account removal</li>
            <li>Deleted projects are moved to trash and can be permanently deleted by you</li>
            <li>Analytics data is retained according to Google Analytics default settings (14 months)</li>
            <li>After retention periods expire, data is destroyed, erased, or anonymized</li>
          </ul>

          <h3>7. Data Sharing</h3>
          <p>
            We do not sell, rent, or share your personal data with third parties for marketing
            or advertising purposes. Data is only shared with the third-party service providers
            listed above, solely to operate the service. We may disclose data if required by law
            or compulsory legal process.
          </p>

          <h3>8. Your Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access:</strong> Request copies of the personal data we hold about you</li>
            <li><strong>Export:</strong> Download your documents via the ZIP export feature at any time</li>
            <li><strong>Rectification:</strong> Request correction of inaccurate personal data</li>
            <li><strong>Deletion:</strong> Request deletion of your account and all associated data</li>
            <li><strong>Objection:</strong> Object to the processing of your personal data</li>
            <li><strong>Opt out:</strong> Decline analytics tracking via the cookie consent banner</li>
          </ul>
          <p>
            To exercise these rights or ask questions about your data, open an issue
            on <a href="https://github.com/mmann1123/latexforge/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>

          <h3>9. International Users</h3>
          <p>
            If you are located in the European Economic Area (EEA) or United Kingdom, we process
            your personal data on the bases described in Section 3 above. Your data is transferred
            to and stored in the United States via Google Cloud infrastructure. These transfers
            are conducted in accordance with Google's data processing terms, which include
            standard contractual clauses approved by the European Commission.
          </p>
          <p>
            You have the right to lodge a complaint with your local data protection supervisory
            authority if you believe your data is being processed unlawfully.
          </p>

          <h3>10. Changes to This Policy</h3>
          <p>
            We may update this privacy policy from time to time. The revised policy will be posted
            on this page with an updated "last updated" date. We encourage you to review this page
            periodically. Material changes will be communicated via the application or email.
          </p>
        </section>

        {/* ── Cookie Policy ── */}
        <section id="cookies">
          <h2>Cookie Policy</h2>

          <p>
            Cookies are small text files stored on your device that help us provide and improve
            our service. This policy explains what cookies we use and how you can control them.
          </p>

          <h3>Essential Cookies</h3>
          <p>
            These cookies are required for the application to function and cannot be disabled.
            They include:
          </p>
          <ul>
            <li><strong>Firebase authentication session:</strong> Keeps you signed in across page loads and browser sessions</li>
            <li><strong>Cookie consent preference:</strong> Remembers whether you accepted or declined analytics cookies</li>
            <li><strong>Application state:</strong> Editor preferences and layout settings stored in local storage</li>
          </ul>

          <h3>Analytics Cookies</h3>
          <p>
            We use Google Analytics (GA4) to collect anonymous usage statistics such as page views
            and general usage patterns. These cookies are only set if you accept analytics tracking
            via the cookie consent banner. Specifically:
          </p>
          <ul>
            <li><strong>_ga</strong> (13 months): Distinguishes unique users</li>
            <li><strong>_ga_*</strong> (13 months): Maintains session state</li>
          </ul>
          <p>
            You can change your analytics preference at any time by clearing your browser's local
            storage for this site and refreshing the page. The cookie consent banner will reappear,
            allowing you to make a new choice.
          </p>

          <h3>No Advertising or Tracking Cookies</h3>
          <p>
            LaTeX Forge does not use any advertising, marketing, or cross-site tracking cookies.
            We do not serve ads, participate in ad networks, or track you across other websites.
          </p>
        </section>

        {/* ── Security Overview ── */}
        <section id="security">
          <h2>Security Overview</h2>

          <h3>Infrastructure</h3>
          <p>
            LaTeX Forge is hosted on Google Cloud Platform, which provides enterprise-grade
            physical security at its data centers, including electronic access controls, alarm
            systems, perimeter fencing, and 24/7 monitoring. All application services
            (authentication, database, storage, compilation) run within Google Cloud.
          </p>

          <h3>Data Encryption</h3>
          <ul>
            <li><strong>In transit:</strong> All connections use HTTPS with TLS encryption. No unencrypted HTTP connections are accepted.</li>
            <li><strong>At rest:</strong> Data stored in Firebase Firestore and Cloud Storage is encrypted at rest using Google Cloud's default encryption (AES-256).</li>
          </ul>

          <h3>Authentication and Access Control</h3>
          <ul>
            <li>Authentication is handled exclusively through Google OAuth 2.0 — LaTeX Forge does not store passwords</li>
            <li>An email allowlist restricts access to approved institutional domains (.edu, .ac.uk, .ca, .org, etc.)</li>
            <li>The allowlist is enforced at four layers: frontend, Firestore security rules, Cloud Storage rules, and the compilation backend</li>
            <li>Per-project access controls enforce owner, editor, and viewer permission levels</li>
          </ul>

          <h3>Compilation Security</h3>
          <ul>
            <li>LaTeX compilation runs in isolated Docker containers on Google Cloud Run</li>
            <li><code>pdflatex</code> is executed with <code>-no-shell-escape</code> to prevent arbitrary command execution</li>
            <li>File paths are validated with regex and resolved path checks to prevent path traversal attacks</li>
            <li>Rate limiting (10 compilations per 60 seconds per user) prevents abuse</li>
            <li>Each compilation has a 30-second timeout and runs in a temporary directory that is cleaned up afterward</li>
          </ul>

          <h3>Backup and Redundancy</h3>
          <p>
            Firebase Firestore and Cloud Storage provide built-in data redundancy across multiple
            Google Cloud availability zones. However, we strongly recommend maintaining local
            backups of important work by regularly downloading your projects using the ZIP export
            feature.
          </p>

          <h3>Vulnerability Reporting</h3>
          <p>
            If you discover a security vulnerability in LaTeX Forge, please report it responsibly
            by opening a security advisory
            on <a href="https://github.com/mmann1123/latexforge/security/advisories/new" target="_blank" rel="noopener noreferrer">GitHub</a>.
            We will investigate all reported security issues and work to address them promptly.
            Please do not publicly disclose vulnerabilities until we have had an opportunity to
            address them.
          </p>
        </section>

        {/* ── Acceptable Use Policy ── */}
        <section id="use">
          <h2>Acceptable Use Policy</h2>

          <p>
            This policy outlines prohibited activities when using LaTeX Forge. Violation of this
            policy may result in immediate suspension or termination of your account.
          </p>

          <h3>System and Network Abuse</h3>
          <p>You may not:</p>
          <ul>
            <li>Probe, scan, or test the vulnerability of our systems or networks</li>
            <li>Tamper with, breach, or circumvent any security or authentication measures</li>
            <li>Access non-public areas of the service or other users' accounts without authorization</li>
            <li>Interfere with or disrupt the service, servers, or networks (e.g., overloading, flooding, denial-of-service attacks)</li>
            <li>Introduce or facilitate the spread of malware, viruses, or other harmful code</li>
          </ul>

          <h3>Automated Access</h3>
          <p>You may not:</p>
          <ul>
            <li>Use robots, scripts, spiders, scrapers, or other automated means to access the service</li>
            <li>Crawl, scrape, or mine data from the service without explicit written permission</li>
            <li>Use the service or its content for machine learning, model training, or AI-related purposes without permission</li>
          </ul>

          <h3>Compilation Resource Abuse</h3>
          <p>You may not:</p>
          <ul>
            <li>Use the LaTeX compilation service for purposes other than compiling LaTeX documents (e.g., cryptocurrency mining, running arbitrary programs)</li>
            <li>Attempt to bypass compilation timeouts, rate limits, or resource restrictions</li>
            <li>Submit files designed to exploit the compilation environment or access the underlying server</li>
          </ul>

          <h3>Content Violations</h3>
          <p>You may not upload, store, or share content that:</p>
          <ul>
            <li>Is unlawful, fraudulent, defamatory, or misleading</li>
            <li>Infringes on copyrights, trademarks, or other intellectual property rights</li>
            <li>Contains pornographic, obscene, or excessively violent material</li>
            <li>Harasses, threatens, or invades the privacy of others</li>
            <li>Contains another person's personal or sensitive information without their consent</li>
          </ul>

          <h3>Commercial Misuse</h3>
          <p>You may not:</p>
          <ul>
            <li>Resell, sublicense, or commercialize access to the service</li>
            <li>Use the service to promote or advertise products or services</li>
            <li>Impersonate any person or entity, or misrepresent your affiliation</li>
          </ul>

          <h3>Intellectual Property</h3>
          <p>You may not:</p>
          <ul>
            <li>Copy, modify, or create derivative works of the service itself (beyond what the GPL v3 license permits for the source code)</li>
            <li>Decompile, disassemble, or reverse engineer any part of the service infrastructure</li>
            <li>Remove or alter any proprietary notices, labels, or markings</li>
          </ul>

          <h3>Reporting Violations</h3>
          <p>
            If you become aware of any violation of this policy, please report it
            to <a href="mailto:mmann1123@gmail.com">mmann1123@gmail.com</a> or open an issue
            on <a href="https://github.com/mmann1123/latexforge/issues" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </section>

        <footer className="legal-footer">
          <p>
            LaTeX Forge is open-source software licensed under the <a href="https://www.gnu.org/licenses/gpl-3.0.en.html" target="_blank" rel="noopener noreferrer">GNU GPL v3</a>.
            Source code is available on <a href="https://github.com/mmann1123/latexforge" target="_blank" rel="noopener noreferrer">GitHub</a>.
          </p>
        </footer>
      </div>
    </div>
  );
}
