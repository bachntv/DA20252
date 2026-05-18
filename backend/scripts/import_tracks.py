import csv
import hashlib
from pathlib import Path

import psycopg2


DB_CONFIG = dict(
    dbname="music_streaming",
    user="postgres",
    password="postgres",
    host="localhost",
    port=5432,
)
CSV_PATH = Path(__file__).resolve().parents[1] / "data" / "dataset.csv"
DEFAULT_COVER_URL = "/default_cover.png"


def stable_id(prefix: str, value: str) -> str:
    normalized = (value or "unknown").strip().lower()
    digest = hashlib.sha1(normalized.encode("utf-8")).hexdigest()[:16]
    return f"{prefix}_{digest}"


def to_int(value):
    if value in (None, ""):
        return None
    return int(float(value))


def to_float(value):
    if value in (None, ""):
        return None
    return float(value)


def to_bool(value):
    return str(value).strip().lower() == "true"


def import_tracks():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    count = 0

    with CSV_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            artist_name = (row.get("artists") or "Unknown Artist").strip()
            album_name = (row.get("album_name") or "Unknown Album").strip()
            artist_id = stable_id("artist", artist_name)
            album_id = stable_id("album", album_name)

            cur.execute(
                """
                INSERT INTO artists (id, name, followers, image_url, is_active)
                VALUES (%s, %s, %s, %s, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    is_active = TRUE
                """,
                (artist_id, artist_name, 0, None),
            )
            cur.execute(
                """
                INSERT INTO albums (id, name, release_date, image_url, type, is_active)
                VALUES (%s, %s, %s, %s, %s, TRUE)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    is_active = TRUE
                """,
                (album_id, album_name, None, DEFAULT_COVER_URL, "album"),
            )
            cur.execute(
                """
                INSERT INTO album_artists (album_id, artist_id)
                VALUES (%s, %s)
                ON CONFLICT (album_id, artist_id) DO NOTHING
                """,
                (album_id, artist_id),
            )
            cur.execute(
                """
                INSERT INTO songs (
                    track_id, track_name, popularity, duration_ms, explicit,
                    danceability, energy, key, loudness, mode, speechiness,
                    acousticness, instrumentalness, liveness, valence, tempo,
                    time_signature, track_genre, artist_id, album_id,
                    track_image_url, is_active
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, TRUE
                )
                ON CONFLICT (track_id, artist_id) DO UPDATE SET
                    track_name = EXCLUDED.track_name,
                    popularity = EXCLUDED.popularity,
                    duration_ms = EXCLUDED.duration_ms,
                    explicit = EXCLUDED.explicit,
                    danceability = EXCLUDED.danceability,
                    energy = EXCLUDED.energy,
                    key = EXCLUDED.key,
                    loudness = EXCLUDED.loudness,
                    mode = EXCLUDED.mode,
                    speechiness = EXCLUDED.speechiness,
                    acousticness = EXCLUDED.acousticness,
                    instrumentalness = EXCLUDED.instrumentalness,
                    liveness = EXCLUDED.liveness,
                    valence = EXCLUDED.valence,
                    tempo = EXCLUDED.tempo,
                    time_signature = EXCLUDED.time_signature,
                    track_genre = EXCLUDED.track_genre,
                    album_id = EXCLUDED.album_id,
                    track_image_url = EXCLUDED.track_image_url,
                    is_active = TRUE
                """,
                (
                    row["track_id"],
                    row["track_name"],
                    to_int(row.get("popularity")),
                    to_int(row.get("duration_ms")),
                    to_bool(row.get("explicit")),
                    to_float(row.get("danceability")),
                    to_float(row.get("energy")),
                    to_int(row.get("key")),
                    to_float(row.get("loudness")),
                    to_int(row.get("mode")),
                    to_float(row.get("speechiness")),
                    to_float(row.get("acousticness")),
                    to_float(row.get("instrumentalness")),
                    to_float(row.get("liveness")),
                    to_float(row.get("valence")),
                    to_float(row.get("tempo")),
                    to_int(row.get("time_signature")),
                    row.get("track_genre"),
                    artist_id,
                    album_id,
                    DEFAULT_COVER_URL,
                ),
            )
            count += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"Imported {count} tracks from {CSV_PATH}.")


if __name__ == "__main__":
    import_tracks()
