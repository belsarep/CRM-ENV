import bcrypt from 'bcryptjs';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';

async function seedDatabase() {
  try {
    logger.info('Starting database seeding...');

    // Create default organization
    const orgResult = await query(`
      INSERT IGNORE INTO organizations (name, plan, contact_limit, monthly_email_limit)
      VALUES ('Demo Organization', 'professional', 10000, 100000)
    `);
    
    const orgId = orgResult.insertId || 1;

    // Create admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    await query(`
      INSERT IGNORE INTO users (organization_id, email, password_hash, first_name, last_name, role, status)
      VALUES (?, 'admin@demo.com', ?, 'Admin', 'User', 'admin', 'active')
    `, [orgId, hashedPassword]);

    // Create permissions
    const permissions = [
      ['view_dashboard', 'View dashboard and basic metrics'],
      ['manage_contacts', 'Create and manage contact lists'],
      ['send_campaigns', 'Create and send email campaigns'],
      ['view_analytics', 'Access detailed analytics and reports'],
      ['manage_users', 'Invite and manage team members'],
      ['manage_organization', 'Manage organization settings and billing'],
      ['view_audit_logs', 'Access audit logs and compliance data']
    ];

    for (const [name, description] of permissions) {
      await query(`
        INSERT IGNORE INTO permissions (name, description)
        VALUES (?, ?)
      `, [name, description]);
    }

    // Assign permissions to roles
    const rolePermissions = [
      ['admin', ['view_dashboard', 'manage_contacts', 'send_campaigns', 'view_analytics', 'manage_users', 'manage_organization', 'view_audit_logs']],
      ['manager', ['view_dashboard', 'manage_contacts', 'send_campaigns', 'view_analytics', 'manage_users']],
      ['user', ['view_dashboard', 'manage_contacts', 'send_campaigns']]
    ];

    for (const [role, perms] of rolePermissions) {
      for (const perm of perms) {
        const permResult = await query('SELECT id FROM permissions WHERE name = ?', [perm]);
        if (permResult.length > 0) {
          await query(`
            INSERT IGNORE INTO role_permissions (role, permission_id)
            VALUES (?, ?)
          `, [role, permResult[0].id]);
        }
      }
    }

    // Create sample contact list
    await query(`
      INSERT IGNORE INTO contact_lists (organization_id, name, description, created_by)
      VALUES (?, 'Newsletter Subscribers', 'Main newsletter subscriber list', 1)
    `, [orgId]);

    // Create sample contacts
    const sampleContacts = [
      ['john.doe@example.com', 'John', 'Doe'],
      ['jane.smith@example.com', 'Jane', 'Smith'],
      ['bob.johnson@example.com', 'Bob', 'Johnson'],
      ['alice.brown@example.com', 'Alice', 'Brown'],
      ['charlie.davis@example.com', 'Charlie', 'Davis']
    ];

    for (const [email, firstName, lastName] of sampleContacts) {
      const contactResult = await query(`
        INSERT IGNORE INTO contacts (organization_id, email, first_name, last_name, engagement_score)
        VALUES (?, ?, ?, ?, ?)
      `, [orgId, email, firstName, lastName, Math.random() * 100]);

      if (contactResult.insertId) {
        await query(`
          INSERT IGNORE INTO contact_list_members (contact_id, list_id)
          VALUES (?, 1)
        `, [contactResult.insertId]);
      }
    }

    logger.info('Database seeding completed successfully');
    logger.info('Default admin user: admin@demo.com / admin123');
    
  } catch (error) {
    logger.error('Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();