# AvioCalm Backend API Test Guide

## Server Status
✅ **Server Running**: http://localhost:5000

## Starting the Server

### Quick Start
```bash
# Navigate to backend directory
cd backend

# Start the server (development mode)
npm run dev

# Or production mode
npm start
```

The server entry point is now located at `src/server.js`.

## Authentication Endpoints

### POST /api/auth/login
**URL**: `http://localhost:5000/api/auth/login`

**Headers**:
```
Content-Type: application/json
```

**Body** (JSON):
```json
{
    "username": "admin",
    "password": "Admin123!"
}
```

**Expected Response**:
```json
{
    "success": true,
    "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
            "userId": "5ed3ea3d-ed86-414a-aa9d-b300a8050a71",
            "username": "admin",
            "role": "Owner",
            "firstName": "System",
            "lastName": "Administrator",
            "isFirstLogin": false
        }
    }
}
```

### POST /api/auth/change-password
**URL**: `http://localhost:5000/api/auth/change-password`

**Headers**:
```
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>
```

**Body** (JSON):
```json
{
    "oldPassword": "Admin123!",
    "newPassword": "NewPassword123!"
}
```

## Protected Routes (Require JWT Token)

### GET /api/health
**URL**: `http://localhost:5000/api/health`

**Expected Response**:
```json
{
    "success": true,
    "data": {
        "status": "Server running",
        "timestamp": "2026-03-04T16:34:20.445Z"
    }
}
```

### GET /api/owner/dashboard
**URL**: `http://localhost:5000/api/owner/dashboard`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Expected Response**:
```json
{
    "success": true,
    "data": {
        "message": "Owner dashboard - to be implemented",
        "user": {
            "userId": "...",
            "username": "admin",
            "role": "Owner"
        }
    }
}
```

### GET /api/patients
**URL**: `http://localhost:5000/api/patients`

**Headers**:
```
Authorization: Bearer <JWT_TOKEN>
```

**Expected Response**:
```json
{
    "success": true,
    "data": [
        {
            "id": "...",
            "full_name": "John Doe",
            "national_id": "123456789",
            "phobia_type": "Flight",
            "created_at": "2026-03-04T16:34:20.445Z"
        }
    ]
}
```

## Database Management Scripts

### Setup Admin User
```bash
# Create admin user (run from backend directory)
node scripts/create-admin.js
```

### Create Therapist User
```bash
# Create therapist for testing
node scripts/create-therapist-user.js

# Or create a new therapist with first login required
node scripts/create-new-therapist-user.js
```

### Verification Scripts
```bash
# Check admin password hash
node scripts/check-hash.js

# Verify therapist user creation
node scripts/verify-therapist-user.js

# Check therapist first login status
node scripts/check-therapist-first-login.js
```

## Postman Collection Setup

### 1. Authentication Request
- **Method**: POST
- **URL**: http://localhost:5000/api/auth/login
- **Headers**: Content-Type = application/json
- **Body**: raw JSON with admin credentials

### 2. Protected Routes
- **Method**: GET
- **URL**: http://localhost:5000/api/owner/dashboard
- **Headers**: 
  - Content-Type = application/json
  - Authorization = Bearer {{token}} (use Postman variables)

### 3. Patients Management
- **GET**: http://localhost:5000/api/patients
- **POST**: http://localhost:5000/api/patients (Therapist role only)

## WebSocket Testing

### Test Watch Connection
```bash
# Test WebSocket vitals transmission
node scripts/test-watch.js
```

This simulates a Samsung Watch sending vitals data to the server.

## Database Connection
✅ **Connected**: PostgreSQL on port 5433
✅ **Database**: aviocalm
✅ **Schema**: Located at `src/db/schema.sql`
✅ **Admin User**: Created and ready for testing

## Error Handling

### Common Error Responses
```json
{
    "success": false,
    "error": "Invalid username or password"
}
```

```json
{
    "success": false,
    "error": "Access token required"
}
```

```json
{
    "success": false,
    "error": "Insufficient permissions"
}
```

## Testing Checklist

- [ ] Server starts without errors (`npm run dev`)
- [ ] Health endpoint responds correctly
- [ ] Admin login works and returns JWT token
- [ ] Protected routes require authentication
- [ ] Role-based access control functions
- [ ] Patients CRUD operations work
- [ ] WebSocket connection accepts data
- [ ] Database scripts execute successfully

## Next Steps
1. Test all endpoints with Postman
2. Verify JWT token authentication flow
3. Test role-based access control
4. Proceed to Frontend integration
