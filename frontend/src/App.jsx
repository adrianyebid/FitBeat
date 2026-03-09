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

const MUSIC_PREFERENCES_KEY = "musicPreferences";

function hasCompletedSurvey(userId) {
  if (!userId) {
    return false;
  }

  try {
    const raw = localStorage.getItem(MUSIC_PREFERENCES_KEY);
    if (!raw) {
      return false;
    }

    const parsed = JSON.parse(raw);
    const sameUser = parsed?.user_id === userId;
    const hasGenres = Array.isArray(parsed?.genres) && parsed.genres.length > 0;
    const hasMoods = Array.isArray(parsed?.moods) && parsed.moods.length > 0;
    return sameUser && hasGenres && hasMoods;
  } catch {
    return false;
  }
}

function App() {
  const { isAuthenticated, user } = useAuth();
  const surveyCompleted = hasCompletedSurvey(user?.id);
  const authenticatedHome = surveyCompleted ? "/dashboard" : "/music-survey";

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
              {surveyCompleted ? <Navigate to="/dashboard" replace /> : <MusicSurveyPage />}
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
