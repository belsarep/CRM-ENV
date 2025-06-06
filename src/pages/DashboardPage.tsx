import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Mail, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  Eye,
  MousePointer,
  UserMinus,
  Activity
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useAuth } from '../hooks/useAuth';

interface DashboardData {
  contacts: {
    total: number;
    active: number;
    unsubscribed: number;
    bounced: number;
  };
  campaigns: {
    total: number;
    sent: number;
    totalSent: number;
    totalDelivered: number;
    totalOpens: number;
    totalClicks: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
  };
  recentActivity: Array<{
    event_type: string;
    timestamp: string;
    contact_email: string;
    campaign_name: string;
  }>;
  engagementTrends: Array<{
    date: string;
    opens: number;
    clicks: number;
    unsubscribes: number;
  }>;
  topCampaigns: Array<{
    name: string;
    send_count: number;
    open_rate: number;
    click_rate: number;
  }>;
}

export default function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch('/api/dashboard/overview', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const dashboardData = await response.json();
        setData(dashboardData);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Failed to load dashboard data</p>
      </div>
    );
  }

  const formatEventType = (type: string) => {
    switch (type) {
      case 'opened': return 'Email Opened';
      case 'clicked': return 'Link Clicked';
      case 'unsubscribed': return 'Unsubscribed';
      case 'bounced': return 'Bounced';
      case 'complained': return 'Complained';
      default: return type;
    }
  };

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'opened': return <Eye className="h-4 w-4 text-blue-600" />;
      case 'clicked': return <MousePointer className="h-4 w-4 text-green-600" />;
      case 'unsubscribed': return <UserMinus className="h-4 w-4 text-red-600" />;
      case 'bounced': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back! Here's your email performance overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Contacts</p>
              <p className="text-2xl font-bold text-gray-900">{data.contacts.total.toLocaleString()}</p>
              <p className="text-sm text-green-600 mt-1">
                {data.contacts.active} active
              </p>
            </div>
            <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Campaigns Sent</p>
              <p className="text-2xl font-bold text-gray-900">{data.campaigns.sent}</p>
              <p className="text-sm text-gray-500 mt-1">
                {data.campaigns.totalSent.toLocaleString()} emails
              </p>
            </div>
            <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Mail className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Open Rate</p>
              <p className="text-2xl font-bold text-gray-900">{data.campaigns.openRate}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {data.campaigns.totalOpens.toLocaleString()} opens
              </p>
            </div>
            <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Eye className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Click Rate</p>
              <p className="text-2xl font-bold text-gray-900">{data.campaigns.clickRate}%</p>
              <p className="text-sm text-gray-500 mt-1">
                {data.campaigns.totalClicks.toLocaleString()} clicks
              </p>
            </div>
            <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <MousePointer className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engagement Trends */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Engagement Trends</h3>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.engagementTrends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="opens" stroke="#3B82F6" strokeWidth={2} name="Opens" />
                <Line type="monotone" dataKey="clicks" stroke="#10B981" strokeWidth={2} name="Clicks" />
                <Line type="monotone" dataKey="unsubscribes" stroke="#EF4444" strokeWidth={2} name="Unsubscribes" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Top Performing Campaigns</h3>
            <Mail className="h-5 w-5 text-gray-400" />
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.topCampaigns.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="open_rate" fill="#3B82F6" name="Open Rate %" />
                <Bar dataKey="click_rate" fill="#10B981" name="Click Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <Clock className="h-5 w-5 text-gray-400" />
        </div>
        <div className="space-y-4">
          {data.recentActivity.slice(0, 8).map((activity, index) => (
            <div key={index} className="flex items-center space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex-shrink-0">
                {getEventIcon(activity.event_type)}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">
                  {formatEventType(activity.event_type)}
                </p>
                <p className="text-sm text-gray-500">
                  {activity.contact_email} • {activity.campaign_name || 'Unknown Campaign'}
                </p>
              </div>
              <div className="text-xs text-gray-400">
                {new Date(activity.timestamp).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}