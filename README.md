# SMART SOCIETY MANAGEMENT SYSTEM

A comprehensive full-stack web application for managing residential society operations including complaints, maintenance, facility bookings, visitor management, and administrative oversight.

## 🌟 Features

### 🔐 **Multi-Role Authentication**
- **Admin**: Full system access and management
- **Security Staff**: Visitor management and access control
- **Residents**: Complaint submission, facility booking, payment tracking

### 🏢 **Core Modules**
- **Complaints Management**: Submit, track, and resolve resident complaints
- **Facility Bookings**: Book community facilities with approval workflow
- **Maintenance & Payments**: Track maintenance invoices and payments
- **Visitor Management**: Security staff can approve/deny visitor access
- **Notice Board**: Admin can post announcements for residents
- **Event Management**: Schedule and manage community events

## 🏗️ Project Structure

```
SMART SOCIETY MANAGEMENT/
├── client/                          # React Frontend
│   ├── public/                      # Static assets
│   ├── src/
│   │   ├── components/              # Reusable UI components
│   │   ├── pages/                   # Page components (AdminDashboard, etc.)
│   │   ├── services/                # API service layer
│   │   ├── utils/                   # Utility functions
│   │   └── styles/                  # Styling files
│   └── package.json
├── server/                          # Node.js Backend
│   ├── config/                      # Database & JWT configuration
│   ├── controllers/                 # Business logic controllers
│   ├── middleware/                  # Authentication & authorization
│   ├── routes/                      # API route handlers
│   ├── database/                    # SQL setup scripts
│   └── package.json
└── README.md
```

## 🚀 Quick Start

### Prerequisites
- **Node.js** (v14 or higher)
- **MySQL** (v8.0 or higher)
- **npm** or **yarn**

### 1. Database Setup

**Option A: Automatic Setup (Recommended)**
```bash
# Start MySQL server and create database
mysql -u root -p
CREATE DATABASE smart_society;
exit;

# Run the setup script
cd server/database
node test-schema.js
```

**Option B: Manual Setup**
```sql
-- Execute the SQL script in MySQL
mysql -u root -p smart_society < server/database/setup.sql
```

### 2. Environment Configuration

```bash
# Copy and configure environment file
cp server/.env.example server/.env

# Edit server/.env with your database credentials
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_secure_jwt_secret_key
```

### 3. Backend Setup

```bash
# Install dependencies
cd server
npm install

# Start the server
npm start
# Server runs on http://localhost:5000
```

### 4. Frontend Setup

```bash
# Install dependencies
cd client
npm install

# Start the development server
npm start
# Frontend runs on http://localhost:3000
```

## 🔐 Default Login Credentials

**Admin Account:**admin@smartsociety.com`
- Email: `
- Password: `admin123`

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Protected Endpoints (Require Authentication)
- `/api/users` - User management
- `/api/complaints` - Complaint management
- `/api/notices` - Notice board
- `/api/events` - Event management
- `/api/facilities` - Facility management
- `/api/facility-bookings` - Booking system
- `/api/maintenance` - Maintenance tracking
- `/api/payments` - Payment processing
- `/api/visitors` - Visitor management

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Role-Based Access Control**: Granular permissions per user type
- **Password Hashing**: bcryptjs for secure password storage
- **Input Validation**: Comprehensive request validation
- **CORS Protection**: Configured cross-origin policies

## 🗄️ Database Schema

The system uses 14 core tables:
- `users` - User accounts and roles
- `residents`, `admins`, `security_staff` - Role-specific data
- `complaints` - Resident complaints
- `notices` - Administrative announcements
- `events` - Community events
- `facilities`, `facility_bookings` - Facility management
- `maintenance_invoices`, `payments` - Financial tracking
- `gate_logs`, `visitors` - Access control
- `flats` - Property information

## 🧪 Testing the Application

1. **Login as Admin**: Use default admin credentials
2. **Create a Notice**: Test admin functionality
3. **Login as Resident**: Register a new resident account
4. **Submit Complaint**: Test resident complaint system
5. **Book Facility**: Test booking workflow

## 🚀 Deployment

### Production Environment Variables
```bash
NODE_ENV=production
DB_HOST=your_production_db_host
DB_PASSWORD=your_secure_db_password
JWT_SECRET=your_production_jwt_secret
```

### Build Commands
```bash
# Backend
cd server && npm run build

# Frontend
cd client && npm run build
```

## 📝 Development Notes

- **Database**: Uses MySQL with connection pooling
- **Frontend**: React with React Router for navigation
- **Backend**: Express.js with middleware architecture
- **Authentication**: JWT tokens with role-based permissions
- **Styling**: Tailwind CSS for responsive design

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@smartsociety.com or create an issue in the repository.

---

**Built with ❤️ for better community management**
