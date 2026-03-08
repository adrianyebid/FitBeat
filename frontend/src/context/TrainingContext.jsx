import { createContext, useContext, useState } from "react";

const TrainingContext = createContext();

export function TrainingProvider({ children }) {
  const [trainingSession, setTrainingSession] = useState({
    trainingType: null,
    startTime: null,
  });

  const startTrainingSession = (trainingType) => {
    setTrainingSession({
      trainingType,
      startTime: new Date(),
    });
  };

  const clearTrainingSession = () => {
    setTrainingSession({
      trainingType: null,
      startTime: null,
    });
  };

  return (
    <TrainingContext.Provider
      value={{
        trainingSession,
        startTrainingSession,
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
