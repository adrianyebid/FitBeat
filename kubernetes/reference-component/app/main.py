from fastapi import FastAPI
import socket
import os

app = FastAPI()

@app.get("/")
def read_root():
    return {
        "message": "Hello from FitBeat cluster!",
        "host": socket.gethostname(),
        "instance_id": os.getenv("INSTANCE_ID", "unknown")
    }

@app.get("/health")
def health_check():
    return {"status": "healthy", "host": socket.gethostname()}