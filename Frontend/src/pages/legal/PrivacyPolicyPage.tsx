import React from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS, LAST_UPDATED, List, Section } from './legalShared';

export const PrivacyPolicyPage: React.FC = () => (
  <article className="mx-auto max-w-3xl px-5 py-10 sm:px-6 sm:py-16">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand">Legal</p>
    <h1 className="mt-2 font-serif text-[32px] leading-tight text-ink sm:text-4xl">Privacy Policy</h1>
    <p className="mt-2 text-sm text-slate-500">Last updated: {LAST_UPDATED}</p>

    <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
      This Privacy Policy explains how {BUSINESS.name} (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;), operated by {BUSINESS.legalName}, collects,
      uses, shares and protects your personal information when you browse our website, create an account, place an order or pay online. By using
      our website you agree to this policy.
    </p>

    <nav aria-label="Contents" className="mt-8 rounded-2xl border border-slate-200/80 bg-slate-50 p-5">
      <p className="text-sm font-semibold text-ink">On this page</p>
      <ol className="mt-2 grid gap-1 text-sm text-brand sm:grid-cols-2">
        {[
          ['information-we-collect', 'Information we collect'],
          ['how-we-use', 'How we use your information'],
          ['payments', 'Payments and payment security'],
          ['sharing', 'Who we share information with'],
          ['cookies', 'Cookies and local storage'],
          ['retention', 'Data retention'],
          ['security', 'How we protect your data'],
          ['your-rights', 'Your rights and choices'],
          ['children', 'Children’s privacy'],
          ['changes', 'Changes to this policy'],
          ['contact', 'Contact and grievance officer'],
        ].map(([id, label], index) => (
          <li key={id}>
            <a href={`#${id}`} className="hover:underline">
              {index + 1}. {label}
            </a>
          </li>
        ))}
      </ol>
    </nav>

    <div className="mt-10 space-y-10">
      <Section id="information-we-collect" title="1. Information we collect">
        <p>We collect only what we need to run the store and deliver your gifts:</p>
        <List
          items={[
            <><strong>Account details:</strong> your name, email address, phone number and password (stored only as a secure hash). If you sign in with Google, we receive your name and verified email from Google.</>,
            <><strong>Delivery details:</strong> recipient name, phone number, delivery address, city and pincode, the delivery date and your gift message or delivery instructions. Phone numbers are confirmed with a one-time code before an order is placed.</>,
            <><strong>Order details:</strong> the items you buy, amounts, coupon used, order status and payment status.</>,
            <><strong>Saved preferences:</strong> saved addresses, wishlist and cart so they are there when you come back.</>,
            <><strong>Usage and device data:</strong> pages viewed, search terms, approximate session information and error logs, used to improve the website.</>,
          ]}
        />
        <p>We do <strong>not</strong> collect or store your card number, CVV, UPI PIN, net-banking or wallet credentials. See the payments section below.</p>
      </Section>

      <Section id="how-we-use" title="2. How we use your information">
        <List
          items={[
            'To create and manage your account and verify your email with a one-time password (OTP).',
            'To process, pack, deliver and track your orders, and to contact you or the recipient about a delivery.',
            'To take payment, confirm that a payment succeeded, and handle cancellations, refunds and support requests.',
            'To send transactional messages such as order confirmations, delivery updates and password-reset codes.',
            'To prevent fraud and misuse, keep the website secure and meet our legal obligations.',
            'To improve our products, website and customer experience.',
          ]}
        />
        <p>We do not sell your personal information.</p>
      </Section>

      <Section id="payments" title="3. Payments and payment security">
        <p>
          Online payments (UPI, cards, net banking and wallets, where available) are processed by our payment gateway partner,{' '}
          <strong>Razorpay Software Private Limited</strong> (&ldquo;Razorpay&rdquo;). When you choose to pay online, you enter your payment details in
          Razorpay&rsquo;s secure payment window, not on our website.
        </p>
        <List
          items={[
            'Your card, UPI and bank details are collected and processed directly by Razorpay and the banks or payment networks involved. We never see, receive or store them.',
            'Razorpay is a PCI DSS compliant payment service provider. Its handling of your data is governed by Razorpay’s own privacy policy, available at razorpay.com/privacy.',
            'We receive only the outcome of your payment: an order and payment reference, the amount, the payment method type (for example UPI or card) and whether it succeeded or failed.',
            'Every payment is verified on our server using a cryptographic signature from Razorpay before an order is marked as paid.',
            'For cash on delivery orders no online payment details are collected.',
          ]}
        />
        <p>
          For refunds, cancellations and shipping, please read our refund &amp; cancellation policy and shipping policy (or contact us at the details
          below). Approved refunds are returned to the original payment method.
        </p>
      </Section>

      <Section id="sharing" title="4. Who we share information with">
        <p>We share personal information only with service providers who help us run the store, and only as much as they need:</p>
        <List
          items={[
            <><strong>Razorpay</strong> to process online payments.</>,
            <><strong>Delivery partners / riders</strong> who receive the recipient&rsquo;s name, phone number and address, and any delivery instruction, to deliver your gift.</>,
            <><strong>Hosting, database and storage providers</strong> (for example Supabase and Cloudinary) that store our data and images securely.</>,
            <><strong>Email service providers</strong> that send OTPs, order updates and receipts on our behalf.</>,
            <><strong>WhatsApp</strong>, which we use to send one-time verification codes and order and delivery updates to the phone numbers you give us.</>,
            <><strong>Google (Firebase)</strong>, which may send the one-time code by SMS when we verify a phone number, including the recipient&rsquo;s number entered at checkout, and which handles sign-in if you choose to sign in with Google.</>,
            <><strong>Authorities</strong> where we are required by law, court order or to protect our rights and users.</>,
          ]}
        />
        <p>These providers may process data only to provide their service to us and are expected to protect it.</p>
      </Section>

      <Section id="cookies" title="5. Cookies and local storage">
        <p>
          We use cookies and your browser&rsquo;s local storage to keep you signed in, remember your cart, wishlist and checkout details, and understand
          how the site is used. You can clear or block them in your browser settings, but parts of the website (such as staying signed in or keeping a
          cart) may then not work properly. Our payment partner may also set its own cookies inside its payment window.
        </p>
      </Section>

      <Section id="retention" title="6. Data retention">
        <p>
          We keep your account information for as long as your account is active. Order and payment records are kept for as long as needed to provide
          support and to meet tax, accounting and legal requirements. You can ask us to delete your account (see below); some records may be retained
          where the law requires it.
        </p>
      </Section>

      <Section id="security" title="7. How we protect your data">
        <List
          items={[
            'Passwords are stored as one-way hashes, never in plain text.',
            'The website and API are served over encrypted (HTTPS) connections in production.',
            'Access to customer data is limited to authorised staff and protected by authentication.',
            'Payment details never reach our servers, and payment confirmations are signature-verified.',
          ]}
        />
        <p>No system is perfectly secure, but we work to protect your information and review our practices regularly.</p>
      </Section>

      <Section id="your-rights" title="8. Your rights and choices">
        <p>You may, at any time:</p>
        <List
          items={[
            'view and update your name, phone number and saved addresses from your profile;',
            'ask for a copy of the personal information we hold about you;',
            'ask us to correct inaccurate information or delete your account;',
            'withdraw consent to marketing emails using the unsubscribe link or by writing to us.',
          ]}
        />
        <p>To make a request, contact us using the details below. We may need to verify your identity first.</p>
      </Section>

      <Section id="children" title="9. Children’s privacy">
        <p>Our website is meant for adults. We do not knowingly collect personal information from children under 18 without a parent&rsquo;s or guardian&rsquo;s consent.</p>
      </Section>

      <Section id="changes" title="10. Changes to this policy">
        <p>We may update this policy from time to time. The &ldquo;Last updated&rdquo; date at the top shows when it last changed. Continued use of the website after an update means you accept the revised policy.</p>
      </Section>

      <Section id="contact" title="11. Contact and grievance officer">
        <p>For any question, request or complaint about your privacy, please contact:</p>
        <address className="rounded-2xl border border-slate-200/80 bg-slate-50 p-5 not-italic text-sm leading-relaxed text-slate-700">
          <strong className="text-ink">{BUSINESS.name}</strong> ({BUSINESS.legalName})
          <br />
          {BUSINESS.address}
          <br />
          Email: {BUSINESS.email}
          <br />
          Phone: {BUSINESS.phone}
          <br />
          Grievance Officer: {BUSINESS.grievanceOfficer}
        </address>
        <p>We aim to acknowledge complaints within 48 hours and resolve them within 30 days.</p>
      </Section>
    </div>

    <p className="mt-12 text-sm text-slate-500">
      <Link to="/" className="font-semibold text-brand hover:underline">
        Back to home
      </Link>
    </p>
  </article>
);

export default PrivacyPolicyPage;
