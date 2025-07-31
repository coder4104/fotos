'use client'
import { useState, useEffect } from 'react';
import { Search, Edit, Save, X, User, Mail, Phone, Calendar, Shield, LogOut } from 'lucide-react';

interface User {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  isActive: boolean;
  subscriptionStart?: string;
  subscriptionEnd?: string;
  createdAt: string;
  updatedAt: string;
}

interface LoginUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_url as string;

const AdminDashboard = ({ 
  user, 
  token, 
  onLogout 
}: { 
  user: LoginUser; 
  token: string; 
  onLogout: () => void; 
}) => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  const [editForm, setEditForm] = useState<Partial<User>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (response.ok) {
          setUsers(data);
          setFilteredUsers(data);
        } else {
          setError(data.error || 'Failed to fetch users');
        }
      } catch (err) {
        setError('Failed to fetch users');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [token]);

  useEffect(() => {
    const filtered = users.filter(
      (user) =>
        user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredUsers(filtered);
  }, [searchQuery, users]);

  const handleEdit = (user: User) => {
    setEditingUser(user.id);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      isActive: user.isActive,
      subscriptionStart: user.subscriptionStart ? new Date(user.subscriptionStart).toISOString().split('T')[0] : '', // Added subscriptionStart
      subscriptionEnd: user.subscriptionEnd ? new Date(user.subscriptionEnd).toISOString().split('T')[0] : '',
    });
  };

  const handleUpdate = async (userId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      const updatedUser = await response.json();
      if (response.ok) {
        setUsers(users.map((u) => (u.id === userId ? updatedUser : u)));
        setFilteredUsers(filteredUsers.map((u) => (u.id === userId ? updatedUser : u)));
        setEditingUser(null);
        setError('');
      } else {
        setError(updatedUser.error || 'Failed to update user');
      }
    } catch (err) {
      setError('Failed to update user');
    }
  };

  const handleCancel = () => {
    setEditingUser(null);
    setEditForm({});
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <div className="bg-black rounded-lg p-2">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-500 text-sm">Welcome back, {user.name || user.email}</p>
              </div>
            </div>
            <button
              onClick={onLogout}
              className="flex items-center space-x-2 bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 transform hover:scale-105"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-gray-900">{users.length}</p>
              </div>
              <div className="bg-black rounded-lg p-3">
                <User className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active Users</p>
                <p className="text-3xl font-bold text-green-600">{users.filter(u => u.isActive).length}</p>
              </div>
              <div className="bg-green-100 rounded-lg p-3">
                <User className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Inactive Users</p>
                <p className="text-3xl font-bold text-red-600">{users.filter(u => !u.isActive).length}</p>
              </div>
              <div className="bg-red-100 rounded-lg p-3">
                <User className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-red-600 font-medium">{error}</p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
              placeholder="Search users by name or email..."
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <User className="w-4 h-4" />
                      <span>User</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4" />
                      <span>Email</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Phone className="w-4 h-4" />
                      <span>Phone</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Subscription Start</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4" />
                      <span>Subscription End</span>
                    </div>
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors duration-150">
                    {editingUser === user.id ? (
                      <>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.name || ''}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="Full name"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="email"
                            value={editForm.email || ''}
                            onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="email@example.com"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.phone || ''}
                            onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                            placeholder="Phone number"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={editForm.isActive || false}
                              onChange={(e) => setEditForm({ ...editForm, isActive: e.target.checked })}
                              className="w-4 h-4 text-black bg-gray-100 border-gray-300 rounded focus:ring-black focus:ring-2"
                            />
                            <span className="text-sm text-gray-700">Active</span>
                          </label>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            value={editForm.subscriptionStart || '-'}
                            disabled
                            className="w-full p-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-500 cursor-not-allowed"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="date"
                            value={editForm.subscriptionEnd || ''}
                            onChange={(e) => setEditForm({ ...editForm, subscriptionEnd: e.target.value })}
                            className="w-full p-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleUpdate(user.id)}
                              className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition-colors duration-200"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="bg-gray-200 text-gray-700 p-2 rounded-lg hover:bg-gray-300 transition-colors duration-200"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className="bg-gray-100 rounded-full p-2 mr-3">
                              <User className="w-5 h-5 text-gray-600" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{user.name || 'No Name'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-gray-900">{user.email || '-'}</td>
                        <td className="px-6 py-4 text-gray-900">{user.phone || '-'}</td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                              user.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          {user.subscriptionStart ? new Date(user.subscriptionStart).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-900">
                          {user.subscriptionEnd ? new Date(user.subscriptionEnd).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleEdit(user)}
                            className="bg-black text-white p-2 rounded-lg hover:bg-gray-800 transition-all duration-200 transform hover:scale-105"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No users found</p>
              <p className="text-gray-400 text-sm">Try adjusting your search criteria</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;