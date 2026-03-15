from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from src.core.config import settings

# 1. El Motor (Engine): Es el puente de comunicación. 
# Toma la URL de tu .env (localhost:5432) y traduce las consultas de Python a PostgreSQL.
engine = create_engine(settings.DATABASE_URL)

# 2. La Fábrica de Sesiones: Cada vez que un usuario haga una petición (ej. registrarse),
# esto creará una conexión fresca y aislada hacia la base de datos.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. La Base Maestra: De esta clase van a heredar TODAS las tablas de tu sistema.
# Es lo que permite centralizar las tablas de 'users', 'auth' y 'preferences' en un solo lugar.
Base = declarative_base()

# 4. Inyección de Dependencias para FastAPI
def get_db():
    """
    Garantiza que la conexión se abra al iniciar la petición HTTP y, 
    lo más importante para la resiliencia del sistema, que se cierre (db.close()) 
    siempre al terminar, evitando fugas de memoria o caídas por exceso de conexiones.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()