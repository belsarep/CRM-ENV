import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  MoreVertical,
  Mail,
  UserPlus,
  Download
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface ContactList {
  id: number;
  name: string;
  description: string;
  contact_count: number;
  first_name: string;
  last_name: string;
  created_at: string;
}

interface Contact {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  engagement_score: number;
  total_opens: number;
  total_clicks: number;
  added_at: string;
}

export default function ContactsPage() {
  const { token } = useAuth();
  const [lists, setLists] = useState<ContactList[]>([]);
  const [selectedList, setSelectedList] = useState<ContactList | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateList, setShowCreateList] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchContactLists();
  }, []);

  useEffect(() => {
    if (selectedList) {
      fetchContacts(selectedList.id);
    }
  }, [selectedList]);

  const fetchContactLists = async () => {
    try {
      const response = await fetch('/api/contacts/lists', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLists(data);
        if (data.length > 0 && !selectedList) {
          setSelectedList(data[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contact lists:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async (listId: number) => {
    try {
      const response = await fetch(`/api/contacts/lists/${listId}/contacts`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.last_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'unsubscribed': return 'bg-red-100 text-red-800';
      case 'bounced': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEngagementLevel = (score: number) => {
    if (score >= 80) return { label: 'High', color: 'text-green-600' };
    if (score >= 50) return { label: 'Medium', color: 'text-yellow-600' };
    return { label: 'Low', color: 'text-red-600' };
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
          <h1 className="text-2xl font-bold text-gray-900">Contact Management</h1>
          <p className="text-gray-600">Manage your contact lists and subscribers</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAddContact(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Contact</span>
          </button>
          <button
            onClick={() => setShowCreateList(true)}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New List</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Contact Lists Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Lists</h3>
            <div className="space-y-2">
              {lists.map((list) => (
                <button
                  key={list.id}
                  onClick={() => setSelectedList(list)}
                  className={`w-full text-left p-3 rounded-lg transition-colors ${
                    selectedList?.id === list.id
                      ? 'bg-blue-50 border border-blue-200'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{list.name}</p>
                      <p className="text-sm text-gray-500">{list.contact_count} contacts</p>
                    </div>
                    <Users className="h-4 w-4 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {selectedList ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* List Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">{selectedList.name}</h2>
                    <p className="text-gray-600">{selectedList.description}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <Download className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Search and Filters */}
                <div className="flex items-center space-x-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2">
                    <Filter className="h-4 w-4" />
                    <span>Filter</span>
                  </button>
                </div>
              </div>

              {/* Contacts Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Engagement
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Activity
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Added
                      </th>
                      <th className="relative px-6 py-3">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredContacts.map((contact) => {
                      const engagement = getEngagementLevel(contact.engagement_score);
                      return (
                        <tr key={contact.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex items-center">
                              <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                                <Mail className="h-4 w-4 text-gray-500" />
                              </div>
                              <div className="ml-4">
                                <div className="text-sm font-medium text-gray-900">
                                  {contact.first_name} {contact.last_name}
                                </div>
                                <div className="text-sm text-gray-500">{contact.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(contact.status)}`}>
                              {contact.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              <span className={engagement.color}>{engagement.label}</span>
                              <div className="text-xs text-gray-500">
                                {Math.round(contact.engagement_score)}% score
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            <div>{contact.total_opens} opens</div>
                            <div className="text-xs text-gray-500">{contact.total_clicks} clicks</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500">
                            {new Date(contact.added_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right text-sm font-medium">
                            <button className="text-gray-400 hover:text-gray-600">
                              <MoreVertical className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredContacts.length === 0 && (
                <div className="text-center py-12">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No contacts found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {searchTerm ? 'Try adjusting your search terms' : 'Get started by adding a contact to this list'}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No list selected</h3>
              <p className="mt-1 text-sm text-gray-500">Select a contact list to view its contacts</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}