import React from 'react';
import { Link } from 'react-router-dom';
import { BUSINESS, LegalPage, List, Section } from './legalShared';
import { DELIVERY_AREAS } from '../checkout/deliveryAreas';

// Mirrors the checkout's slots: a slot can be booked for today until one hour before it ends
const SLOTS = [
  { label: 'Morning', time: '9 AM – 12 PM', sameDayBy: '11 AM' },
  { label: 'Afternoon', time: '12 PM – 3 PM', sameDayBy: '2 PM' },
  { label: 'Evening', time: '3 PM – 6 PM', sameDayBy: '5 PM' },
];

export const ShippingPolicyPage: React.FC = () => (
  <LegalPage
    title="Shipping & Delivery Policy"
    intro={<>This policy explains where and when {BUSINESS.name} delivers, what delivery costs and how the handover to the recipient works.</>}
  >
    <Section id="areas" title="1. Where we deliver">
      <p>
        We currently deliver <strong>only in Ajmer, Rajasthan</strong>, in these areas. At checkout you choose one of them, so an order can only be placed for
        an area we serve:
      </p>
      <List items={[...DELIVERY_AREAS]} />
      <p>We will add more areas over time. If your area is not listed yet, please contact us.</p>
    </Section>

    <Section id="timing" title="2. Delivery date and time slot">
      <List
        items={[
          'At checkout you choose the delivery date (from today up to 7 days ahead) and a delivery time slot.',
          'Personalised and made-to-order gifts need preparation time, so the earliest available date and slot are shown at checkout for your items.',
          'We aim to deliver within the slot you chose. Delivery times are estimates and may be affected by traffic, weather or other events outside our control.',
        ]}
      />
      <div className="overflow-hidden rounded-2xl border border-slate-200/80">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-3 font-semibold">Slot</th>
              <th scope="col" className="px-4 py-3 font-semibold">Delivered between</th>
              <th scope="col" className="px-4 py-3 font-semibold">Same day: order by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
            {SLOTS.map((slot) => (
              <tr key={slot.label}>
                <td className="px-4 py-3 font-medium text-ink">{slot.label}</td>
                <td className="px-4 py-3">{slot.time}</td>
                <td className="px-4 py-3">{slot.sameDayBy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>All times are Indian Standard Time. After 5 PM, the earliest delivery is the next morning.</p>
    </Section>

    <Section id="charges" title="3. Delivery charges">
      <p>
        Any delivery charge is shown in your order summary before you pay. Some products ship free. There are no hidden delivery fees added after you place the
        order.
      </p>
    </Section>

    <Section id="handover" title="4. Handover and delivery code">
      <List
        items={[
          'Our delivery partner calls or visits the recipient at the address you gave.',
          'When your order goes out for delivery, you receive a 4-digit delivery code in your notifications and in My Orders. Share it with the delivery partner only when the gift is in your recipient’s hands. The delivery is marked complete when the code is entered.',
          'Please do not share the code with anyone before the gift arrives.',
        ]}
      />
    </Section>

    <Section id="failed" title="5. If the delivery cannot be completed">
      <p>
        If nobody is available at the address, the details are incomplete or the recipient refuses the gift, our delivery partner will try to contact the
        recipient and you. If delivery still cannot be completed, we will contact you to reschedule. Orders that cannot be delivered for reasons within our
        control are cancelled and refunded as described in the{' '}
        <Link to="/refund-policy" className="font-semibold text-brand hover:underline">Refund &amp; Cancellation Policy</Link>.
      </p>
    </Section>

    <Section id="track" title="6. Tracking your order">
      <p>
        You can follow your order in <strong>My Orders</strong> and in your notifications. We tell you when the order is confirmed, when a delivery partner is
        assigned, when it is out for delivery and when it is delivered.
      </p>
    </Section>

    <Section id="help" title="7. Help with delivery">
      <p>
        For anything about your delivery, see our <Link to="/contact" className="font-semibold text-brand hover:underline">Contact page</Link>.
      </p>
    </Section>
  </LegalPage>
);

export default ShippingPolicyPage;
