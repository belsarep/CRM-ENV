import express from 'express';
import { query } from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { logger } from '../config/logger.js';

const router = express.Router();

// Get dashboard overview
router.get('/overview', authenticateToken, requirePermission('view_dashboard'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;

    // Get basic metrics
    const [contacts] = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'unsubscribed' THEN 1 ELSE 0 END) as unsubscribed,
        SUM(CASE WHEN status = 'bounced' THEN 1 ELSE 0 END) as bounced
      FROM contacts WHERE organization_id = ?
    `, [orgId]);

    const [campaigns] = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(send_count) as total_sent,
        SUM(delivered_count) as total_delivered,
        SUM(open_count) as total_opens,
        SUM(click_count) as total_clicks
      FROM campaigns WHERE organization_id = ?
    `, [orgId]);

    // Calculate rates
    const deliveryRate = campaigns.total_sent > 0 ? (campaigns.total_delivered / campaigns.total_sent * 100) : 0;
    const openRate = campaigns.total_delivered > 0 ? (campaigns.total_opens / campaigns.total_delivered * 100) : 0;
    const clickRate = campaigns.total_delivered > 0 ? (campaigns.total_clicks / campaigns.total_delivered * 100) : 0;

    // Get recent activity
    const recentActivity = await query(`
      SELECT 
        ee.event_type,
        ee.timestamp,
        c.email as contact_email,
        cam.name as campaign_name
      FROM email_events ee
      LEFT JOIN contacts c ON ee.contact_id = c.id
      LEFT JOIN campaigns cam ON ee.campaign_id = cam.id
      WHERE ee.organization_id = ?
      ORDER BY ee.timestamp DESC
      LIMIT 10
    `, [orgId]);

    // Get engagement trends (last 30 days)
    const engagementTrends = await query(`
      SELECT 
        DATE(timestamp) as date,
        COUNT(CASE WHEN event_type = 'opened' THEN 1 END) as opens,
        COUNT(CASE WHEN event_type = 'clicked' THEN 1 END) as clicks,
        COUNT(CASE WHEN event_type = 'unsubscribed' THEN 1 END) as unsubscribes
      FROM email_events
      WHERE organization_id = ? AND timestamp >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(timestamp)
      ORDER BY date
    `, [orgId]);

    // Get top performing campaigns
    const topCampaigns = await query(`
      SELECT 
        name,
        send_count,
        open_count,
        click_count,
        (open_count / NULLIF(send_count, 0) * 100) as open_rate,
        (click_count / NULLIF(send_count, 0) * 100) as click_rate
      FROM campaigns
      WHERE organization_id = ? AND status = 'sent'
      ORDER BY open_rate DESC
      LIMIT 5
    `, [orgId]);

    res.json({
      contacts: {
        total: contacts.total || 0,
        active: contacts.active || 0,
        unsubscribed: contacts.unsubscribed || 0,
        bounced: contacts.bounced || 0
      },
      campaigns: {
        total: campaigns.total || 0,
        sent: campaigns.sent || 0,
        totalSent: campaigns.total_sent || 0,
        totalDelivered: campaigns.total_delivered || 0,
        totalOpens: campaigns.total_opens || 0,
        totalClicks: campaigns.total_clicks || 0,
        deliveryRate: Math.round(deliveryRate * 100) / 100,
        openRate: Math.round(openRate * 100) / 100,
        clickRate: Math.round(clickRate * 100) / 100
      },
      recentActivity,
      engagementTrends,
      topCampaigns
    });

  } catch (error) {
    logger.error('Dashboard overview error:', error);
    res.status(500).json({ error: 'Failed to load dashboard data' });
  }
});

// Get deliverability metrics
router.get('/deliverability', authenticateToken, requirePermission('view_analytics'), async (req, res) => {
  try {
    const orgId = req.user.organizationId;
    const days = parseInt(req.query.days) || 30;

    // Get deliverability trends
    const deliverabilityTrends = await query(`
      SELECT 
        date,
        SUM(sent_count) as sent,
        SUM(delivered_count) as delivered,
        SUM(bounced_count) as bounced,
        SUM(complained_count) as complained,
        AVG(deliverability_rate) as avg_deliverability_rate,
        AVG(reputation_score) as avg_reputation_score
      FROM deliverability_metrics
      WHERE organization_id = ? AND date >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY date
      ORDER BY date
    `, [orgId, days]);

    // Get domain-specific metrics
    const domainMetrics = await query(`
      SELECT 
        domain,
        SUM(sent_count) as sent,
        SUM(delivered_count) as delivered,
        SUM(bounced_count) as bounced,
        AVG(reputation_score) as reputation_score,
        AVG(deliverability_rate) as deliverability_rate
      FROM deliverability_metrics
      WHERE organization_id = ? AND date >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY domain
      ORDER BY sent DESC
    `, [orgId, days]);

    // Calculate overall health score
    const totalSent = domainMetrics.reduce((sum, d) => sum + d.sent, 0);
    const totalDelivered = domainMetrics.reduce((sum, d) => sum + d.delivered, 0);
    const totalBounced = domainMetrics.reduce((sum, d) => sum + d.bounced, 0);
    
    const deliverabilityScore = totalSent > 0 ? (totalDelivered / totalSent * 100) : 0;
    const bounceRate = totalSent > 0 ? (totalBounced / totalSent * 100) : 0;
    
    let healthScore = 100;
    if (bounceRate > 5) healthScore -= 20;
    if (bounceRate > 10) healthScore -= 30;
    if (deliverabilityScore < 95) healthScore -= 10;
    if (deliverabilityScore < 90) healthScore -= 20;

    res.json({
      healthScore: Math.max(0, Math.round(healthScore)),
      deliverabilityScore: Math.round(deliverabilityScore * 100) / 100,
      bounceRate: Math.round(bounceRate * 100) / 100,
      trends: deliverabilityTrends,
      domainMetrics
    });

  } catch (error) {
    logger.error('Deliverability metrics error:', error);
    res.status(500).json({ error: 'Failed to load deliverability data' });
  }
});

export default router;