import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export function generateToken(user) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      organizationId: user.organization_id 
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const users = await query(
      'SELECT * FROM users WHERE id = ? AND status = "active"',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(403).json({ error: 'User not found or inactive' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
}

export function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
}

export function requirePermission(permission) {
  return async (req, res, next) => {
    try {
      const permissions = await query(`
        SELECT p.name FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN users u ON u.role = rp.role
        WHERE u.id = ?
      `, [req.user.id]);

      const userPermissions = permissions.map(p => p.name);
      
      if (!userPermissions.includes(permission)) {
        return res.status(403).json({ error: 'Permission denied' });
      }

      next();
    } catch (error) {
      logger.error('Permission check failed:', error);
      return res.status(500).json({ error: 'Permission verification failed' });
    }
  };
}