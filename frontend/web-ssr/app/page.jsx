async function getServiceStatus(baseUrl, path) {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      cache: "no-store"
    });
    if (!res.ok) {
      return { ok: false, details: `HTTP ${res.status}` };
    }
    const data = await res.json();
    return { ok: true, details: data.status || "ok" };
  } catch (error) {
    return { ok: false, details: "unreachable" };
  }
}

export default async function HomePage() {
  const gatewayBase = process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8090";
  const [authStatus, achievementsStatus] = await Promise.all([
    getServiceStatus(gatewayBase, "/auth/health"),
    getServiceStatus(gatewayBase, "/achievements/health")
  ]);

  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">FitBeat Prototype 2</p>
        <h1>Web Frontend SSR</h1>
        <p>
          This page is rendered on the server using Next.js and acts as the official web
          presentation component for delivery compliance.
        </p>
      </section>

      <section className="card">
        <h2>Runtime Checks</h2>
        <ul>
          <li>Gateway URL: <strong>{gatewayBase}</strong></li>
          <li>Auth service: <strong>{authStatus.ok ? "UP" : "DOWN"}</strong> ({authStatus.details})</li>
          <li>Achievements service: <strong>{achievementsStatus.ok ? "UP" : "DOWN"}</strong> ({achievementsStatus.details})</li>
        </ul>
      </section>
    </main>
  );
}
