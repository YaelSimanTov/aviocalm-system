# AvioCalm Backend - Modular Structure

## Folder Structure (kebab-case convention)

```
backend/
├── config/
│   └── db.js                    # Database connection (PostgreSQL port 5433)
├── controllers/
│   └── auth-controller.js      # Authentication logic
├── middleware/
│   └── auth-middleware.js       # JWT verification & role-based access
├── routes/
│   ├── auth-routes.js          # /api/auth/* endpoints
│   └── owner-routes.js         # /api/owner/* endpoints (protected)
├── server.js                    # Main Express server
├── schema.sql                   # Database schema (snake_case columns)
├── .env                         # Environment variables
└── package.json                 # Dependencies
```

## API Endpoints

### Authentication Routes
- `POST /api/auth/login` - User login with JWT response

### Owner Routes (Protected)
- `GET /api/owner/dashboard` - Owner dashboard (requires Owner role)

### System Routes
- `GET /api/health` - Health check endpoint

## Security Features
- ✅ JWT token-based authentication
- ✅ Role-based access control (Owner/Therapist)
- ✅ bcrypt password hashing
- ✅ Protected routes with middleware

## Database Configuration
- **Port**: 5433
- **Database**: aviocalm
- **Convention**: snake_case for all DB columns
- **Connection**: Managed via config/db.js

## Naming Conventions
- **Files**: kebab-case (auth-controller.js)
- **Variables/Functions**: camelCase (authenticateToken)
- **Database**: snake_case (user_id, first_name)

## Testing Status
- ✅ Login endpoint working
- ✅ JWT token generation
- ✅ Owner route protection
- ✅ Database connectivity

## Ready for Frontend Integration
The modular backend is ready for Step 3 - Frontend React setup with login page and Owner Dashboard integration.
