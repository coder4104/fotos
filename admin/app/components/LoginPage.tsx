'use client'
import { useState, useEffect } from 'react';
import {  Mail, Shield, Eye, EyeOff } from 'lucide-react';

interface LoginUser {
  id: string;
  email: string;
  role: string;
  name?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_url as string;

const LoginPage = ({ onLogin }: { onLogin: (user: LoginUser, token: string) => void }) => {
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      if (response.ok) {
        if (data.user.role === 'admin') {
          onLogin(data.user, data.token);
        } else {
          setError('Admin access required');
        }
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-black to-gray-800 p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden">
          <div className="bg-black text-white p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full mb-4">
              <Shield className="w-8 h-8 text-black" />
            </div>
            <h2 className="text-2xl font-bold">Admin Portal</h2>
            <p className="text-gray-300 mt-2">Secure access required</p>
          </div>
          
          <div className="p-8">
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-600 text-sm font-medium">{error}</p>
              </div>
            )}
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="admin@company.com"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-900">
                  Password
                </label>
                <div className="relative">
                  <Shield className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent transition-all duration-200 bg-gray-50 hover:bg-white"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              
              <button
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full bg-black text-white py-3 rounded-xl font-semibold hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-300 transition-all duration-200 transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Signing In...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-center text-gray-400 mt-6 text-sm">
          Authorized personnel only • Secure connection
        </p>
      </div>
    </div>
  );
};

export default LoginPage;