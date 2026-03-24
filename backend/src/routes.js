import { Router } from "express";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { customerRoutes } from "./modules/customers/customer.routes.js";
import { categoryRoutes } from "./modules/categories/category.routes.js";
import { productRoutes } from "./modules/products/product.routes.js";
import { productVariationRoutes } from "./modules/productVariations/productVariation.routes.js";
import { dashboardRoutes } from "./modules/dashboard/dashboard.routes.js";
import { saleRoutes } from "./modules/sales/sale.routes.js";
import { cashRegisterRoutes } from "./modules/cashRegister/cashRegister.routes.js";
import { modulePlaceholdersRoutes } from "./modules/modulePlaceholders.routes.js";

const router = Router();

router.get("/health", (_req, res) => res.json({ ok: true }));
router.use("/auth", authRoutes);
router.use("/customers", customerRoutes);
router.use("/categories", categoryRoutes);
router.use("/products", productRoutes);
router.use("/product-variations", productVariationRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/sales", saleRoutes);
router.use("/cash-register", cashRegisterRoutes);
router.use("/", modulePlaceholdersRoutes);

export { router };
