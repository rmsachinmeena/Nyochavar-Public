import React from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS, LegalPage, List, Section } from './legalShared';

export const TermsPage: React.FC = () => (
  <LegalPage
    title="Terms of Service"
    intro={
      <>
        These terms govern your use of the {BUSINESS.name} website and the gifts you order through it. {BUSINESS.name} is operated by {BUSINESS.legalName}.
        By browsing the website, creating an account or placing an order you agree to these terms.
      </>
    }
  >
    <Section id="eligibility" title="1. Using the website">
      <List
        items={[
          'You must be at least 18 years old, or use the website under the supervision of a parent or guardian.',
          'Keep your login details safe. You are responsible for activity on your account. Tell us at once if you think someone else is using it.',
          'Give us accurate details, especially the recipient’s name, phone number and delivery address. We cannot deliver a gift that has incomplete or wrong details.',
        ]}
      />
    </Section>

    <Section id="orders" title="2. Orders and prices">
      <List
        items={[
          'All prices are in Indian Rupees (INR) and include applicable taxes. Delivery charges, where they apply, are shown at checkout before you pay.',
          'The price you pay is the price shown on our website at the time you place the order. Prices are always confirmed by our server, not by your browser.',
          'An order is confirmed when you see the order confirmation. We may decline or cancel an order if a product is unavailable, the price was shown wrongly, the address is outside our delivery area or we suspect misuse. If we cancel a prepaid order, you will be refunded in full.',
          'Product photos are for illustration. Flowers, food items and handmade gifts may vary slightly in colour, shape or packaging.',
        ]}
      />
    </Section>

    <Section id="payments" title="3. Payments">
      <p>
        You can pay online (UPI, cards, net banking, wallets where available) or choose cash on delivery where it is offered. Online payments are processed
        by Razorpay; we never see or store your card, UPI PIN or bank details. An online order is confirmed only after your payment is successfully verified.
      </p>
      <p>
        If money is deducted but you do not see an order confirmation, we check the payment with Razorpay automatically: your order is confirmed within a few
        minutes, or, if it can no longer be delivered on the chosen date, we refund the full amount to the original payment method (we start the refund
        within 2 business days). Contact us if you see neither.
      </p>
    </Section>

    <Section id="personalised" title="4. Personalised gifts and messages">
      <List
        items={[
          'When you add a photo, name or message to a gift, you confirm that you own it or have permission to use it and that it is not unlawful, abusive or infringing anyone’s rights.',
          'We may refuse or cancel an order with content that breaks this rule, and will refund any amount paid for it.',
          'Please check spellings carefully. Personalised items are made exactly as you submit them.',
        ]}
      />
    </Section>

    <Section id="delivery" title="5. Delivery, cancellation and refunds">
      <p>
        Delivery is covered in our <Link to="/shipping-policy" className="font-semibold text-brand hover:underline">Shipping Policy</Link>, and cancellations,
        returns and refunds in our <Link to="/refund-policy" className="font-semibold text-brand hover:underline">Refund &amp; Cancellation Policy</Link>. Both
        form part of these terms.
      </p>
    </Section>

    <Section id="ip" title="6. Our content">
      <p>
        The website, its design, text, logos and product images belong to {BUSINESS.name} or its licensors. You may not copy, resell or reuse them without our
        written permission.
      </p>
    </Section>

    <Section id="liability" title="7. Limits of our responsibility">
      <p>
        We work hard to deliver every gift on time and in perfect condition. To the extent the law allows, we are not liable for delays or failures caused by
        events outside our control (weather, strikes, road closures, network or payment-partner outages), or for indirect losses. Our total liability for any
        order is limited to the amount you paid for that order.
      </p>
    </Section>

    <Section id="law" title="8. Governing law">
      <p>
        These terms are governed by the laws of India. Any dispute is subject to the exclusive jurisdiction of the courts at the city of our registered address
        given on the <Link to="/contact" className="font-semibold text-brand hover:underline">Contact page</Link>.
      </p>
    </Section>

    <Section id="changes" title="9. Changes to these terms">
      <p>We may update these terms from time to time. The date at the top shows the latest version. Continuing to use the website means you accept the update.</p>
    </Section>
  </LegalPage>
);

export default TermsPage;
