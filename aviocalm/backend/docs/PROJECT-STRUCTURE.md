# AvioCalm Backend - Modular Structure

## Folder Structure (kebab-case convention)

```
backend/
├── src/                         # Main application code
│   ├── server.js               # Main Express server entry point
│   ├── config/
│   │   └── db.js               # Database connection (PostgreSQL port 5433)
│   ├── controllers/
│   │   ├── auth-controller.js   # Authentication logic
│   │   └── patients-controller.js # Patient management logic
│   ├── middleware/
│   │   └── auth-middleware.js  # JWT verification & role-based access
│   ├── routes/
│   │   ├── auth-routes.js      # /api/auth/* endpoints
│   │   ├── owner-routes.js     # /api/owner/* endpoints (protected)
│   │   └── patients-routes.js  # /api/patients/* endpoints
│   └── db/
│       ├── dbManager.js        # IoT/VR data management
│       └── schema.sql          # Database schema (snake_case columns)
├── scripts/                     # Utility and test scripts
│   ├── schema.sql              # Database schema file
│   ├── create-admin.js          # Admin user creation
│   ├── create-therapist-user.js # Therapist user creation
│   ├── create-new-therapist-user.js # New therapist creation
│   ├── update-admin-password.js # Admin password update
│   ├── check-hash.js           # Hash verification utilities
│   ├── check-stored.js         # Stored data verification
│   ├── check-therapist-first-login.js # First login check
│   ├── verify-therapist-user.js # Therapist verification
│   ├── verify-new-therapist-user.js # New therapist verification
│   └── test-watch.js           # WebSocket testing
├── docs/                        # Documentation
│   ├── PROJECT-STRUCTURE.md    # This file
│   └── test-login.md           # API testing guide
├── .env                         # Environment variables
├── package.json                 # Dependencies and scripts
└── package-lock.json           # Dependency lock file
```

## API Endpoints

### Authentication Routes
- `POST /api/auth/login` - User login with JWT response
- `POST /api/auth/change-password` - Change password (protected)

### Owner Routes (Protected)
- `GET /api/owner/dashboard` - Owner dashboard (requires Owner role)

### Patients Routes (Protected)
- `GET /api/patients` - Get all patients (role-based filtering)
- `GET /api/patients/:id` - Get patient by ID (role-based access)
- `POST /api/patients` - Create new patient (Therapist only)
- `PUT /api/patients/:id` - Update patient (role-based access)

### System Routes
- `GET /api/health` - Health check endpoint

### WebSocket Events
- `vr_system_log` - VR headset system logs
- `watch_vitals_update` - Samsung Watch vitals data
- `vr_status_change` - VR connection status
- `watch_status_change` - Watch connection status
- `distress_alert` - Patient distress alerts

## Security Features
- ✅ JWT token-based authentication
- ✅ Role-based access control (Owner/Therapist)
- ✅ bcrypt password hashing
- ✅ Protected routes with middleware

## Database Configuration
- **Port**: 5433
- **Database**: aviocalm
- **Convention**: snake_case for all DB columns
- **Connection**: Managed via src/config/db.js

## Naming Conventions
- **Files**: kebab-case (auth-controller.js)
- **Variables/Functions**: camelCase (authenticateToken)
- **Database**: snake_case (user_id, first_name)

## Running the Application

### Start the Server
```bash
# Development mode
npm run dev

# Production mode
npm start
```

The server runs on port 5000 by default (configurable via PORT environment variable).

### Utility Scripts
All utility scripts are located in the `scripts/` directory:

#### Database Management
```bash
# Create admin user
node scripts/create-admin.js

# Create therapist user
node scripts/create-therapist-user.js

# Update admin password
node scripts/update-admin-password.js
```

#### Verification & Testing
```bash
# Check stored password hash
node scripts/check-hash.js

# Verify therapist user
node scripts/verify-therapist-user.js

# Test WebSocket connection
node scripts/test-watch.js
```

## Testing Status
- ✅ Login endpoint working
- ✅ JWT token generation
- ✅ Owner route protection
- ✅ Patients CRUD operations
- ✅ Database connectivity
- ✅ WebSocket integration
- ✅ Role-based access control

## Ready for Frontend Integration
The modular backend is fully structured and ready for frontend integration with:
- Complete authentication system
- Patient management APIs
- WebSocket support for real-time data
- Proper error handling and logging
