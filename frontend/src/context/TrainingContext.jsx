import { createContext, useCallback, useContext, useState } from "react";

const TrainingContext = createContext();

export function TrainingProvider({ children }) {
  const [trainingSession, setTrainingSession] = useState({
    mode: null,
    trainingType: null,
    startTime: null,
    engineSessionId: null
  });

  const setTrainingMode = useCallback((mode) => {
    setTrainingSession((prev) => ({
      ...prev,
      mode
    }));
  }, []);

  const startTrainingSession = useCallback((trainingType) => {
    setTrainingSession((prev) => ({
      ...prev,
      trainingType,
      startTime: new Date()
    }));
  }, []);

  const setEngineSessionId = useCallback((engineSessionId) => {
    setTrainingSession((prev) => ({
      ...prev,
      engineSessionId
    }));
  }, []);

  const clearTrainingSession = useCallback(() => {
    setTrainingSession({
      mode: null,
      trainingType: null,
      startTime: null,
      engineSessionId: null
    });
  }, []);

  return (
    <TrainingContext.Provider
      value={{
        trainingSession,
        setTrainingMode,
        startTrainingSession,
        setEngineSessionId,
        clearTrainingSession,
      }}
    >
      {children}
    </TrainingContext.Provider>
  );
}

export function useTraining() {
  const context = useContext(TrainingContext);
  if (!context) {
    throw new Error("useTraining must be used within TrainingProvider");
  }
  return context;
}
