import os
from minio import Minio
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv(override=True)

s3_access_key = os.getenv("S3_ACCESS_KEY")
s3_secret_key = os.getenv("S3_SECRET_KEY")
s3_endpoint = os.getenv("S3_ENDPOINT")
s3_bucket = os.getenv("S3_BUCKET")
s3_prefix = os.getenv("S3_PREFIX", "").strip("/")

PRESIGNED_URL_EXPIRES = 3600  # This is an int in seconds, which is correct

def s3_client() -> Minio:
    # Parse endpoint - remove http:// or https:// prefix if present
    endpoint = s3_endpoint
    secure = False
    if endpoint.startswith("https://"):
        endpoint = endpoint[8:]
        secure = True
    elif endpoint.startswith("http://"):
        endpoint = endpoint[7:]
        secure = False
    
    return Minio(
        endpoint=endpoint,
        access_key=s3_access_key,
        secret_key=s3_secret_key,
        secure=secure
    )

def generate_presigned_url(filename: str) -> str:
    client = s3_client()

    filename = filename.replace("'", "'").lower()

    object_key = f"{s3_prefix}/{filename}.mp3"

    try:
        url = client.presigned_get_object(
            bucket_name=s3_bucket,
            object_name=object_key,
            expires=timedelta(seconds=3600)
        )
        return url
    except Exception as e:
        print(f"Error generating presigned URL for {filename}: {e}")
        return None
    
def debug_list_keys():
    client = s3_client()
    for obj in client.list_objects(s3_bucket, prefix=s3_prefix, recursive=True):
        print("DEBUG S3 KEY:", obj.object_name)