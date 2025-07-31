import { useEffect, useState } from "react";

export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      const data = await window.electronAPI?.loadUser();
      console.log("Token:", data.user.token);
      if (!data.user.token) {
        setIsAuthenticated(false);
        return;
      }
      setIsAuthenticated(true)
    };
    verifyToken();
  }, []);

  return { isAuthenticated };
};