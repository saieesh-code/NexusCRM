# ⚡ NexusCRM — Backend API

> Production-grade CRM REST API built with **Node.js**, **Express**, and **MongoDB**.  
> JWT auth · Role-based access control · Full lead pipeline · Notes · Analytics · CSV export

---

## 📁 Project Structure

```
nexus-crm-backend/
├── src/
│   ├── app.js                    # Express app (middleware + routes)
│   ├── server.js                 # Entry point — connects DB and starts server
│   ├── config/
│   │   └── database.js           # MongoDB connection with retry logic
│   ├── controllers/
│   │   ├── authController.js     # Register, login, profile, password reset
│   │   ├── leadController.js     # Full CRUD, bulk actions, CSV export
│   │   ├── noteController.js     # Lead notes / follow-up log
│   │   ├── analyticsController.js# Dashboard stats, funnel, rep performance
│   │   └── activityController.js # Audit trail endpoints
│   ├── middleware/
│   │   ├── authMiddleware.js     # JWT protect + RBAC authorize
│   │   ├── errorMiddleware.js    # Global error handler + AppError class
│   │   ├── validationMiddleware.js # express-validator rule sets
│   │   └── uploadMiddleware.js   # Multer file upload handler
│   ├── models/
│   │   ├── User.js               # User schema (bcrypt, JWT methods)
│   │   ├── Lead.js               # Lead schema (soft delete, notes embedded)
│   │   └── Activity.js           # Audit log schema (TTL index)
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── leadRoutes.js
│   │   ├── noteRoutes.js
│   │   ├── analyticsRoutes.js
│   │   └── activityRoutes.js
│   └── utils/
│       ├── activityLogger.js     # Helper to create activity records
│       ├── csvExporter.js        # Leads → CSV string converter
│       ├── emailService.js       # Nodemailer transactional emails
│       ├── logger.js             # Winston logger
│       └── seeder.js             # Dev database seeder
├── tests/
│   ├── setup.js                  # Jest env setup
│   ├── auth.test.js              # Auth endpoint tests
│   └── leads.test.js             # Lead CRUD + notes tests
├── .env.example                  # Environment variable template
├── .eslintrc.js
├── .gitignore
├── jest.config.js
└── package.json
```

---

## 🚀 Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your MongoDB URI, JWT secrets, SMTP credentials
```

### 3. Seed the database (optional — adds sample data)
```bash
npm run seed
```

### 4. Start development server
```bash
npm run dev
```

API is live at: `http://localhost:5000/api/v1`

---

## 🔐 Authentication

All protected routes require:
```
Authorization: Bearer <accessToken>
```

Tokens are also set as httpOnly cookies (`accessToken`, `refreshToken`).

### Role Hierarchy

| Role        | Permissions |
|-------------|-------------|
| `admin`     | Full access — manage users, delete leads, view all data |
| `manager`   | All leads, bulk actions, analytics, rep performance |
| `sales_rep` | Own assigned leads only |
| `viewer`    | Read-only access |

---

## 📡 API Reference

### Auth — `/api/v1/auth`

| Method | Endpoint                      | Auth | Description |
|--------|-------------------------------|------|-------------|
| POST   | `/register`                   | ❌   | Register new user |
| POST   | `/login`                      | ❌   | Login → returns tokens |
| POST   | `/logout`                     | ❌   | Clear auth cookies |
| POST   | `/refresh`                    | ❌   | Refresh access token |
| POST   | `/forgot-password`            | ❌   | Send password reset email |
| POST   | `/reset-password/:token`      | ❌   | Reset password |
| GET    | `/profile`                    | ✅   | Get current user profile |
| PUT    | `/profile`                    | ✅   | Update name / avatar |
| PUT    | `/change-password`            | ✅   | Change password |
| GET    | `/users`                      | 🔒 admin | List all users |

### Leads — `/api/v1/leads`

| Method | Endpoint                      | Auth | Description |
|--------|-------------------------------|------|-------------|
| POST   | `/public`                     | ❌   | Public contact form submission |
| GET    | `/`                           | ✅   | List leads (search, filter, sort, paginate) |
| POST   | `/`                           | ✅   | Create lead |
| GET    | `/export/csv`                 | 🔒 manager+ | Download leads as CSV |
| POST   | `/bulk`                       | 🔒 manager+ | Bulk status update / delete / assign |
| GET    | `/:id`                        | ✅   | Get single lead |
| PUT    | `/:id`                        | ✅   | Update lead |
| PATCH  | `/:id/status`                 | ✅   | Update status only |
| DELETE | `/:id`                        | 🔒 manager+ | Soft-delete lead |

#### Query Parameters for GET `/leads`
| Param      | Example             | Description |
|------------|---------------------|-------------|
| `search`   | `?search=Jane`      | Full-text search (name, email, company) |
| `status`   | `?status=Qualified` | Filter by status |
| `source`   | `?source=LinkedIn`  | Filter by lead source |
| `priority` | `?priority=High`    | Filter by priority |
| `assignedTo` | `?assignedTo=<id>` | Filter by rep |
| `sort`     | `?sort=-createdAt`  | Sort field (prefix `-` for desc) |
| `page`     | `?page=2`           | Page number (default 1) |
| `limit`    | `?limit=20`         | Results per page (default 10) |
| `startDate`| `?startDate=2024-01-01` | Created after date |
| `endDate`  | `?endDate=2024-12-31`   | Created before date |

### Notes — `/api/v1/leads/:id/notes`

| Method | Endpoint                            | Auth | Description |
|--------|-------------------------------------|------|-------------|
| GET    | `/leads/:id/notes`                  | ✅   | List all notes for a lead |
| POST   | `/leads/:id/notes`                  | ✅   | Add a note |
| PUT    | `/leads/:id/notes/:noteId`          | ✅   | Edit own note |
| DELETE | `/leads/:id/notes/:noteId`          | ✅   | Delete note (own or manager+) |

### Analytics — `/api/v1/analytics`

| Method | Endpoint           | Auth        | Description |
|--------|--------------------|-------------|-------------|
| GET    | `/dashboard`       | ✅          | Summary stats, charts, recent activity |
| GET    | `/funnel`          | 🔒 manager+ | Pipeline drop-off analysis |
| GET    | `/rep-performance` | 🔒 manager+ | Per-rep conversion stats |

### Activities — `/api/v1/activities`

| Method | Endpoint           | Auth        | Description |
|--------|--------------------|-------------|-------------|
| GET    | `/`                | ✅          | Paginated activity log |
| GET    | `/me`              | ✅          | Current user's activity |
| GET    | `/lead/:leadId`    | ✅          | Activity for a specific lead |
| DELETE | `/clear`           | 🔒 admin    | Delete logs older than N days |

### Health

```
GET /api/v1/health
```

---

## 🔒 Security Features

- **bcrypt** password hashing (12 rounds)  
- **JWT** access + refresh token rotation  
- **Helmet** HTTP security headers  
- **CORS** whitelist via environment variable  
- **express-rate-limit** — global + stricter auth limiter  
- **express-mongo-sanitize** — NoSQL injection prevention  
- **Soft delete** — leads are never hard-deleted from DB  
- **Role-based access control** on every sensitive route  
- **Input validation** with express-validator on all endpoints  
- **Environment variable** separation — zero secrets in code  
- **Secure httpOnly cookies** for tokens  
- **Error handler** never leaks stack traces in production  

---

## 🧪 Tests

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage
```

Tests use a separate `nexus_crm_test` database and are fully isolated.

---

## 📧 Email Configuration

Set the following in `.env` to enable transactional emails:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password     # Gmail App Password
EMAIL_FROM=NexusCRM <noreply@nexuscrm.io>
```

Emails sent:
- Password reset link
- Lead assigned to rep notification  
- New contact form submission alert

If SMTP is not configured, emails are silently skipped (logged as warnings).

---

## 🚢 Deployment

### Environment variables for production

```env
NODE_ENV=production
MONGO_URI=mongodb+srv://...
JWT_SECRET=<min 32 char random string>
JWT_REFRESH_SECRET=<different min 32 char random string>
CORS_ORIGINS=https://your-frontend.com
```

### Docker (example)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY src/ ./src/
EXPOSE 5000
CMD ["node", "src/server.js"]
```

### Recommended platforms
- **Railway** / **Render** — push-to-deploy with free MongoDB Atlas tier  
- **Fly.io** — zero-downtime deploys  
- **AWS EC2 / ECS** — production scale  

---

## 🌱 Seeder Credentials (after `npm run seed`)

| Role       | Email                  | Password      |
|------------|------------------------|---------------|
| Admin      | admin@nexuscrm.io      | Admin@1234!   |
| Manager    | carol@nexuscrm.io      | Rep@1234!     |
| Sales Rep  | alice@nexuscrm.io      | Rep@1234!     |
| Sales Rep  | bob@nexuscrm.io        | Rep@1234!     |
| Sales Rep  | david@nexuscrm.io      | Rep@1234!     |

---

## 📄 License

MIT © NexusCRM
