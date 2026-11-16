import React from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS, ContactCard, LegalPage, List, Section } from './legalShared';

export const RefundPolicyPage: React.FC = () => (
  <LegalPage
    title="Refund & Cancellation Policy"
    intro={
      <>
        We want every gift to arrive perfectly. This policy explains when you can cancel an order, when you can ask for a replacement or refund, and how
        refunds are paid back.
      </>
    }
  >
    <Section id="cancel" title="1. Cancelling an order">
      <List
        items={[
          <>You can cancel an order yourself from <strong>My Orders</strong> in your profile, using the <strong>Cancel order</strong> button, <strong>until a delivery partner has been assigned</strong> to it.</>,
          'Once a delivery partner is assigned, your gift is already being prepared and handed over, so the Cancel button is switched off. If you still need help, contact us straight away and we will try our best, but we cannot promise a cancellation.',
          'An order that is out for delivery or delivered cannot be cancelled.',
          'If you cancel a cash-on-delivery order, you pay nothing.',
        ]}
      />
    </Section>

    <Section id="refund-cancel" title="2. Refund for a cancelled order">
      <List
        items={[
          'If you paid online and your order is cancelled (by you, or by us because an item is unavailable or the order cannot be delivered), the full amount is refunded to the original payment method.',
          'We start the refund within 2 business days of the cancellation. After that, it usually takes 5 to 7 business days to reach your account, depending on your bank or payment provider. My Orders shows when the refund has been sent.',
          'If money was deducted but you did not see an order confirmation (for example, your connection dropped or your bank confirmed late), we check the payment with Razorpay automatically. Your order is confirmed within a few minutes and appears in My Orders, or, if it can no longer be delivered on the chosen date, we refund the full amount to the original payment method within the same timeline.',
        ]}
      />
    </Section>

    <Section id="returns" title="3. Returns, damaged or wrong items">
      <p>Many of our gifts are personalised or perishable, so we do not accept returns for change of mind. We will replace or refund your order if:</p>
      <List
        items={[
          'the gift arrives damaged, spoiled or incomplete;',
          'you receive a different item from the one you ordered;',
          'a personalised item does not match what you submitted (for example a wrong name or photo caused by our error).',
        ]}
      />
      <p>
        To report a problem, contact us <strong>within 48 hours of delivery</strong> with your order number and clear photos of the item and its packaging.
        After we check it, we will send a replacement or refund the amount to the original payment method, as you prefer where both are possible.
      </p>
    </Section>

    <Section id="not-covered" title="4. What is not covered">
      <List
        items={[
          'Mistakes in the details you entered, such as a wrong spelling you submitted for a personalised gift, or a wrong or incomplete address or phone number.',
          'Non-delivery because the recipient was unavailable or refused the gift after repeated attempts.',
          'Natural variation in flowers, colours and handmade finishes.',
        ]}
      />
    </Section>

    <Section id="how" title="5. How to reach us">
      <p>
        Write to us at the details below, or see the <Link to="/contact" className="font-semibold text-brand hover:underline">Contact page</Link>. We aim to
        reply within 24 hours, every day of the week.
      </p>
      <ContactCard />
      <p>{BUSINESS.name} may update this policy from time to time. The date at the top shows the latest version.</p>
    </Section>
  </LegalPage>
);

export default RefundPolicyPage;
