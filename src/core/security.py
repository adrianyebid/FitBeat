from cryptography.fernet import Fernet
from src.core.config import settings

# Inicializamos el motor criptográfico solo si hay una llave configurada
_fernet = None
if settings.ENCRYPTION_KEY:
    _fernet = Fernet(settings.ENCRYPTION_KEY.encode())


def encrypt_data(data: str) -> str:
    """Recibe texto plano y devuelve un token cifrado."""
    if not data or not _fernet:
        return data
    return _fernet.encrypt(data.encode()).decode()


def decrypt_data(encrypted_data: str) -> str:
    """Recibe un token cifrado y devuelve el texto plano."""
    if not encrypted_data or not _fernet:
        return encrypted_data
    return _fernet.decrypt(encrypted_data.encode()).decode()