import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/authStore";
import Login from "./pages/Login";
import Register from "./pages/Register";
import MainLayout from "./layouts/MainLayout";
import api from "./api/client";

function App() {
  const { token, logout } = useAuthStore();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    // Verify token validity on app load
    const checkAuth = async () => {
      if (token) {
        try {
          await api.get("/users/me");
        } catch (error: any) {
          // If token is invalid, logout
          if (error.response?.status === 401) {
            logout();
          }
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [token, logout]);

  if (isCheckingAuth) {
    return (
      <div style={{ 
        display: "flex", 
        justifyContent: "center", 
        alignItems: "center", 
        height: "100vh",
        background: "#36393f",
        color: "#dcddde"
      }}>
        Загрузка...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token ? <Navigate to="/" replace /> : <Login />}
        />
        <Route
          path="/register"
          element={token ? <Navigate to="/" replace /> : <Register />}
        />
        <Route
          path="/*"
          element={token ? <MainLayout /> : <Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

