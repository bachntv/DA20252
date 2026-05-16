import os, pickle, faiss
import pandas as pd
import numpy as np
from io import BytesIO, StringIO
from google.cloud import storage, bigquery
import tempfile

class Recommender:
    def __init__(self):
        self.data_df = None
        self.faiss_index = None
        self.track_features = None
        self.gcs_client = None
        self.bq_client = None
        self.bucket = None
        self.use_bigquery = False  # Flag to track if BigQuery is available

        # Only initialize Google Cloud clients if credentials are provided
        gcp_credentials = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        bucket_name = os.getenv("BUCKET_NAME")
        
        if gcp_credentials and os.path.exists(gcp_credentials):
            try:
                self.gcs_client = storage.Client.from_service_account_json(gcp_credentials)
                self.bq_client = bigquery.Client.from_service_account_json(gcp_credentials)
                if bucket_name:
                    self.bucket = self.gcs_client.bucket(bucket_name)
                self.use_bigquery = True
            except Exception as e:
                print(f"Warning: Failed to initialize Google Cloud clients: {e}")
        else:
            print("Warning: Google Cloud credentials not found. Recommender features will be disabled.")

    def load(self):
        # Always load local data first
        self.data_df = self.load_data()
        print(f"Loaded {len(self.data_df)} tracks from local dataset")
        
        # Try to load FAISS index from GCS (optional)
        if self.bucket:
            try:
                self.faiss_index = self.load_faiss_index()
                self.track_features = self.load_track_features()
                print("FAISS index loaded from GCS")
            except Exception as e:
                print(f"Warning: Could not load FAISS from GCS: {e}")
                self.faiss_index = None
                self.track_features = None

    def load_data(self):
        return pd.read_csv("./data/dataset.csv")

    def load_faiss_index(self):
        if not self.bucket:
            return None
        blob = self.bucket.blob("music_index.index")
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            temp_file.write(blob.download_as_bytes())
            return faiss.read_index(temp_file.name)

    def load_track_features(self):
        if not self.bucket:
            return None
        blob = self.bucket.blob("full_features.pkl")
        return pickle.load(BytesIO(blob.download_as_bytes()))

    def get_recommendations(self, user_id):
        if not self.bq_client or not self.use_bigquery:
            # Fallback: return random tracks from dataset
            if self.data_df is not None:
                sample_tracks = self.data_df.sample(min(15, len(self.data_df)))
                return sample_tracks["track_id"].tolist()
            return []
        
        try:
            query = """
                SELECT track_id
                FROM `silicon-stock-452315-h4.music_recommend.recommend`
                WHERE user_id = @user_id
                ORDER BY recommended_at DESC
                LIMIT 15
            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("user_id", "STRING", user_id)
                ]
            )
            query_job = self.bq_client.query(query, job_config=job_config)
            results = query_job.result()
            return [row.track_id for row in results]
        except Exception as e:
            print(f"BigQuery error in get_recommendations: {e}")
            # Fallback: return random tracks from dataset
            if self.data_df is not None:
                sample_tracks = self.data_df.sample(min(15, len(self.data_df)))
                return sample_tracks["track_id"].tolist()
            return []
    
    def get_related_tracks(self, track_id):
        # Try BigQuery first
        if self.bq_client and self.use_bigquery:
            try:
                query = """
                    SELECT related_trackid
                    FROM `silicon-stock-452315-h4.music_recommend.related_song`
                    WHERE track_id = @track_id
                """
                job_config = bigquery.QueryJobConfig(
                    query_parameters=[
                        bigquery.ScalarQueryParameter("track_id", "STRING", track_id)
                    ]
                )
                query_job = self.bq_client.query(query, job_config=job_config)
                results = query_job.result()
                return [row.related_trackid for row in results]
            except Exception as e:
                print(f"BigQuery error in get_related_tracks: {e}")
                # Fall through to local FAISS fallback
        
        # Fallback: Use local FAISS index for similar tracks
        if self.faiss_index is not None and self.data_df is not None and self.track_features is not None:
            try:
                idx_list = self.data_df[self.data_df["track_id"] == track_id].index.tolist()
                if not idx_list:
                    return []
                idx = idx_list[0]
                query_vector = self.track_features[idx].reshape(1, -1).astype(np.float32)
                distances, indices = self.faiss_index.search(query_vector, 10)
                similar_ids = [
                    self.data_df.iloc[i]["track_id"]
                    for i in indices[0]
                    if self.data_df.iloc[i]["track_id"] != track_id
                ]
                return similar_ids
            except Exception as e:
                print(f"FAISS fallback error: {e}")
        
        return []

    def get_emo_recommendations(self, user_id, emo):
        if not self.bq_client or not self.use_bigquery:
            # Fallback: return random tracks from dataset
            if self.data_df is not None:
                sample_tracks = self.data_df.sample(min(15, len(self.data_df)))
                return sample_tracks["track_id"].tolist()
            return []
        
        emo = emo.lower()
        try:
            query = """
                SELECT track_id
                FROM `silicon-stock-452315-h4.music_recommend.emotion-recommend`
                WHERE user_id = @user_id 
                AND emotion = @emo 
                AND TIMESTAMP_TRUNC(recommended_at, MINUTE) = (
                    SELECT TIMESTAMP_TRUNC(MAX(recommended_at), MINUTE)
                    FROM `silicon-stock-452315-h4.music_recommend.emotion-recommend`
                    WHERE user_id = @user_id AND emotion = @emo
                );

            """
            job_config = bigquery.QueryJobConfig(
                query_parameters=[
                    bigquery.ScalarQueryParameter("user_id", "STRING", user_id),
                    bigquery.ScalarQueryParameter("emo", "STRING", emo),
                ]
            )
            query_job = self.bq_client.query(query, job_config=job_config)
            results = query_job.result()
            return [row.track_id for row in results]
        except Exception as e:
            print(f"BigQuery error in get_emo_recommendations: {e}")
            # Fallback: return random tracks from dataset
            if self.data_df is not None:
                sample_tracks = self.data_df.sample(min(15, len(self.data_df)))
                return sample_tracks["track_id"].tolist()
            return []
    
recommender = Recommender()
# Auto-load data when module is imported
try:
    recommender.load()
    print("Recommender data loaded successfully!")
except Exception as e:
    print(f"Warning: Failed to load recommender data: {e}")
