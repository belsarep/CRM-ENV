# Email Management Platform

A comprehensive, production-ready email management platform with advanced tracking, analytics, and multi-user support.

## 🚀 Features

### Advanced Email Tracking & Analytics
- Real-time tracking of opens, clicks, bounces, and complaints
- Detailed engagement metrics with unique opens/clicks
- Device and location tracking for better insights
- Hourly performance analytics for optimal send times

### Comprehensive Deliverability Reporting
- Deliverability score calculation with reputation analysis
- Domain-specific reputation tracking (Gmail, Outlook, etc.)
- Performance trends and historical data
- Actionable recommendations for improving deliverability
- Compliance monitoring for CAN-SPAM and GDPR

### Strict Unsubscribe Management
- One-click unsubscribe compliance tracking
- Multiple unsubscribe methods (one-click, preference center, manual)
- Detailed reason tracking with custom feedback
- Compliance rate monitoring for legal requirements
- Automatic contact status updates

### Multi-User Support & Role Management
- Role-based access control (Admin, Manager, User)
- Granular permissions system for different features
- User invitation system with expiring tokens
- Organization management with plan-based limits
- Activity tracking and user status management

### Enhanced Security & Compliance
- Permission-based UI rendering - users only see what they can access
- Audit trails for all user actions
- Data isolation by organization
- Compliance dashboards with real-time status

## 🛠️ Technology Stack

### Backend
- **Node.js** with Express.js
- **MySQL** database with optimized schema
- **JWT** authentication with role-based permissions
- **Winston** logging
- **Helmet** security middleware
- **Rate limiting** and CORS protection

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Recharts** for data visualization
- **Lucide React** for icons

### Infrastructure
- **Nginx** reverse proxy with SSL
- **SystemD** service management
- **PM2** process management
- **Let's Encrypt** SSL certificates
- **Log rotation** and automated backups

## 📦 Installation

### Prerequisites
- Ubuntu 20.04+ or similar Linux distribution
- Node.js 18+
- MySQL 8.0+
- Nginx
- Domain name with DNS configured

### Quick Deployment

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd email-management-platform
   ```

2. **Run the deployment script:**
   ```bash
   chmod +x deployment/deploy.sh
   sudo ./deployment/deploy.sh
   ```

3. **Configure SSL:**
   ```bash
   sudo certbot --nginx -d your-domain.com -d www.your-domain.com
   ```

4. **Update configuration:**
   - Edit `/etc/systemd/system/email-platform.service` with your environment variables
   - Update domain name in `/etc/nginx/sites-available/email-platform`
   - Restart services: `sudo systemctl restart email-platform nginx`

### Manual Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Set up database:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Build and start:**
   ```bash
   npm run build
   npm start
   ```

## 🏗️ Database Schema

The platform uses a comprehensive MySQL schema with the following key tables:

- **organizations** - Multi-tenant organization management
- **users** - User accounts with role-based access
- **permissions** & **role_permissions** - Granular permission system
- **contact_lists** & **contacts** - Contact management
- **campaigns** - Email campaign data
- **email_events** - Detailed tracking events
- **unsubscribe_requests** - Compliance tracking
- **deliverability_metrics** - Performance analytics
- **audit_logs** - Security and compliance logging

## 🔐 Security Features

-  **Authentication**: JWT-based with secure token management
- **Authorization**: Role-based access control with granular permissions
- **Data Protection**: Organization-level data isolation
- **Audit Logging**: Comprehensive activity tracking
- **Security Headers**: Helmet.js security middleware
- **Rate Limiting**: Protection against abuse
- **Input Validation**: Comprehensive data validation
- **SQL Injection Protection**: Parameterized queries

## 📊 Analytics & Reporting

### Dashboard Metrics
- Contact statistics and growth trends
- Campaign performance overview
- Engagement rates and trends
- Recent activity feed

### Advanced Analytics
- Deliverability health score
- Domain-specific performance
- Bounce and complaint tracking
- Unsubscribe analysis with reasons
- Compliance monitoring

### Compliance Features
- CAN-SPAM compliance tracking
- GDPR data protection measures
- One-click unsubscribe monitoring
- Audit trail for all actions

## 🚀 Production Deployment

### SystemD Services
The platform includes production-ready SystemD service files:

- `email-platform.service` - Main application service
- `email-platform-frontend.service` - Frontend service management

### Nginx Configuration
Optimized Nginx configuration with:
- SSL/TLS termination
- Gzip compression
- Security headers
- Static file caching
- API proxy configuration

### Monitoring & Maintenance
- Automated log rotation
- Daily database backups
- Health check endpoints
- Performance monitoring
- Error tracking and alerting

## 🔧 Configuration

### Environment Variables
```bash
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_USER=email_platform
DB_PASSWORD=your_secure_password
DB_NAME=email_platform
JWT_SECRET=your_jwt_secret_key
FRONTEND_URL=https://your-domain.com
```

### Database Configuration
The platform supports MySQL with connection pooling and automatic reconnection.

### Email Configuration
Configure SMTP settings for sending emails (implementation depends on your email service provider).

## 📝 API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/change-password` - Change password

### Dashboard Endpoints
- `GET /api/dashboard/overview` - Dashboard metrics
- `GET /api/dashboard/deliverability` - Deliverability analytics

### Contact Management
- `GET /api/contacts/lists` - Get contact lists
- `POST /api/contacts/lists` - Create contact list
- `GET /api/contacts/lists/:id/contacts` - Get contacts in list
- `POST /api/contacts/lists/:id/contacts` - Add contact to list

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the logs in `/opt/email-platform/logs/`
- Check service status: `systemctl status email-platform`
- Review Nginx logs: `/var/log/nginx/email-platform.*.log`

## 🔄 Updates

To update the platform:
1. Pull the latest changes
2. Run `npm install` for new dependencies
3. Run database migrations if needed
4. Restart the service: `sudo systemctl restart email-platform`

---

**Default Login Credentials:**
- Email: `admin@demo.com`
- Password: `admin123`

**⚠️ Important:** Change the default password immediately after deployment!