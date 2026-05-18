import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from minio import Minio


load_dotenv(override=True)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

s3_access_key = os.getenv("S3_ACCESS_KEY")
s3_secret_key = os.getenv("S3_SECRET_KEY")
s3_endpoint = os.getenv("S3_ENDPOINT", "http://localhost:9000")
s3_bucket = os.getenv("S3_BUCKET", "music")
s3_prefix = os.getenv("S3_PREFIX", "tracks").strip("/")


def s3_client() -> Minio:
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
        secure=secure,
    )


def safe_windows_filename(filename: str) -> str:
    invalid = '<>:"/\\|?*'
    cleaned = "".join("_" if char in invalid else char for char in filename)
    cleaned = cleaned.rstrip(" .")
    return cleaned or "track.mp3"


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Export MinIO track objects to a local folder.")
    parser.add_argument("output_dir", type=Path, help="Folder to save mp3 files into.")
    args = parser.parse_args()

    args.output_dir.mkdir(parents=True, exist_ok=True)
    client = s3_client()

    count = 0
    for obj in client.list_objects(s3_bucket, prefix=s3_prefix, recursive=True):
        if not obj.object_name.lower().endswith(".mp3"):
            continue

        filename = safe_windows_filename(Path(obj.object_name).name)
        output_path = args.output_dir / filename
        print(f"EXPORT {obj.object_name} -> {output_path}")
        client.fget_object(s3_bucket, obj.object_name, str(output_path))
        count += 1

    print(f"Exported {count} tracks to {args.output_dir}")


if __name__ == "__main__":
    main()
