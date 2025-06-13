-- Email Management Platform Database Schema
-- This file contains the complete database structure for multi-user support

-- Organizations table for multi-tenancy
CREATE TABLE IF NOT EXISTS organizations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  plan VARCHAR(50) DEFAULT 'free',
  contact_limit INT DEFAULT 1000,
  monthly_email_limit INT DEFAULT 10000,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Users table with enhanced role-based access
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('admin', 'manager', 'user') DEFAULT 'user',
  status ENUM('active', 'inactive', 'pending') DEFAULT 'pending',
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  INDEX idx_organization_id (organization_id),
  INDEX idx_email (email),
  INDEX idx_status (status)
);

-- Permissions system for granular access control
CREATE TABLE IF NOT EXISTS permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS role_permissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  role ENUM('admin', 'manager', 'user') NOT NULL,
  permission_id INT NOT NULL,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_role_permission (role, permission_id)
);

-- Contact lists with organization isolation
CREATE TABLE IF NOT EXISTS contact_lists (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  contact_count INT DEFAULT 0,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_organization_id (organization_id)
);

-- Contacts with enhanced tracking and organization isolation
CREATE TABLE IF NOT EXISTS contacts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  status ENUM('active', 'unsubscribed', 'bounced', 'complained') DEFAULT 'active',
  engagement_score DECIMAL(5,2) DEFAULT 0.00,
  last_engagement TIMESTAMP NULL,
  subscription_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unsubscribe_date TIMESTAMP NULL,
  bounce_count INT DEFAULT 0,
  complaint_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY unique_org_email (organization_id, email),
  INDEX idx_organization_id (organization_id),
  INDEX idx_status (status),
  INDEX idx_engagement_score (engagement_score)
);

-- Contact list memberships
CREATE TABLE IF NOT EXISTS contact_list_members (
  id INT PRIMARY KEY AUTO_INCREMENT,
  contact_id INT NOT NULL,
  list_id INT NOT NULL,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
  UNIQUE KEY unique_contact_list (contact_id, list_id)
);

-- Email campaigns with organization isolation
CREATE TABLE IF NOT EXISTS campaigns (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  status ENUM('draft', 'scheduled', 'sending', 'sent', 'cancelled') DEFAULT 'draft',
  send_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  bounce_count INT DEFAULT 0,
  complaint_count INT DEFAULT 0,
  open_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  unsubscribe_count INT DEFAULT 0,
  scheduled_at TIMESTAMP NULL,
  sent_at TIMESTAMP NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_organization_id (organization_id),
  INDEX idx_status (status),
  INDEX idx_sent_at (sent_at)
);

-- Email tracking events with comprehensive data
CREATE TABLE IF NOT EXISTS email_events (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  campaign_id INT,
  contact_id INT NOT NULL,
  event_type ENUM('sent', 'delivered', 'bounced', 'complained', 'opened', 'clicked', 'unsubscribed') NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  user_agent TEXT,
  ip_address VARCHAR(45),
  location VARCHAR(255),
  device_type VARCHAR(50),
  email_client VARCHAR(100),
  bounce_reason TEXT,
  complaint_reason TEXT,
  click_url TEXT,
  metadata JSON,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  INDEX idx_organization_id (organization_id),
  INDEX idx_campaign_id (campaign_id),
  INDEX idx_contact_id (contact_id),
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp)
);

-- Unsubscribe tracking for compliance
CREATE TABLE IF NOT EXISTS unsubscribe_requests (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  contact_id INT NOT NULL,
  campaign_id INT,
  method ENUM('one_click', 'preference_center', 'manual', 'complaint') NOT NULL,
  reason TEXT,
  custom_feedback TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL,
  INDEX idx_organization_id (organization_id),
  INDEX idx_contact_id (contact_id),
  INDEX idx_processed_at (processed_at)
);

-- Deliverability metrics for analytics
CREATE TABLE IF NOT EXISTS deliverability_metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  date DATE NOT NULL,
  domain VARCHAR(100) NOT NULL,
  sent_count INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  bounced_count INT DEFAULT 0,
  complained_count INT DEFAULT 0,
  reputation_score DECIMAL(3,2) DEFAULT 0.00,
  deliverability_rate DECIMAL(5,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY unique_org_date_domain (organization_id, date, domain),
  INDEX idx_organization_date (organization_id, date),
  INDEX idx_domain (domain)
);

-- Audit logs for compliance and security
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  user_id INT,
  action VARCHAR(255) NOT NULL,
  resource_type VARCHAR(100),
  resource_id VARCHAR(100),
  old_values JSON,
  new_values JSON,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_organization_id (organization_id),
  INDEX idx_user_id (user_id),
  INDEX idx_timestamp (timestamp),
  INDEX idx_action (action)
);

-- User invitations for team management
CREATE TABLE IF NOT EXISTS user_invitations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  email VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'user') DEFAULT 'user',
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  invited_by INT NOT NULL,
  accepted_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_token (token),
  INDEX idx_expires_at (expires_at)
);

-- API keys for external integrations
CREATE TABLE IF NOT EXISTS api_keys (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  permissions JSON,
  last_used TIMESTAMP NULL,
  expires_at TIMESTAMP NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_organization_id (organization_id),
  INDEX idx_key_hash (key_hash)
);

-- Organization settings
CREATE TABLE IF NOT EXISTS organization_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  organization_id INT NOT NULL,
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  UNIQUE KEY unique_org_setting (organization_id, setting_key)
);