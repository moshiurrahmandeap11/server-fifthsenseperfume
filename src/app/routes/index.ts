import { Router } from "express";
import { AdminRoutes } from "../module/admin/admin.route";
import { AnalyticsRoutes } from "../module/analytics/analytics.route";
import { AuthRoutes } from "../module/auth/auth.route";
import { CartRoutes } from "../module/cart/cart.route";
import { CategoryRoutes } from "../module/category/category.route";
import { CourierRoutes } from "../module/courier/courier.route";
import { ExchangeRoutes } from "../module/exchange/exchange.route";
import { InventoryRoutes } from "../module/inventory/inventory.route";
import { MarketingRoutes } from "../module/marketing/marketing.route";
import { MediaRoutes } from "../module/media/media.route";
import { OrderRoutes } from "../module/order/order.route";
import { PaymentRoutes } from "../module/payment/payment.route";
import { ProductRoutes } from "../module/product/product.route";
import { ReviewRoutes } from "../module/review/review.route";
import { SizeChartRoutes } from "../module/sizeChart/sizeChart.route";
import { SystemRoutes } from "../module/system/system.route";
import { UserRoutes } from "../module/user/user.route";
import { WishlistRoutes } from "../module/wishlist/wishlist.route";

const router = Router();

router.use("/auth", AuthRoutes);
router.use("/admin", AdminRoutes);
router.use("/admins", AdminRoutes); // alias for backwards compatibility
router.use("/users", UserRoutes);
router.use("/cart", CartRoutes);
router.use("/categories", CategoryRoutes);
router.use("/size-charts", SizeChartRoutes);
router.use("/products", ProductRoutes);
router.use("/inventory", InventoryRoutes);
router.use("/orders", OrderRoutes);
router.use("/courier", CourierRoutes);
router.use("/exchanges", ExchangeRoutes);
router.use("/payments", PaymentRoutes);
router.use("/marketing", MarketingRoutes);
router.use("/reviews", ReviewRoutes);
router.use("/wishlist", WishlistRoutes);
router.use("/system", SystemRoutes);
router.use("/analytics", AnalyticsRoutes);

export const IndexRoutes = router;








