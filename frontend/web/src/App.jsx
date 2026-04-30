import { Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TrainingPage from "./pages/TrainingPage";
import TrainingTypeSelectionPage from "./pages/TrainingTypeSelectionPage";
import TrainingPlayPage from "./pages/TrainingPlayPage";
import MusicSurveyPage from "./pages/MusicSurveyPage";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuth } from "./context/AuthContext";
import { TrainingProvider } from "./context/TrainingContext";

function App() {
  const { isAuthenticated, user, isNewUser } = useAuth();
  const authenticatedHome = "/dashboard";

  return (
    <TrainingProvider>
      <Routes>

        {/* Página de login */}
        <Route
          path="/"
          element={
            isAuthenticated ? <Navigate to={authenticatedHome} replace /> : <AuthPage />
          }
        />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Página de entrenamiento */}
        <Route
          path="/training"
          element={
            <ProtectedRoute>
              <TrainingPage />
            </ProtectedRoute>
          }
        />

        {/* Selección de tipo de entrenamiento */}
        <Route
          path="/training/select-type"
          element={
            <ProtectedRoute>
              <TrainingTypeSelectionPage />
            </ProtectedRoute>
          }
        />

        {/* Reproductor / entrenamiento */}
        <Route
          path="/training/play/:trainingType"
          element={
            <ProtectedRoute>
              <TrainingPlayPage />
            </ProtectedRoute>
          }
        />

        {/* Encuesta de música */}
        <Route
          path="/music-survey"
          element={
            <ProtectedRoute>
              <MusicSurveyPage />
            </ProtectedRoute>
          }
        />

        {/* Ruta fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />

      </Routes>
    </TrainingProvider>
  );
}

export default App;
