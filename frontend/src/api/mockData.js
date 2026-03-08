// Datos mock para desarrollo
export const mockUser = {
  id: "1",
  email: "karen@gymbeat.com",
  firstName: "Karen",
  lastName: "Guzman",
  phone: "+57 123 456 789",
  createdAt: new Date().toISOString(),
};

export const mockWorkouts = [
  {
    id: "1",
    type: "smartwatch",
    duration: 30,
    calories: 250,
    date: new Date().toISOString(),
  },
  {
    id: "2",
    type: "manual",
    duration: 45,
    calories: 350,
    date: new Date().toISOString(),
  },
];

// Flag para activar/desactivar modo mock
export const USE_MOCK_DATA = process.env.NODE_ENV === "development";
