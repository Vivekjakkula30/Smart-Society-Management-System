# Authentication Middleware Documentation

This directory contains authentication and authorization middleware for the Smart Society Management System.

## Files

- `authMiddleware.js` - JWT token verification
- `roleMiddleware.js` - Role-based access control
- `index.js` - Central export for all middleware

## Usage

### 1. Basic Authentication

Protect a route to require authentication:

```javascript
const { authenticate } = require('../middleware');

router.get('/protected-route', authenticate, (req, res) => {
  // req.user is now available with: id, email, role, name
  res.json({ message: 'Protected route', user: req.user });
});
```

### 2. Role-Based Access Control

Require specific role(s):

```javascript
const { authenticate, requireAdmin } = require('../middleware');

// Admin only route
router.get('/admin-only', authenticate, requireAdmin, (req, res) => {
  res.json({ message: 'Admin only route' });
});
```

Multiple roles:

```javascript
const { authenticate, requireRole } = require('../middleware');

// Admin or Security only
router.get('/admin-or-security', 
  authenticate, 
  requireRole('admin', 'security'), 
  (req, res) => {
    res.json({ message: 'Admin or Security route' });
  }
);
```

### 3. Common Patterns

#### Admin Only Routes
```javascript
const { authenticate, requireAdmin } = require('../middleware');

router.post('/admin/create', authenticate, requireAdmin, handler);
router.put('/admin/update/:id', authenticate, requireAdmin, handler);
router.delete('/admin/delete/:id', authenticate, requireAdmin, handler);
```

#### Resident Only Routes
```javascript
const { authenticate, requireResident } = require('../middleware');

router.get('/resident/complaints', authenticate, requireResident, handler);
router.post('/resident/complaints', authenticate, requireResident, handler);
```

#### Security Only Routes
```javascript
const { authenticate, requireSecurity } = require('../middleware');

router.post('/security/visitors', authenticate, requireSecurity, handler);
router.get('/security/visitors', authenticate, requireSecurity, handler);
```

#### Own Resource or Admin
```javascript
const { authenticate, requireOwnershipOrAdmin } = require('../middleware');

router.get('/users/:id', authenticate, requireOwnershipOrAdmin, handler);
router.put('/users/:id', authenticate, requireOwnershipOrAdmin, handler);
```

### 4. Optional Authentication

For routes that work with or without authentication:

```javascript
const { authenticateOptional } = require('../middleware');

router.get('/public-data', authenticateOptional, (req, res) => {
  if (req.user) {
    // User is authenticated, show personalized content
    res.json({ data: 'personalized', user: req.user });
  } else {
    // User is not authenticated, show public content
    res.json({ data: 'public' });
  }
});
```

## Request Object

After authentication, `req.user` contains:

```javascript
{
  id: 1,
  email: 'user@example.com',
  role: 'resident', // 'admin' | 'resident' | 'security'
  name: 'John Doe'
}
```

## Error Responses

### 401 Unauthorized
```json
{
  "success": false,
  "message": "No token provided. Authorization header required."
}
```

### 401 Token Expired
```json
{
  "success": false,
  "message": "Token has expired. Please login again."
}
```

### 403 Forbidden (Wrong Role)
```json
{
  "success": false,
  "message": "Access denied. Required role: admin",
  "userRole": "resident"
}
```

## Frontend Integration

The frontend should send the token in the Authorization header:

```javascript
// Using axios
axios.get('/api/protected-route', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Or set as default header
axios.defaults.headers.common['Authorization'] = `Bearer ${localStorage.getItem('token')}`;
```

## Migration Guide

To add authentication to existing routes:

### Before:
```javascript
router.get('/complaints', async (req, res) => {
  // Route logic
});
```

### After:
```javascript
const { authenticate } = require('../middleware');

router.get('/complaints', authenticate, async (req, res) => {
  // req.user.id is available
  // Route logic
});
```

### For Admin Routes:
```javascript
const { authenticate, requireAdmin } = require('../middleware');

router.post('/complaints/:id/status', authenticate, requireAdmin, async (req, res) => {
  // Route logic
});
```







