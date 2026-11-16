import React from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS, ContactCard, LegalPage, Section } from './legalShared';

export const ContactPage: React.FC = () => (
  <LegalPage
    title="Contact Us"
    intro={<>Questions about an order, a delivery or a payment? We are happy to help. Please keep your order number ready.</>}
  >
    <Section id="details" title="Our details">
      <ContactCard />
    </Section>

    <Section id="help" title="How we can help">
      <p>
        Cancellations, refunds and damaged items are explained in our{' '}
        <Link to="/refund-policy" className="font-semibold text-brand hover:underline">Refund &amp; Cancellation Policy</Link>, and delivery details in our{' '}
        <Link to="/shipping-policy" className="font-semibold text-brand hover:underline">Shipping Policy</Link>. We reply within 24 hours, every day of the week.
      </p>
    </Section>

    <Section id="grievance" title="Grievance officer">
      <p>
        If your issue has not been resolved, write to our Grievance Officer, {BUSINESS.grievanceOfficer}, at the email above. We acknowledge complaints within
        48 hours and resolve them within 30 days.
      </p>
    </Section>
  </LegalPage>
);

export default ContactPage;
