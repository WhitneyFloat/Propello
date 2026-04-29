import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

export const PRICES = {
  core: process.env.STRIPE_PRICE_CORE!,
  growth: process.env.STRIPE_PRICE_GROWTH!,
  boardBrief: process.env.STRIPE_PRICE_BOARD_BRIEF!,
};
