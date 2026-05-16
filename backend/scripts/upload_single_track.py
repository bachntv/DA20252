"""
Script to upload a single missing track to MinIO.
Downloads the audio from YouTube and uploads to S3/MinIO.

Usage:
    cd backend
    python scripts/upload_single_track.py "Track Name Here"
    
Example:
    python scripts/upload_single_track.py "All I Want For Christmas Is A Real Good Tan"
"""
import os
import sys
from dotenv import load_dotenv
from minio import Minio
from yt_dlp import YoutubeDL
import tempfile

# Load environment variables from backend/.env
load_dotenv(override=True)

# S3/MinIO credentials
s3_access_key = os.getenv("S3_ACCESS_KEY")
s3_secret_key = os.getenv("S3_SECRET_KEY")
s3_endpoint = os.getenv("S3_ENDPOINT", "http://localhost:9000")
s3_bucket = os.getenv("S3_BUCKET", "music")
s3_prefix = os.getenv("S3_PREFIX", "tracks").strip("/")


def s3_client() -> Minio:
    """Create MinIO client"""
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


def list_existing_tracks():
    """List all existing tracks in MinIO"""
    client = s3_client()
    print(f"\n📁 Existing tracks in s3://{s3_bucket}/{s3_prefix}/:")
    print("-" * 50)
    count = 0
    for obj in client.list_objects(s3_bucket, prefix=s3_prefix, recursive=True):
        print(f"  - {obj.object_name}")
        count += 1
    print(f"\nTotal: {count} tracks")
    return count


def check_track_exists(track_name: str) -> bool:
    """Check if track already exists in MinIO"""
    client = s3_client()
    object_name = f"{s3_prefix}/{track_name.lower()}.mp3"
    try:
        client.stat_object(s3_bucket, object_name)
        return True
    except:
        return False


def download_mp3(track_name: str, output_dir: str) -> str:
    """Download MP3 from YouTube"""
    # Clean filename for filesystem
    safe_filename = "".join(c for c in track_name if c.isalnum() or c in (' ', '-', '_')).strip()
    if not safe_filename:
        safe_filename = "track"
    file_path = os.path.join(output_dir, f"{safe_filename}.mp3")
    
    # Clean up any existing partial/temp files
    import glob
    for ext in ['.mp4', '.webm', '.m4a', '.part', '.ytdl']:
        temp_file = file_path.replace('.mp3', ext)
        if os.path.exists(temp_file):
            try:
                os.remove(temp_file)
            except:
                pass
    
    for part_file in glob.glob(os.path.join(output_dir, f"{safe_filename}*part*")):
        try:
            os.remove(part_file)
        except:
            pass
    
    # Check for cookies file
    cookies_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'cookies.txt')
    cookies_exists = os.path.exists(cookies_path)
    
    ydl_opts = {
        'format': 'bestaudio/best',
        'outtmpl': file_path.replace(".mp3", ".%(ext)s"),
        'quiet': False,
        'ignoreerrors': False,
        'retries': 3,
        'fragment_retries': 3,
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'keepvideo': False,
    }
    
    # Add cookies if available
    if cookies_exists:
        ydl_opts['cookiefile'] = cookies_path
        print(f"🍪 Using YouTube cookies from: {cookies_path}")
    else:
        print(f"⚠️  No cookies file found at: {cookies_path}")
        print("   Tip: Export YouTube cookies to avoid bot detection")

    print(f"🔍 Searching YouTube for: {track_name}")
    with YoutubeDL(ydl_opts) as ydl:
        ydl.download([f"ytsearch1:{track_name}"])
    
    # Verify file exists and has content
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"MP3 file was not created: {file_path}")
    
    file_size = os.path.getsize(file_path)
    if file_size < 1000:  # Less than 1KB
        raise ValueError(f"Downloaded file is too small ({file_size} bytes): {file_path}")

    print(f"✅ Downloaded to: {file_path} ({file_size / 1024 / 1024:.2f} MB)")
    return file_path


def upload_to_s3(file_path: str, track_name: str):
    """Upload file to MinIO"""
    client = s3_client()
    
    # Ensure bucket exists
    if not client.bucket_exists(s3_bucket):
        client.make_bucket(s3_bucket)
        print(f"📦 Created bucket: {s3_bucket}")
    
    object_name = f"{s3_prefix}/{track_name.lower()}.mp3"
    
    client.fput_object(
        bucket_name=s3_bucket,
        object_name=object_name,
        file_path=file_path,
        content_type="audio/mpeg"
    )
    print(f"✅ Uploaded to: s3://{s3_bucket}/{object_name}")


def upload_track(track_name: str):
    """Download and upload a single track"""
    print(f"\n🎵 Processing: {track_name}")
    print("=" * 50)
    
    # Check if already exists
    if check_track_exists(track_name):
        print(f"⚠️  Track already exists in MinIO, skipping...")
        return
    
    # Create temp directory for download
    with tempfile.TemporaryDirectory() as temp_dir:
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                print(f"\n🔄 Attempt {attempt}/{max_attempts}")
                
                # Download from YouTube
                file_path = download_mp3(track_name, temp_dir)
                
                # Upload to MinIO
                upload_to_s3(file_path, track_name)
                
                print(f"\n🎉 Successfully uploaded: {track_name}")
                break
                
            except Exception as e:
                print(f"\n❌ Error on attempt {attempt}: {e}")
                
                # Clean up any partial files
                import glob
                for temp_file in glob.glob(os.path.join(temp_dir, "*")):
                    try:
                        if os.path.exists(temp_file):
                            os.remove(temp_file)
                    except:
                        pass
                
                if attempt < max_attempts:
                    print(f"⏳ Retrying in 2 seconds...")
                    import time
                    time.sleep(2)
                else:
                    print(f"\n💥 Failed after {max_attempts} attempts")
                    raise


def main():
    if len(sys.argv) < 2:
        print("Usage: python upload_single_track.py <track_name>")
        print("       python upload_single_track.py --list")
        print("\nExample:")
        print('  python upload_single_track.py "All I Want For Christmas Is A Real Good Tan"')
        sys.exit(1)
    
    if sys.argv[1] == "--list":
        list_existing_tracks()
    else:
        track_name = " ".join(sys.argv[1:])
        upload_track(track_name)


if __name__ == "__main__":
    main()
