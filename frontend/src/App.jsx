import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TrainingPage from "./pages/TrainingPage";
import TrainingTypeSelectionPage from "./pages/TrainingTypeSelectionPage";
import TrainingPlayPage from "./pages/TrainingPlayPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { TrainingProvider } from "./context/TrainingContext";

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <TrainingProvider>
      <Routes>
      <Route
        path="/"
        element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <AuthPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/training"
        element={
          <ProtectedRoute>
            <TrainingPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/training/select-type"
        element={
          <ProtectedRoute>
            <TrainingTypeSelectionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/training/play/:trainingType"
        element={
          <ProtectedRoute>
            <TrainingPlayPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </TrainingProvider>
  );
}

export default App;
