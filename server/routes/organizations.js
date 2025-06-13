import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Get organization details
router.get('/', authenticateToken, async (req, res) => {
  try {
    const organizations = await query(`
      SELECT 
        o.*,
        COUNT(DISTINCT u.id) as user_count,
        COUNT(DISTINCT c.id) as contact_count,
        COUNT(DISTINCT cam.id) as campaign_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id AND u.status = 'active'
      LEFT JOIN contacts c ON o.id = c.organization_id
      LEFT JOIN campaigns cam ON o.id = cam.organization_id
      WHERE o.id = ?
      GROUP BY o.id
    `, [req.user.organizationId]);

    if (organizations.length === 0) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organizations[0]);
  } catch (error) {
    logger.error('Get organization error:', error);
    res.status(500).json({ error: 'Failed to fetch organization details' });
  }
});

// Update organization settings
router.put('/', authenticateToken, requirePermission('manage_organization'), async (req, res) => {
  try {
    const { name, plan } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Organization name is required' });
    }

    // Get current values for audit log
    const currentOrg = await query(
      'SELECT name, plan FROM organizations WHERE id = ?',
      [req.user.organizationId]
    );

    // Update organization
    await query(
      'UPDATE organizations SET name = ?, plan = ? WHERE id = ?',
      [name, plan, req.user.organizationId]
    );

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address)
      VALUES (?, ?, 'organization_updated', 'organization', ?, ?, ?, ?)
    `, [
      req.user.organizationId, 
      req.user.id, 
      req.user.organizationId,
      JSON.stringify(currentOrg[0]),
      JSON.stringify({ name, plan }),
      req.ip
    ]);

    res.json({ message: 'Organization updated successfully' });
  } catch (error) {
    logger.error('Update organization error:', error);
    res.status(500).json({ error: 'Failed to update organization' });
  }
});

// Get organization settings
router.get('/settings', authenticateToken, requirePermission('manage_organization'), async (req, res) => {
  try {
    const settings = await query(
      'SELECT setting_key, setting_value FROM organization_settings WHERE organization_id = ?',
      [req.user.organizationId]
    );

    const settingsObj = {};
    settings.forEach(setting => {
      settingsObj[setting.setting_key] = setting.setting_value;
    });

    res.json(settingsObj);
  } catch (error) {
    logger.error('Get organization settings error:', error);
    res.status(500).json({ error: 'Failed to fetch organization settings' });
  }
});

// Update organization settings
router.put('/settings', authenticateToken, requirePermission('manage_organization'), async (req, res) => {
  try {
    const settings = req.body;

    for (const [key, value] of Object.entries(settings)) {
      await query(`
        INSERT INTO organization_settings (organization_id, setting_key, setting_value)
        VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
      `, [req.user.organizationId, key, value]);
    }

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, new_values, ip_address)
      VALUES (?, ?, 'settings_updated', 'organization_settings', ?, ?)
    `, [req.user.organizationId, req.user.id, JSON.stringify(settings), req.ip]);

    res.json({ message: 'Settings updated successfully' });
  } catch (error) {
    logger.error('Update organization settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Get organization usage statistics
router.get('/usage', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const [usage] = await query(`
      SELECT 
        o.contact_limit,
        o.monthly_email_limit,
        COUNT(DISTINCT c.id) as current_contacts,
        COALESCE(SUM(cam.send_count), 0) as emails_sent_this_month
      FROM organizations o
      LEFT JOIN contacts c ON o.id = c.organization_id AND c.status = 'active'
      LEFT JOIN campaigns cam ON o.id = cam.organization_id 
        AND cam.sent_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
      WHERE o.id = ?
      GROUP BY o.id
    `, [req.user.organizationId]);

    const usagePercentages = {
      contacts: usage.contact_limit > 0 ? (usage.current_contacts / usage.contact_limit * 100) : 0,
      emails: usage.monthly_email_limit > 0 ? (usage.emails_sent_this_month / usage.monthly_email_limit * 100) : 0
    };

    res.json({
      ...usage,
      usage_percentages: usagePercentages
    });
  } catch (error) {
    logger.error('Get organization usage error:', error);
    res.status(500).json({ error: 'Failed to fetch usage statistics' });
  }
});

// Get audit logs
router.get('/audit-logs', authenticateToken, requirePermission('view_audit_logs'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const logs = await query(`
      SELECT 
        al.*,
        u.first_name, u.last_name, u.email
      FROM audit_logs al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE al.organization_id = ?
      ORDER BY al.timestamp DESC
      LIMIT ? OFFSET ?
    `, [req.user.organizationId, limit, offset]);

    const [{ total }] = await query(
      'SELECT COUNT(*) as total FROM audit_logs WHERE organization_id = ?',
      [req.user.organizationId]
    );

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

export default router;