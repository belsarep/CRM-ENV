import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Get all users in organization
router.get('/', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const users = await query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.role, u.status, 
        u.last_login, u.created_at,
        (SELECT COUNT(*) FROM campaigns WHERE created_by = u.id) as campaign_count
      FROM users u
      WHERE u.organization_id = ?
      ORDER BY u.created_at DESC
    `, [req.user.organizationId]);

    res.json(users);
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Invite user
router.post('/invite', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { email, role = 'user' } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Check if user already exists
    const existingUsers = await query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Check if invitation already exists
    const existingInvitations = await query(
      'SELECT id FROM user_invitations WHERE email = ? AND organization_id = ? AND accepted_at IS NULL AND expires_at > NOW()',
      [email, req.user.organizationId]
    );

    if (existingInvitations.length > 0) {
      return res.status(400).json({ error: 'Invitation already sent to this email' });
    }

    // Create invitation
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await query(`
      INSERT INTO user_invitations (organization_id, email, role, token, expires_at, invited_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.user.organizationId, email, role, token, expiresAt, req.user.id]);

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, new_values, ip_address)
      VALUES (?, ?, 'user_invited', 'user_invitation', ?, ?)
    `, [req.user.organizationId, req.user.id, JSON.stringify({ email, role }), req.ip]);

    res.status(201).json({ 
      message: 'User invitation sent successfully',
      invitationToken: token // In production, send this via email
    });
  } catch (error) {
    logger.error('Invite user error:', error);
    res.status(500).json({ error: 'Failed to invite user' });
  }
});

// Accept invitation
router.post('/accept-invitation', async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;

    if (!token || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Find valid invitation
    const invitations = await query(`
      SELECT ui.*, o.name as organization_name
      FROM user_invitations ui
      JOIN organizations o ON ui.organization_id = o.id
      WHERE ui.token = ? AND ui.accepted_at IS NULL AND ui.expires_at > NOW()
    `, [token]);

    if (invitations.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const invitation = invitations[0];

    // Create user account
    const hashedPassword = await bcrypt.hash(password, 12);
    const userResult = await query(`
      INSERT INTO users (organization_id, email, password_hash, first_name, last_name, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [invitation.organization_id, invitation.email, hashedPassword, firstName, lastName, invitation.role]);

    // Mark invitation as accepted
    await query(
      'UPDATE user_invitations SET accepted_at = NOW() WHERE id = ?',
      [invitation.id]
    );

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, new_values)
      VALUES (?, ?, 'user_registered', 'user', ?, ?)
    `, [invitation.organization_id, userResult.insertId, userResult.insertId, JSON.stringify({ email: invitation.email, role: invitation.role })]);

    res.json({ message: 'Account created successfully' });
  } catch (error) {
    logger.error('Accept invitation error:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

// Update user role
router.put('/:userId/role', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['admin', 'manager', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Verify user belongs to organization
    const users = await query(
      'SELECT id, role as current_role FROM users WHERE id = ? AND organization_id = ?',
      [userId, req.user.organizationId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const oldRole = users[0].current_role;

    // Update role
    await query(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_values, new_values, ip_address)
      VALUES (?, ?, 'user_role_updated', 'user', ?, ?, ?, ?)
    `, [req.user.organizationId, req.user.id, userId, JSON.stringify({ role: oldRole }), JSON.stringify({ role }), req.ip]);

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    logger.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Deactivate user
router.put('/:userId/deactivate', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify user belongs to organization and is not the current user
    const users = await query(
      'SELECT id, status FROM users WHERE id = ? AND organization_id = ?',
      [userId, req.user.organizationId]
    );

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (parseInt(userId) === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Update status
    await query(
      'UPDATE users SET status = "inactive" WHERE id = ?',
      [userId]
    );

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, new_values, ip_address)
      VALUES (?, ?, 'user_deactivated', 'user', ?, ?, ?)
    `, [req.user.organizationId, req.user.id, userId, JSON.stringify({ status: 'inactive' }), req.ip]);

    res.json({ message: 'User deactivated successfully' });
  } catch (error) {
    logger.error('Deactivate user error:', error);
    res.status(500).json({ error: 'Failed to deactivate user' });
  }
});

// Get pending invitations
router.get('/invitations', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const invitations = await query(`
      SELECT 
        ui.id, ui.email, ui.role, ui.created_at, ui.expires_at,
        u.first_name, u.last_name
      FROM user_invitations ui
      JOIN users u ON ui.invited_by = u.id
      WHERE ui.organization_id = ? AND ui.accepted_at IS NULL AND ui.expires_at > NOW()
      ORDER BY ui.created_at DESC
    `, [req.user.organizationId]);

    res.json(invitations);
  } catch (error) {
    logger.error('Get invitations error:', error);
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

// Cancel invitation
router.delete('/invitations/:invitationId', authenticateToken, requirePermission('manage_users'), async (req, res) => {
  try {
    const { invitationId } = req.params;

    // Verify invitation belongs to organization
    const invitations = await query(
      'SELECT id, email FROM user_invitations WHERE id = ? AND organization_id = ?',
      [invitationId, req.user.organizationId]
    );

    if (invitations.length === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Delete invitation
    await query('DELETE FROM user_invitations WHERE id = ?', [invitationId]);

    // Log audit trail
    await query(`
      INSERT INTO audit_logs (organization_id, user_id, action, resource_type, resource_id, old_values, ip_address)
      VALUES (?, ?, 'invitation_cancelled', 'user_invitation', ?, ?, ?)
    `, [req.user.organizationId, req.user.id, invitationId, JSON.stringify({ email: invitations[0].email }), req.ip]);

    res.json({ message: 'Invitation cancelled successfully' });
  } catch (error) {
    logger.error('Cancel invitation error:', error);
    res.status(500).json({ error: 'Failed to cancel invitation' });
  }
});

export default router;