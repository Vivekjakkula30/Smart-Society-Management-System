-- server/database/setup.sql

CREATE DATABASE smart_society;
USE smart_society;

-- Users table (common for all roles)
CREATE TABLE users (
    id           INT PRIMARY KEY AUTO_INCREMENT,
    user_type    ENUM('admin','resident','security') NOT NULL,
    email        VARCHAR(255) UNIQUE NOT NULL,
    password     VARCHAR(255) NOT NULL,
    full_name    VARCHAR(255) NOT NULL,
    phone        VARCHAR(20),
    shift_timing ENUM('morning','evening','night') NULL,
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP NULL
);


-- Residents table
CREATE TABLE residents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    address TEXT,
    flat_number VARCHAR(20),
    block_name VARCHAR(50),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Admins table
CREATE TABLE admins (
    id INT PRIMARY KEY AUTO_INCREMENT,
    admin_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    role VARCHAR(50) DEFAULT 'admin',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Security staff table
CREATE TABLE security_staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    staff_id VARCHAR(50) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    shift ENUM('morning', 'evening', 'night'),
    is_on_duty BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Complaints table
-- FIX 1: status ENUM updated to match actual DB ('open','in progress','resolved','closed')
-- FIX 2: added resolved_at column
CREATE TABLE complaints (
    id INT PRIMARY KEY AUTO_INCREMENT,
    complaint_id VARCHAR(50) UNIQUE NOT NULL,
    resident_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category ENUM('maintenance', 'security', 'cleanliness', 'other'),
    status ENUM('open', 'in progress', 'resolved', 'closed') DEFAULT 'open',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NULL,
    resolved_at DATETIME NULL,
    FOREIGN KEY (resident_id) REFERENCES residents(id)
);

-- Notices table
-- FIX 3: added valid_till column
-- FIX 4: added audience_type column
CREATE TABLE notices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category ENUM('general', 'maintenance', 'security', 'event', 'payment'),
    posted_by INT NOT NULL,
    is_important BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_till DATE NULL,
    audience_type VARCHAR(30) NULL,
    FOREIGN KEY (posted_by) REFERENCES users(id)
);

-- Notice Recipients table
-- FIX 5: entire table was missing
CREATE TABLE notice_recipients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    notice_id INT NOT NULL,
    resident_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (notice_id) REFERENCES notices(id) ON DELETE CASCADE,
    FOREIGN KEY (resident_id) REFERENCES residents(id) ON DELETE CASCADE
);

-- Facilities table
CREATE TABLE facilities (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    capacity INT,
    available_from TIME,
    available_to TIME,
    booking_fee DECIMAL(10,2) DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Events table
CREATE TABLE events (
    id INT PRIMARY KEY AUTO_INCREMENT,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    event_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    max_attendees INT,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Facility Bookings table
-- FIX 6: added payment_status column
-- FIX 7: added payment_date column
CREATE TABLE facility_bookings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    facility_id INT NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME,
    end_time TIME,
    status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
    total_amount DECIMAL(10,2) DEFAULT 0,
    payment_status ENUM('unpaid', 'paid') DEFAULT 'unpaid',
    payment_date TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id),
    FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

-- Maintenance Invoices table
CREATE TABLE maintenance_invoices (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    month INT NOT NULL,
    year INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    due_date DATE NOT NULL,
    status ENUM('unpaid', 'paid', 'overdue') DEFAULT 'unpaid',
    paid_on DATE NULL,
    payment_method VARCHAR(50),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id)
);

-- Payments table
-- FIX 8: invoice_id changed to NULL-able to match actual DB
CREATE TABLE payments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    invoice_id INT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (resident_id) REFERENCES residents(id),
    FOREIGN KEY (invoice_id) REFERENCES maintenance_invoices(id)
);

-- Gate Logs table (visitor entries/exits)
-- FIX 9: added entry_by_security_id column
CREATE TABLE gate_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    resident_id INT NOT NULL,
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(20),
    visitor_purpose TEXT,
    entry_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    exit_time TIMESTAMP NULL,
    status ENUM('pending', 'approved', 'rejected', 'exited') DEFAULT 'pending',
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    notes TEXT,
    entry_by_security_id INT NULL,
    KEY resident_id (resident_id),
    KEY approved_by (approved_by)
);

-- Visitors table (for tracking visitor patterns)
CREATE TABLE visitors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    email VARCHAR(255),
    address TEXT,
    visit_count INT DEFAULT 1,
    last_visit TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Flats table
-- FIX 10: created_at updated to include ON UPDATE CURRENT_TIMESTAMP
CREATE TABLE flats (
    id INT PRIMARY KEY AUTO_INCREMENT,
    block_name VARCHAR(50) NOT NULL,
    flat_number VARCHAR(20) NOT NULL,
    floor_number INT,
    area_sqm DECIMAL(8,2),
    is_occupied BOOLEAN DEFAULT FALSE,
    resident_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY resident_id (resident_id),
    UNIQUE KEY unique_flat (block_name, flat_number)
);



-- Insert sample admin (password: admin123)
INSERT IGNORE INTO users (user_type, email, password, full_name, phone) 
VALUES ('admin', 'admin@smartsociety.com', '$2a$10$8K1p/a0dRL1//.O6s5b5uO6VZXQd5B3ZcGxZ1Lz3G3b5nY9Vz8JdK', 'System Admin', '9876543210');

INSERT IGNORE INTO admins (admin_id, user_id) 
VALUES ('ADM1001', LAST_INSERT_ID());


-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT          NOT NULL,
  type        VARCHAR(50)  NOT NULL,
  title       VARCHAR(255) NOT NULL,
  message     MEDIUMTEXT   NOT NULL,
  data        MEDIUMTEXT,
  is_read     TINYINT(1)   NOT NULL DEFAULT 0,
  read_at     DATETIME,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notifications_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);