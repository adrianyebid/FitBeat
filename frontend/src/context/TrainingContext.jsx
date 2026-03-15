import { createContext, useContext, useState } from "react";

const TrainingContext = createContext();

export function TrainingProvider({ children }) {
  const [trainingSession, setTrainingSession] = useState({
    mode: null,
    trainingType: null,
    startTime: null,
    engineSessionId: null
  });

  const setTrainingMode = (mode) => {
    setTrainingSession((prev) => ({
      ...prev,
      mode
    }));
  };

  const startTrainingSession = (trainingType) => {
    setTrainingSession((prev) => ({
      ...prev,
      trainingType,
      startTime: new Date()
    }));
  };

  const setEngineSessionId = (engineSessionId) => {
    setTrainingSession((prev) => ({
      ...prev,
      engineSessionId
    }));
  };

  const clearTrainingSession = () => {
    setTrainingSession({
      mode: null,
      trainingType: null,
      startTime: null,
      engineSessionId: null
    });
  };

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
