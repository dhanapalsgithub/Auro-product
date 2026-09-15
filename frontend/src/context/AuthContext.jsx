import React, { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const isAuth = localStorage.getItem("auro_mock_auth");
    const currentUser = localStorage.getItem("auro_current_user");
    const userRole = localStorage.getItem("auro_user_role");

    if (isAuth === "true" && currentUser) {
      setUser({ email: currentUser, role: userRole });
    } else {
      setUser(false);
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Frontend-only mock login
    localStorage.setItem("auro_mock_auth", "true");
    localStorage.setItem("auro_current_user", email);
    localStorage.setItem("auro_user_role", "admin");
    setUser({ email, role: "admin" });
    return { email, role: "admin" };
  };

  const logout = () => {
    localStorage.removeItem("auro_mock_auth");
    localStorage.removeItem("auro_current_user");
    localStorage.removeItem("auro_user_role");
    setUser(false);
    window.location.href = "/login";
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);