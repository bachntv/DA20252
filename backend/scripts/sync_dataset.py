"""
Sync dataset.csv with the actual database content.
This ensures the recommender uses only tracks that exist in the database.
"""
import os
import pandas as pd
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# PostgreSQL connection
pg_user = os.getenv("POSTGRES_USER")
pg_password = os.getenv("POSTGRES_PASSWORD")
pg_host = os.getenv("POSTGRES_HOST")
pg_port = os.getenv("POSTGRES_PORT")
pg_database = os.getenv("POSTGRES_DATABASE")

engine = create_engine(f"postgresql+psycopg2://{pg_user}:{pg_password}@{pg_host}:{pg_port}/{pg_database}")

def sync_dataset():
    """Export tracks from database to dataset.csv for recommender"""
    
    print("Connecting to database...")
    with engine.connect() as conn:
        # Query all songs with their details
        query = text("""
            SELECT 
                s.track_id,
                s.track_name,
                a.name as artist_name,
                al.name as album_name,
                s.duration_ms,
                s.popularity,
                s.explicit,
                s.danceability,
                s.energy,
                s.key,
                s.loudness,
                s.mode,
                s.speechiness,
                s.acousticness,
                s.instrumentalness,
                s.liveness,
                s.valence,
                s.tempo,
                s.time_signature,
                s.track_genre
            FROM songs s
            LEFT JOIN artists a ON s.artist_id = a.id
            LEFT JOIN albums al ON s.album_id = al.id
        """)
        
        result = conn.execute(query)
        rows = result.fetchall()
        columns = result.keys()
        
    print(f"Found {len(rows)} tracks in database")
    
    # Create DataFrame
    df = pd.DataFrame(rows, columns=columns)
    
    # Rename columns to match expected format
    df = df.rename(columns={
        'artist_name': 'artists',
    })
    
    # Save to backend/data/dataset.csv
    output_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data', 'dataset.csv')
    df.to_csv(output_path, index=False)
    print(f"✅ Saved {len(df)} tracks to {output_path}")
    
    return len(df)

if __name__ == "__main__":
    sync_dataset()
