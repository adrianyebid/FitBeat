from enum import Enum

class Genero(str, Enum):
    POP = "Pop"
    REGGAETON = "Reggaetón"
    HIP_HOP = "Hip-Hop"
    RAP = "Rap"
    ROCK = "Rock"
    ELECTRONICA = "Electrónica"
    ALTERNATIVO = "Alternativo"
    MUSICA_CLASICA = "Música Clásica"
    REGGAE = "reggae"
    DANCEHALL = "Dancehall"
    REGIONAL_MEXICANA = "Regional Mexicana"
    BALADAS_ROMANTICAS = "Baladas Romanticas"

class Mood(str, Enum):
    CHILL = "Chill"
    LATINA = "Latina"
    TRISTEZA = "Tristeza"
    NOSTALGIA = "Nostalgia"
    SERENIDAD = "Serenidad"
    ALEGRIA = "Alegria"
    AMOR = "Amor"
    DESPECHO = "Despecho"
    ROMANCE = "Romance"
    MARIACHI = "Mariachi"


class Sport(str, Enum):
    RUNNING = "Running"
    HIKING = "Hiking"
    HIIT = "HIIT"
    LIFTING = "Lifting"
    YOGA = "Yoga"
    PILATES = "Pilates"

