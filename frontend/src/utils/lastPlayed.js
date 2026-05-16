const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:8001";

export const updateLastPlayed = async (itemId, token) => {
  try {
    await fetch(`${API_BASE}/api/music/library/${itemId}/last_played`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log(`✅ Updated last_played for item ${itemId}`);
  } catch (err) {
    console.error(`❌ Failed to update last_played for ${itemId}:`, err);
  }
};