-- Order messages name the product(s) in plain words instead of the order number.
-- New placeholder: {{products}} (read from the products table using each order item's product_id).
-- This resets the wording of the order-related templates; edit them again in Superadmin if you want something else.
UPDATE notification_templates SET title = 'Your order is confirmed', message = 'Hi {{name}}, we have received your order for {{products}}. Total: {{amount}}. We are getting it ready for you!' WHERE event_key = 'order_placed';
UPDATE notification_templates SET title = 'Payment received', message = 'We received {{amount}} for your {{products}}. Thank you!' WHERE event_key = 'payment_paid';
UPDATE notification_templates SET title = 'Payment failed', message = 'Your payment for {{products}} did not go through. You can try again from checkout.' WHERE event_key = 'payment_failed';
UPDATE notification_templates SET title = 'Delivery partner assigned', message = '{{rider_name}} will deliver your {{products}}.' WHERE event_key = 'rider_assigned';
UPDATE notification_templates SET title = 'Your gift is out for delivery', message = 'Your {{products}} is on its way. Share delivery code {{delivery_otp}} with {{rider_name}} when it arrives.' WHERE event_key = 'out_for_delivery';
UPDATE notification_templates SET title = 'Delivered', message = 'Your {{products}} was delivered. We hope they love it!' WHERE event_key = 'delivered';
UPDATE notification_templates SET title = 'Order cancelled', message = 'Your order for {{products}} was cancelled. If you paid online, the refund goes back to your original payment method.' WHERE event_key = 'order_cancelled';
