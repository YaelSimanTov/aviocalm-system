# AvioCalm Backend API Test Guide

## Server Status
✅ **Server Running**: http://localhost:5000

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

## Postman Collection Setup

1. **Create New Request**
   - Method: POST
   - URL: http://localhost:5000/api/auth/login
   - Headers: Content-Type = application/json
   - Body: raw JSON with the credentials above

2. **Test the Health Endpoint**
   - Method: GET
   - URL: http://localhost:5000/api/health

## Owner Routes Structure
Future owner endpoints will follow the pattern:
- `/api/owner/dashboard`
- `/api/owner/therapists`
- `/api/owner/analytics`

## Database Connection
✅ **Connected**: PostgreSQL on port 5433
✅ **Database**: aviocalm
✅ **Admin User**: Created and ready for testing

## Next Steps
1. Test login with Postman using the credentials above
2. Verify JWT token is returned
3. Proceed to Frontend setup (Step 3)
