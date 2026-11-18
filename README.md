# EcomBD — Shoe Brand E-Commerce Backend (`server-ecombd`)

Modular Express 5 + TypeScript + Prisma 7 + Better Auth backend server for the Bangladesh Shoe Brand E-Commerce Platform (**Super Admin Portal** & **Customer Portal**).

## Tech Stack
- **Runtime & Language:** Node.js (ESM) + TypeScript
- **Framework:** Express v5
- **Database & ORM:** PostgreSQL (`pg`) + Prisma v7 (`@prisma/adapter-pg`, multi-file schema in `prisma/schema/`)
- **Authentication:** Pure Better Auth (Database Session + `cookieCache` + `bearer` plugin + Email OTP + Google OAuth)
- **Validation:** Zod v4
- **File Uploads:** Multer + Cloudinary (`multer-storage-cloudinary`) with automatic rollback cleanup on request error

## Folder Structure
```text
server-ecombd/
├── prisma/
│   └── schema/                 # Multi-file Prisma schemas
│       ├── schema.prisma       # Generator & datasource
│       ├── enums.prisma        # All Enums (Role, OrderStatus, etc.)
│       ├── auth.prisma         # User, Session, Account, Verification, CustomerAddress
│       ├── admin.prisma        # Admin profile, CustomerFraudScore
│       ├── product.prisma      # Category, SizeChart, Product, ProductColor, ProductVariant
│       ├── inventory.prisma    # StockMovement
│       ├── order.prisma        # IncompleteOrder, Order, OrderItem, OrderStatusHistory
│       ├── courier.prisma      # CourierShipment, ShippingZoneRule
│       ├── exchange.prisma     # ExchangeRequest
│       ├── payment.prisma      # Payment, DailyExpense
│       ├── marketing.prisma    # Coupon, FlashSale, CampaignLandingPage
│       ├── review.prisma       # Review, Wishlist
│       └── system.prisma       # Banner, ShowroomLocation, PlatformSettings, ActivityLog
├── scripts/
│   └── fix-imports.js          # Appends .js to relative ESM imports in dist/ after build
├── src/
│   ├── app/
│   │   ├── config/             # env.ts, cloudinary.config.ts, multer.config.ts
│   │   ├── errorHelpers/       # AppError.ts, handlePrismaErrors.ts, handleZodError.ts
│   │   ├── interfaces/         # error, query, requestUser, Express Request augmentation
│   │   ├── lib/                # prisma.ts, auth.ts (Pure Better Auth setup)
│   │   ├── middleware/         # checkAuth.ts, validateRequest.ts, globalErrorHandler.ts, notFound.ts
│   │   ├── module/             # Feature modules (auth, user, admin, ...)
│   │   ├── routes/             # Central API v1 router (/api/v1)
│   │   ├── shared/             # catchAsync.ts, sendResponse.ts
│   │   ├── templates/          # EJS email templates (otp, welcome, googleRedirect)
│   │   └── utils/              # QueryBuilder.ts, cookie.ts, email.ts, seed.ts
│   ├── app.ts
│   └── server.ts
├── .env.example
├── package.json
├── prisma.config.ts
└── tsconfig.json
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Configure environment variables:**
   Copy `.env.example` to `.env` and fill in your PostgreSQL `DATABASE_URL` and other credentials.
3. **Generate Prisma client & run migrations:**
   ```bash
   npm run generate
   npm run migrate
   ```
4. **Start development server:**
   ```bash
   npm run dev
   ```
