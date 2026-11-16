import { reviewModel } from '../models/reviewModel.js';
import { orderModel } from '../models/orderModel.js';
import { supabase } from '../config/supabase.js';

// Only a recently delivered order is asked about, so old orders never pop up
const REVIEW_WINDOW_DAYS = 14;
const BESPOKE_PRODUCT_ID = 'bespoke-hamper';

const productIdOf = (item) => item?.productId || item?.product_id || null;
const deliveredAt = (order) => new Date(order.delivered_at || order.updated_at || order.created_at).getTime();

// Distinct products of an order that can be reviewed (the made-to-order hamper is not a catalogue product)
const reviewableProductIds = (order) => [
  ...new Set((order.items || []).map(productIdOf).filter((id) => id && id !== BESPOKE_PRODUCT_ID))
];

export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params;
    const reviews = await reviewModel.findByProductId(productId);
    res.status(200).json({ success: true, data: reviews });
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reviews' });
  }
};

export const createReview = async (req, res, next) => {
  try {
    const reviewData = req.body;
    // In superadmin context, they might provide a user_id or we can leave it null
    const newReview = await reviewModel.create(reviewData);
    res.status(201).json({ success: true, data: newReview });
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ success: false, message: 'Failed to create review' });
  }
};

// The most recent delivered order of this customer that still waits for a review (or null)
export const getPendingReview = async (req, res) => {
  try {
    const buyerId = req.auth.id;
    const since = Date.now() - REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

    const delivered = (await orderModel.findByBuyerId(buyerId))
      .filter((order) => order.order_status === 'delivered' && deliveredAt(order) >= since)
      .sort((a, b) => deliveredAt(b) - deliveredAt(a));
    if (delivered.length === 0) return res.status(200).json({ success: true, order: null });

    const reviewed = await reviewModel.findForOrders(buyerId, delivered.map((order) => order.id));
    const reviewedKeys = new Set(reviewed.map((row) => `${row.order_id}:${row.product_id}`));

    const order = delivered.find((candidate) => reviewableProductIds(candidate).some((id) => !reviewedKeys.has(`${candidate.id}:${id}`)));
    if (!order) return res.status(200).json({ success: true, order: null });

    const productIds = reviewableProductIds(order).filter((id) => !reviewedKeys.has(`${order.id}:${id}`));
    const { data: products } = await supabase.from('products').select('id, name, images').in('id', productIds);

    res.status(200).json({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        delivered_at: order.delivered_at || null,
        items: (products || []).map((product) => ({
          product_id: product.id,
          name: product.name,
          image: Array.isArray(product.images) && typeof product.images[0] === 'string' ? product.images[0] : product.images?.[0]?.url || null
        }))
      }
    });
  } catch (error) {
    console.error('Error loading the pending review:', error);
    res.status(500).json({ success: false, message: 'Failed to load the review request' });
  }
};

// The customer rates a delivered order: one review row for each product of it that was not reviewed yet
export const createOrderReview = async (req, res) => {
  try {
    const buyerId = req.auth.id;
    const rating = Number(req.body?.rating);
    const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim().slice(0, 500) : '';
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Please choose a rating from 1 to 5 stars.' });
    }

    const order = await orderModel.findById(req.params.orderId);
    if (!order || order.buyer_id !== buyerId) return res.status(404).json({ success: false, message: 'Order not found' });
    if (order.order_status !== 'delivered') {
      return res.status(409).json({ success: false, message: 'You can review an order after it is delivered.' });
    }

    const reviewed = await reviewModel.findForOrders(buyerId, [order.id]);
    const reviewedIds = new Set(reviewed.map((row) => row.product_id));
    const productIds = reviewableProductIds(order).filter((id) => !reviewedIds.has(id));
    if (productIds.length === 0) return res.status(409).json({ success: false, message: 'You have already reviewed this order.' });

    const created = await reviewModel.createMany(
      productIds.map((productId) => ({
        buyer_id: buyerId,
        product_id: productId,
        order_id: order.id,
        rating,
        comment: comment || null,
        images: []
      }))
    );
    if (created === null) return res.status(409).json({ success: false, message: 'You have already reviewed this order.' });

    // The rating shown on the product page follows its reviews
    await Promise.all(productIds.map((id) => reviewModel.refreshProductRating(id).catch((err) => console.warn('Could not refresh the rating of', id, err.message))));

    res.status(201).json({ success: true, message: 'Thank you for your review!' });
  } catch (error) {
    console.error('Error creating the order review:', error);
    res.status(500).json({ success: false, message: 'Failed to save your review' });
  }
};
