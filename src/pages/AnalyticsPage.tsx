import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Mail, 
  Eye, 
  MousePointer,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '../hooks/useAuth';

interface DeliverabilityData {
  healthScore: number;
  deliverabilityScore: number;
  bounceRate: number;
  trends: Array<{
    date: string;
    sent: number;
    delivered: number;
    bounced: number;
    complained: number;
    avg_deliverability_rate: number;
    avg_reputation_score: number;
  }>;
  domainMetrics: Array<{
    domain: string;
    sent: number;
    delivered: number;
    bounced: number;
    reputation_score: number;
    deliverability_rate: number;
  }>;
}

interface UnsubscribeData {
  trends: Array<{
    date: string;
    count: number;
    method: string;
  }>;
  reasons: Array<{
    reason: string;
    count: number;
  }>;
  compliance: {
    totalUnsubscribes: number;
    oneClickCount: number;
    complianceRate: number;
  };
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function AnalyticsPage() {
  const { token } = useAuth();
  const [deliverabilityData, setDeliverabilityData] = useState<DeliverabilityData | null>(null);
  const [unsubscribeData, setUnsubscribeData] = useState<UnsubscribeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    fetchAnalyticsData();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      const [deliverabilityResponse, unsubscribeResponse] = await Promise.all([
        fetch(`/api/dashboard/deliverability?days=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }),
        fetch(`/api/contacts/unsubscribes?days=${timeRange}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
      ]);

      if (deliverabilityResponse.ok) {
        const deliverability = await deliverabilityResponse.json();
        setDeliverabilityData(deliverability);
      }

      if (unsubscribeResponse.ok) {
        const unsubscribe = await unsubscribeResponse.json();
        setUnsubscribeData(unsubscribe);
      }
    } catch (error) {
      console.error('Failed to fetch analytics data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getHealthScoreIcon = (score: number) => {
    if (score >= 90) return <TrendingUp className="h-5 w-5 text-green-600" />;
    if (score >= 70) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <TrendingDown className="h-5 w-5 text-red-600" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advanced Analytics</h1>
          <p className="text-gray-600">Comprehensive insights into your email performance and compliance</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Health Score Overview */}
      {deliverabilityData && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Health Score</p>
                <p className={`text-2xl font-bold ${getHealthScoreColor(deliverabilityData.healthScore)}`}>
                  {deliverabilityData.healthScore}
                </p>
                <p className="text-sm text-gray-500 mt-1">Overall performance</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                {getHealthScoreIcon(deliverabilityData.healthScore)}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Deliverability</p>
                <p className="text-2xl font-bold text-gray-900">{deliverabilityData.deliverabilityScore}%</p>
                <p className="text-sm text-green-600 mt-1">
                  {deliverabilityData.deliverabilityScore >= 95 ? 'Excellent' : 
                   deliverabilityData.deliverabilityScore >= 90 ? 'Good' : 'Needs improvement'}
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
                <p className="text-sm font-medium text-gray-600">Bounce Rate</p>
                <p className="text-2xl font-bold text-gray-900">{deliverabilityData.bounceRate}%</p>
                <p className="text-sm text-gray-500 mt-1">
                  {deliverabilityData.bounceRate <= 2 ? 'Excellent' : 
                   deliverabilityData.bounceRate <= 5 ? 'Good' : 'High'}
                </p>
              </div>
              <div className="h-12 w-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance</p>
                <p className="text-2xl font-bold text-gray-900">
                  {unsubscribeData?.compliance.complianceRate || 0}%
                </p>
                <p className="text-sm text-blue-600 mt-1">One-click unsubscribe</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deliverability Trends */}
        {deliverabilityData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Deliverability Trends</h3>
              <TrendingUp className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={deliverabilityData.trends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="avg_deliverability_rate" stroke="#3B82F6" strokeWidth={2} name="Deliverability %" />
                  <Line type="monotone" dataKey="avg_reputation_score" stroke="#10B981" strokeWidth={2} name="Reputation Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Domain Performance */}
        {deliverabilityData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Domain Performance</h3>
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deliverabilityData.domainMetrics.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="domain" 
                    tick={{ fontSize: 12 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="deliverability_rate" fill="#3B82F6" name="Deliverability %" />
                  <Bar dataKey="reputation_score" fill="#10B981" name="Reputation Score" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Unsubscribe Reasons */}
        {unsubscribeData && unsubscribeData.reasons.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Unsubscribe Reasons</h3>
              <Users className="h-5 w-5 text-gray-400" />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={unsubscribeData.reasons}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ reason, percent }) => `${reason} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {unsubscribeData.reasons.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Compliance Metrics */}
        {unsubscribeData && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Compliance Overview</h3>
              <Shield className="h-5 w-5 text-gray-400" />
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-green-800">One-Click Unsubscribes</p>
                  <p className="text-xs text-green-600">CAN-SPAM Compliant</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-800">{unsubscribeData.compliance.oneClickCount}</p>
                  <p className="text-xs text-green-600">{unsubscribeData.compliance.complianceRate}% rate</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-blue-800">Total Unsubscribes</p>
                  <p className="text-xs text-blue-600">Last {timeRange} days</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-blue-800">{unsubscribeData.compliance.totalUnsubscribes}</p>
                </div>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="text-sm font-medium text-gray-800 mb-2">Compliance Status</h4>
                <div className="flex items-center space-x-2">
                  <div className={`h-3 w-3 rounded-full ${unsubscribeData.compliance.complianceRate >= 90 ? 'bg-green-500' : 'bg-yellow-500'}`}></div>
                  <span className="text-sm text-gray-600">
                    {unsubscribeData.compliance.complianceRate >= 90 ? 'Excellent compliance' : 'Review unsubscribe processes'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deliverabilityData && deliverabilityData.bounceRate > 5 && (
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-medium text-red-800">High Bounce Rate</span>
              </div>
              <p className="text-xs text-red-700">Clean your email list to improve deliverability</p>
            </div>
          )}
          
          {deliverabilityData && deliverabilityData.deliverabilityScore < 90 && (
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-2 mb-2">
                <Mail className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium text-yellow-800">Deliverability Alert</span>
              </div>
              <p className="text-xs text-yellow-700">Review authentication settings and sender reputation</p>
            </div>
          )}

          {unsubscribeData && unsubscribeData.compliance.complianceRate < 90 && (
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center space-x-2 mb-2">
                <Shield className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Compliance Improvement</span>
              </div>
              <p className="text-xs text-blue-700">Implement one-click unsubscribe for better compliance</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}