import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link 
          href="/" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to home
        </Link>

        <article className="prose prose-zinc dark:prose-invert max-w-none">
          <h1 className="text-4xl font-light mb-8">Privacy Policy</h1>
          
          <p className="text-muted-foreground">Last updated: January 5, 2026</p>
          
          <p className="text-foreground/80 leading-relaxed mt-6">
            Benrov, Inc. (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) operates Surgent. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-medium mt-6 mb-3">Information You Provide</h3>
            <ul className="text-foreground/80 leading-relaxed space-y-2">
              <li><strong>Account Information:</strong> Name, email address, and password when you create an account</li>
              <li><strong>User Content:</strong> Any content, data, or materials you create, upload, or generate using Surgent</li>
              <li><strong>Communications:</strong> Information you provide when contacting us for support</li>
              <li><strong>Payment Information:</strong> Billing details processed securely through our payment providers</li>
            </ul>

            <h3 className="text-lg font-medium mt-6 mb-3">Information Collected Automatically</h3>
            <ul className="text-foreground/80 leading-relaxed space-y-2">
              <li><strong>Usage Data:</strong> How you interact with Surgent, features used, and actions taken</li>
              <li><strong>Device Information:</strong> Browser type, operating system, and device identifiers</li>
              <li><strong>Log Data:</strong> IP address, access times, and referring URLs</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">2. How We Use Your Information</h2>
            <ul className="text-foreground/80 leading-relaxed space-y-2">
              <li>Provide, operate, and maintain Surgent</li>
              <li>Process transactions and send related information</li>
              <li>Respond to your comments, questions, and support requests</li>
              <li>Send you technical notices, updates, and security alerts</li>
              <li>Improve and personalize your experience</li>
              <li>Analyze usage patterns to enhance our service</li>
              <li>Detect, prevent, and address technical issues or fraud</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">3. Your Content & AI Processing</h2>
            <p className="text-foreground/80 leading-relaxed">
              Content you create or input into Surgent may be processed by AI services to provide our features. We do not use your content to train AI models. Your content remains yours and is not shared with other users.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">4. Data Storage & Security</h2>
            <p className="text-foreground/80 leading-relaxed">
              Your data is stored on secure servers in the United States. We implement industry-standard security measures including encryption in transit and at rest, regular security audits, and access controls. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">5. Third-Party Services</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              We use trusted third-party services to operate Surgent:
            </p>
            <ul className="text-foreground/80 leading-relaxed space-y-2">
              <li><strong>Authentication:</strong> Secure login providers</li>
              <li><strong>AI Services:</strong> Large language model providers for content generation</li>
              <li><strong>Analytics:</strong> To understand how users interact with our service</li>
              <li><strong>Payment Processing:</strong> Secure payment handling</li>
              <li><strong>Cloud Infrastructure:</strong> Data hosting and storage</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              These services have their own privacy policies and we encourage you to review them.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">6. Data Retention</h2>
            <p className="text-foreground/80 leading-relaxed">
              We retain your information for as long as your account is active or as needed to provide you services. You can request deletion of your account and associated data at any time. Some information may be retained as required by law or for legitimate business purposes.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">7. Your Rights</h2>
            <p className="text-foreground/80 leading-relaxed mb-4">
              Depending on your location, you may have the following rights:
            </p>
            <ul className="text-foreground/80 leading-relaxed space-y-2">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your personal data</li>
              <li><strong>Export:</strong> Receive your data in a portable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="text-foreground/80 leading-relaxed mt-4">
              To exercise these rights, contact us at the email below.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">8. California Privacy Rights</h2>
            <p className="text-foreground/80 leading-relaxed">
              California residents have additional rights under the CCPA, including the right to know what personal information we collect, request deletion, and opt-out of any sale of personal information. We do not sell your personal information.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">9. Children&apos;s Privacy</h2>
            <p className="text-foreground/80 leading-relaxed">
              Surgent is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">10. International Users</h2>
            <p className="text-foreground/80 leading-relaxed">
              If you access Surgent from outside the United States, your information may be transferred to, stored, and processed in the United States. By using our service, you consent to this transfer.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">11. Changes to This Policy</h2>
            <p className="text-foreground/80 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting a notice on Surgent or sending you an email. Your continued use after changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-2xl font-light mt-8 mb-4">12. Contact Us</h2>
            <p className="text-foreground/80 leading-relaxed">
              If you have questions about this Privacy Policy or our data practices, contact us at:
            </p>
            <div className="mt-4 text-foreground/80">
              <p className="font-medium">Benrov, Inc.</p>
              <p>188 South Park</p>
              <p>San Francisco, CA 94107</p>
              <p className="mt-2">
                <a href="mailto:privacy@surgent.dev" className="text-primary hover:underline">
                  privacy@surgent.dev
                </a>
              </p>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
