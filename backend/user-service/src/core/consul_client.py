"""
Service Discovery — Consul HTTP API client (thin wrapper, no SDK).

Responsibilities:
  - register()    → called on app startup, advertises this instance
  - deregister()  → called on app shutdown, removes it from the registry
  - get_instances() → returns the list of healthy user-service instances
"""

import logging

import requests

logger = logging.getLogger(__name__)

_REGISTER_TIMEOUT = 3   # seconds
_QUERY_TIMEOUT    = 3


def register(consul_addr: str, instance_id: str, instance_host: str, port: int) -> None:
    """Register this service instance in Consul with an HTTP health check."""
    url = f"http://{consul_addr}/v1/agent/service/register"
    payload = {
        "ID": instance_id,
        "Name": "user-service",
        "Address": instance_host,
        "Port": port,
        "Check": {
            "HTTP": f"http://{instance_host}:{port}/health",
            "Interval": "10s",
            # Consul auto-deregisters the instance if it stays critical for 30s
            "DeregisterCriticalServiceAfter": "30s",
        },
    }
    try:
        resp = requests.put(url, json=payload, timeout=_REGISTER_TIMEOUT)
        resp.raise_for_status()
        logger.info("[consul] Registered instance '%s' at %s:%s", instance_id, instance_host, port)
    except Exception as exc:
        # Log but never crash the app — service discovery is non-critical
        logger.warning("[consul] Registration failed (non-fatal): %s", exc)


def deregister(consul_addr: str, instance_id: str) -> None:
    """Remove this instance from the Consul registry."""
    url = f"http://{consul_addr}/v1/agent/service/deregister/{instance_id}"
    try:
        resp = requests.put(url, timeout=_REGISTER_TIMEOUT)
        resp.raise_for_status()
        logger.info("[consul] Deregistered instance '%s'", instance_id)
    except Exception as exc:
        logger.warning("[consul] Deregistration failed (non-fatal): %s", exc)


def get_instances(consul_addr: str) -> list[dict]:
    """
    Query Consul for healthy user-service instances.

    Returns a list of dicts:
      [{"id": str, "address": str, "port": int, "status": str}, ...]
    """
    url = f"http://{consul_addr}/v1/health/service/user-service"
    try:
        resp = requests.get(url, timeout=_QUERY_TIMEOUT)
        resp.raise_for_status()
        entries = resp.json()
    except Exception as exc:
        logger.warning("[consul] Could not fetch instances: %s", exc)
        return []

    instances = []
    for entry in entries:
        svc = entry.get("Service", {})
        checks = entry.get("Checks", [])
        # Aggregate status: passing only if ALL checks pass
        status = "passing" if all(c.get("Status") == "passing" for c in checks) else "critical"
        instances.append({
            "id":      svc.get("ID"),
            "address": svc.get("Address"),
            "port":    svc.get("Port"),
            "status":  status,
        })
    return instances
