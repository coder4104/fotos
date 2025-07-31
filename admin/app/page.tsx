'use client';

import { useState, useEffect } from 'react';
import LoginPage from '@/app/components/LoginPage';
import AdminDashboard from '@/app/components/AdminDashboard';

interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

const ENCRYPTION_KEY = 'Yt9#zR!2jLqX^0eUwP@6bCvM$5sHdGnT';

const stringToArrayBuffer = (str: string) => {
  return new TextEncoder().encode(str);
};

const arrayBufferToString = (buffer: ArrayBuffer) => {
  return new TextDecoder().decode(buffer);
};

const encryptData = async (data: string): Promise<string> => {
  const key = await crypto.subtle.importKey(
    'raw',
    stringToArrayBuffer(ENCRYPTION_KEY),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv,
    },
    key,
    stringToArrayBuffer(data)
  );
  const combined = new Uint8Array([...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
};

const decryptData = async (encryptedData: string): Promise<string | null> => {
  try {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const iv = combined.slice(0, 12);
    const encryptedContent = combined.slice(12);
    const key = await crypto.subtle.importKey(
      'raw',
      stringToArrayBuffer(ENCRYPTION_KEY),
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encryptedContent
    );
    return arrayBufferToString(decrypted);
  } catch {
    return null;
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const initializeSession = async () => {
      const storedEncryptedUser = localStorage.getItem('user');
      const storedEncryptedToken = localStorage.getItem('token');
      if (storedEncryptedUser && storedEncryptedToken) {
        const decryptedUser = await decryptData(storedEncryptedUser);
        const decryptedToken = await decryptData(storedEncryptedToken);
        if (decryptedUser && decryptedToken) {
          setUser(JSON.parse(decryptedUser));
          setToken(decryptedToken);
        } else {
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }
    };
    initializeSession();
  }, []);

  const handleLogin = async (user: User, token: string) => {
    const encryptedUser = await encryptData(JSON.stringify(user));
    const encryptedToken = await encryptData(token);
    localStorage.setItem('user', encryptedUser);
    localStorage.setItem('token', encryptedToken);
    setUser(user);
    setToken(token);
  };

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setUser(null);
    setToken(null);
  };

  return (
    <div>
      {user && token ? (
        <AdminDashboard user={user} token={token} onLogout={handleLogout} />
      ) : (
        <LoginPage onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;