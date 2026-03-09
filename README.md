# Resume Builder Backend API

Secure and scalable Node.js + MongoDB backend for Resume Builder with 19 APIs.

## Stack

- Node.js, Express
- MongoDB with Mongoose
- JWT authentication
- Joi request validation
- Helmet, rate-limit, sanitize, HPP for security
- PDFKit for document export

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev
```

## Environment Variables

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/resume-builder
JWT_ACCESS_SECRET=change_this_access_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_SECRET=change_this_refresh_secret
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=http://localhost:3000
CLIENT_URL=http://localhost:3000
BREVO_API_KEY=your_brevo_api_key
# Backward-compat fallback also supported: BREAVE_MAILER_KEY
SENDER_EMAIL=noreply@yourdomain.com
SENDER_NAME=Resume Builder
ALLOW_DEV_EMAIL_OTP_FALLBACK=true
```

## API Base

- Base URL: `http://localhost:5000`
- Versioned API Prefix: `/v1`

## Implemented Endpoints (19)

### Auth & Session

1. `POST /v1/auth/register` (sends email OTP for verification)
2. `POST /v1/auth/login`
3. `POST /v1/auth/verify-email` (body: `email`, `otp`)
4. `POST /v1/auth/logout`
5. `GET /v1/auth/me`

### Resume CRUD

5. `GET /v1/resumes`
6. `POST /v1/resumes`
7. `GET /v1/resumes/:id`
8. `PATCH /v1/resumes/:id`
9. `DELETE /v1/resumes/:id`

### Cover Letter CRUD

10. `GET /v1/cover-letters`
11. `POST /v1/cover-letters`
12. `GET /v1/cover-letters/:id`
13. `PATCH /v1/cover-letters/:id`
14. `DELETE /v1/cover-letters/:id`

### Templates/Catalog

15. `GET /v1/templates`
16. `GET /v1/template-categories`
17. `GET /v1/resume-examples`

### Document/PDF

18. `POST /v1/documents/resume-pdf`
19. `POST /v1/documents/cover-letter-pdf`

## Response Format

Success:

```json
{
  "success": true,
  "message": "optional",
  "data": {},
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload",
    "details": []
  }
}
```

## Notes

- Resource IDs are public IDs in URL (`resume_xxx`, `cl_xxx`) rather than Mongo ObjectId.
- All resume/cover-letter operations are owner-scoped via JWT.
- `POST /v1/documents/*` returns downloadable PDF files.
- Admin seed endpoints are available under `/v1/admin/seed/*`.
- If `ADMIN_SEED_KEY` is set, send `x-admin-key` header for seed requests.
