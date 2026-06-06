import os, socket, time, random
from flask import Flask, jsonify, request

app = Flask(__name__)

# Each container resolves its own hostname at startup.
# When Docker Compose creates multiple replicas, each gets
# a unique container name (fitbeat_replica_1, fitbeat_replica_2, etc.).
INSTANCE_ID = socket.gethostname()
INSTANCE_PORT = os.getenv("PORT", "5000")

@app.route("/api/health")
def health():
    """Health check endpoint - for load balancer monitoring"""
    return jsonify({
        "instance": INSTANCE_ID,
        "status": "healthy",
        "port": INSTANCE_PORT
    })

@app.route("/api/workout-session")
def workout_session():
    """
    Simulate a workout session endpoint (stateless).
    Mimics music-service or achievements-service behavior.
    Returns the instance that handled the request with simulated processing time.
    """
    # Simulate variable processing time (50–300 ms)
    # to make least_conn behaviour observable.
    delay = random.uniform(0.05, 0.30)
    time.sleep(delay)
    
    session_id = request.args.get("session_id", "demo-session")
    
    return jsonify({
        "instance": INSTANCE_ID,
        "session_id": session_id,
        "status": "processing",
        "message": "Workout session update from FitBeat replica",
        "processing_ms": round(delay * 1000, 1),
        "timestamp": time.time()
    })

@app.route("/api/achievements")
def achievements():
    """
    Simulate achievement evaluation endpoint (stateless).
    Returns instance handling the request.
    """
    delay = random.uniform(0.05, 0.30)
    time.sleep(delay)
    
    user_id = request.args.get("user_id", "demo-user")
    
    return jsonify({
        "instance": INSTANCE_ID,
        "user_id": user_id,
        "achievements": [
            {"name": "First Session", "unlocked": True},
            {"name": "5 Sessions", "unlocked": False}
        ],
        "processing_ms": round(delay * 1000, 1),
        "message": f"Achievements served from {INSTANCE_ID}"
    })

@app.route("/api/notification")
def notification():
    """
    Simulate notification sending endpoint (stateless).
    Returns instance handling the request.
    """
    delay = random.uniform(0.05, 0.30)
    time.sleep(delay)
    
    user_id = request.args.get("user_id", "demo-user")
    
    return jsonify({
        "instance": INSTANCE_ID,
        "user_id": user_id,
        "notification": "Achievement unlocked!",
        "sent": True,
        "processing_ms": round(delay * 1000, 1),
        "message": f"Notification processed by {INSTANCE_ID}"
    })

@app.route("/api/stats")
def stats():
    """
    Display instance information for demonstration purposes.
    """
    return jsonify({
        "instance": INSTANCE_ID,
        "port": INSTANCE_PORT,
        "message": "This is a horizontally scalable FitBeat replica",
        "note": "When load balancer distributes requests, observe how different instances handle them"
    })

if __name__ == "__main__":
    port = int(INSTANCE_PORT)
    app.run(host="0.0.0.0", port=port, debug=False)
