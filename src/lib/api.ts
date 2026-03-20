const base = import.meta.env.VITE_API_URL || "http://localhost:4000";

export async function getVideoToken(roomId: string) {
  const res = await fetch(`${base}/api/study-rooms/${roomId}/video-token`);
  if (!res.ok) throw new Error(`Failed to get video token (${res.status})`);
  return res.json();
}

export async function createRoom(payload: { name: string; createdBy: string; members?: string[] }) {
  const res = await fetch(`${base}/api/study-rooms`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`Failed to create room (${res.status})`);
  return res.json();
}

export async function joinRoom(roomId: string, userId: string) {
  const res = await fetch(`${base}/api/study-rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId })
  });
  if (!res.ok) throw new Error(`Failed to join room (${res.status})`);
  return res.json();
}
