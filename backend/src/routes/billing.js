/**
 * Billing Routes
 * Stripe integration for subscriptions and payments
 */

import express from 'express';
import { authenticate } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/errorHandler.js';
import { loadWorkspace } from '../middlewares/workspace.js';
import prisma from '../prisma.js';

const router = express.Router();

router.use(authenticate);

// Create Stripe checkout session
router.post('/checkout',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { priceId, successUrl, cancelUrl } = req.body;
    
    // TODO: Create Stripe checkout session
    // const session = await stripe.checkout.sessions.create({ ... });
    
    res.json({
      success: true,
      checkoutUrl: 'https://stripe.com/checkout/...',
      message: 'Stripe integration - TODO',
    });
  })
);

// Create customer portal session
router.post('/portal',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const { returnUrl } = req.body;
    
    // TODO: Create Stripe portal session
    // const session = await stripe.billingPortal.sessions.create({ ... });
    
    res.json({
      success: true,
      portalUrl: 'https://stripe.com/portal/...',
      message: 'Stripe portal - TODO',
    });
  })
);

// Get subscription status
router.get('/subscription',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findFirst({
      where: { workspaceId: req.workspace.id },
      orderBy: { createdAt: 'desc' },
    });
    
    if (!subscription) {
      return res.json({ subscription: null, status: 'none' });
    }
    
    res.json({
      subscription: {
        plan: subscription.plan,
        status: subscription.status,
        currentPeriodEnd: subscription.currentPeriodEnd,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      },
    });
  })
);

// Stripe webhook
router.post('/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    
    // TODO: Verify webhook signature and process event
    // const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    res.json({ received: true });
  })
);

// List invoices
router.get('/invoices',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const invoices = await prisma.invoice.findMany({
      where: { workspaceId: req.workspace.id },
      orderBy: { createdAt: 'desc' },
    });
    
    res.json(invoices);
  })
);

// Cancel subscription
router.post('/cancel',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findFirst({
      where: { workspaceId: req.workspace.id, status: 'active' },
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription' });
    }
    
    // TODO: Cancel in Stripe
    // await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: true });
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: true },
    });
    
    res.json({ success: true, message: 'Subscription will cancel at period end' });
  })
);

// Reactivate subscription
router.post('/reactivate',
  loadWorkspace,
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findFirst({
      where: {
        workspaceId: req.workspace.id,
        cancelAtPeriodEnd: true,
      },
    });
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription to reactivate' });
    }
    
    // TODO: Reactivate in Stripe
    // await stripe.subscriptions.update(subscription.stripeSubscriptionId, { cancel_at_period_end: false });
    
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { cancelAtPeriodEnd: false },
    });
    
    res.json({ success: true, message: 'Subscription reactivated' });
  })
);

export default router;
