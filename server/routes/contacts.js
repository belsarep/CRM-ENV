import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Get all contact lists
router.get('/lists', authenticateToken, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const lists = await query(`
      SELECT 
        cl.*,
        u.first_name, u.last_name,
        COUNT(clm.contact_id) as contact_count
      FROM contact_lists cl
      LEFT JOIN users u ON cl.created_by = u.id
      LEFT JOIN contact_list_members clm ON cl.id = clm.list_id
      WHERE cl.organization_id = ?
      GROUP BY cl.id
      ORDER BY cl.created_at DESC
    `, [req.user.organizationId]);

    res.json(lists);
  } catch (error) {
    logger.error('Get contact lists error:', error);
    res.status(500).json({ error: 'Failed to fetch contact lists' });
  }
});

// Create contact list
router.post('/lists', authenticateToken, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'List name is required' });
    }

    const result = await query(`
      INSERT INTO contact_lists (organization_id, name, description, created_by)
      VALUES (?, ?, ?, ?)
    `, [req.user.organizationId, name, description, req.user.id]);

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, new_values, ip_address)
      VALUES (?, ?, 'list_created', 'contact_list', ?, ?, ?)
    `, [req.user.organizationId, req.user.id, result.insertId, JSON.stringify({ name, description }), req.ip]);

    res.status(201).json({ id: result.insertId, message: 'List created successfully' });
  } catch (error) {
    logger.error('Create contact list error:', error);
    res.status(500).json({ error: 'Failed to create contact list' });
  }
});

// Get contacts in a list
router.get('/lists/:listId/contacts', authenticateToken, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const { listId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Verify list belongs to organization
    const lists = await query('SELECT id FROM contact_lists WHERE id = ? AND organization_id = ?', [listId, req.user.organizationId]);
    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    const contacts = await query(`
      SELECT 
        c.*,
        clm.added_at,
        (SELECT COUNT(*) FROM email_events WHERE contact_id = c.id AND event_type = 'opened') as total_opens,
        (SELECT COUNT(*) FROM email_events WHERE contact_id = c.id AND event_type = 'clicked') as total_clicks
      FROM contacts c
      JOIN contact_list_members clm ON c.id = clm.contact_id
      WHERE clm.list_id = ?
      ORDER BY clm.added_at DESC
      LIMIT ? OFFSET ?
    `, [listId, limit, offset]);

    const [{ total }] = await query(`
      SELECT COUNT(*) as total
      FROM contacts c
      JOIN contact_list_members clm ON c.id = clm.contact_id
      WHERE clm.list_id = ?
    `, [listId]);

    res.json({
      contacts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Get list contacts error:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// Add contact to list
router.post('/lists/:listId/contacts', authenticateToken, requirePermission('manage_contacts'), async (req, res) => {
  try {
    const { listId } = req.params;
    const { email, firstName, lastName } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Verify list belongs to organization
    const lists = await query('SELECT id FROM contact_lists WHERE id = ? AND organization_id = ?', [listId, req.user.organizationId]);
    if (lists.length === 0) {
      return res.status(404).json({ error: 'List not found' });
    }

    // Check if contact already exists
    let contacts = await query('SELECT id FROM contacts WHERE email = ? AND organization_id = ?', [email, req.user.organizationId]);
    let contactId;

    if (contacts.length === 0) {
      // Create new contact
      const result = await query(`
        INSERT INTO contacts (organization_id, email, first_name, last_name)
        VALUES (?, ?, ?, ?)
      `, [req.user.organizationId, email, firstName, lastName]);
      contactId = result.insertId;
    } else {
      contactId = contacts[0].id;
      // Update contact info if provided
      if (firstName || lastName) {
        await query(`
          UPDATE contacts SET first_name = COALESCE(?, first_name), last_name = COALESCE(?, last_name)
          WHERE id = ?
        `, [firstName, lastName, contactId]);
      }
    }

    // Add to list (ignore if already exists)
    await query(`
      INSERT IGNORE INTO contact_list_members (contact_id, list_id)
      VALUES (?, ?)
    `, [contactId, listId]);

    // Update list contact count
    await query(`
      UPDATE contact_lists SET contact_count = (
        SELECT COUNT(*) FROM contact_list_members WHERE list_id = ?
      ) WHERE id = ?
    `, [listId, listId]);

    res.status(201).json({ message: 'Contact added successfully' });
  } catch (error) {
    logger.error('Add contact error:', error);
    res.status(500).json({ error: 'Failed to add contact' });
  }
});

// Get unsubscribe analytics
router.get('/unsubscribes', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;

    // Get unsubscribe trends
    const trends = await query(`
      SELECT 
        DATE(processed_at) as date,
        COUNT(*) as count,
        method
      FROM unsubscribe_requests
      WHERE organization_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY DATE(processed_at), method
      ORDER BY date
    `, [req.user.organizationId, days]);

    // Get unsubscribe reasons
    const reasons = await query(`
      SELECT reason, COUNT(*) as count
      FROM unsubscribe_requests
      WHERE organization_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      AND reason IS NOT NULL
      GROUP BY reason
      ORDER BY count DESC
    `, [req.user.organizationId, days]);

    // Get compliance metrics
    const [compliance] = await query(`
      SELECT 
        COUNT(*) as total_unsubscribes,
        SUM(CASE WHEN method = 'one_click' THEN 1 ELSE 0 END) as one_click_count,
        AVG(CASE WHEN method = 'one_click' THEN 1 ELSE 0 END) * 100 as one_click_compliance_rate
      FROM unsubscribe_requests
      WHERE organization_id = ? AND processed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [req.user.organizationId, days]);

    res.json({
      trends,
      reasons,
      compliance: {
        totalUnsubscribes: compliance.total_unsubscribes || 0,
        oneClickCount: compliance.one_click_count || 0,
        complianceRate: Math.round((compliance.one_click_compliance_rate || 0) * 100) / 100
      }
    });
  } catch (error) {
    logger.error('Unsubscribe analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch unsubscribe analytics' });
  }
});

export default router;