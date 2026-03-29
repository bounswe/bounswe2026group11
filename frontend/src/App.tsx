import { Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './views/auth/AuthPage';
import LoginView from './views/auth/LoginView';
import RegisterView from './views/auth/RegisterView';
import HomePage from './views/home/HomePage';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { token } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={token ? <Navigate to="/home" replace /> : <AuthPage />}
      />
      <Route
        path="/login"
        element={token ? <Navigate to="/home" replace /> : <LoginView />}
      />
      <Route
        path="/register"
        element={token ? <Navigate to="/home" replace /> : <RegisterView />}
      />
      <Route
        path="/home"
        element={token ? <HomePage /> : <Navigate to="/" replace />}
      />
    </Routes>
  );
}
