import psycopg2
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from src.core.config import settings


def _make_connection():
    """
    Creates a raw psycopg2 connection using the DATABASE_URL directly.
    This allows libpq to handle multi-host URLs transparently
    (e.g. @primary:5432,standby:5432/?target_session_attrs=read-write)
    without SQLAlchemy URL parsing interfering.
    """
    return psycopg2.connect(settings.DATABASE_URL)


# 1. El Motor (Engine): Es el puente de comunicación.
# Usa un creator personalizado para que libpq maneje el multi-host del Warm Spare.
# pool_pre_ping invalida conexiones muertas y fuerza reconexión al standby promovido.
engine = create_engine(
    "postgresql+psycopg2://",
    creator=_make_connection,
    pool_size=20,
    max_overflow=40,
    pool_timeout=30,
    pool_pre_ping=True,
)

# 2. La Fábrica de Sesiones: Cada vez que un usuario haga una petición (ej. registrarse),
# esto creará una conexión fresca y aislada hacia la base de datos.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 3. Es lo que permite centralizar las tablas de 'users', 'auth' y 'preferences' en un solo lugar.
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