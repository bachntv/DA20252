import argparse
import csv
from pathlib import Path

from upload_single_track import check_track_exists, download_mp3, s3_prefix, upload_to_s3


DATASET_PATH = Path(__file__).resolve().parents[1] / "data" / "dataset.csv"
AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".ogg"}


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def read_dataset_tracks(limit: int | None = None) -> list[str]:
    tracks = []
    seen = set()
    with DATASET_PATH.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            track_name = (row.get("track_name") or "").strip()
            if not track_name:
                continue
            key = normalize_name(track_name)
            if key in seen:
                continue
            seen.add(key)
            tracks.append(track_name)
            if limit and len(tracks) >= limit:
                break
    return tracks


def index_audio_folder(folder: Path) -> dict[str, Path]:
    files = {}
    for path in folder.rglob("*"):
        if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS:
            files[normalize_name(path.stem)] = path
    return files


def upload_from_folder(folder: Path, limit: int | None = None):
    audio_files = index_audio_folder(folder)
    tracks = read_dataset_tracks(limit)
    uploaded = 0
    missing = []

    print(f"Found {len(audio_files)} audio files in {folder}")
    print(f"Trying to upload {len(tracks)} dataset tracks to s3://.../{s3_prefix}/")

    for track_name in tracks:
        source = audio_files.get(normalize_name(track_name))
        if not source:
            missing.append(track_name)
            continue
        if check_track_exists(track_name):
            print(f"SKIP existing: {track_name}")
            continue
        print(f"UPLOAD local: {track_name} <- {source}")
        upload_to_s3(str(source), track_name)
        uploaded += 1

    print(f"Uploaded {uploaded} local tracks.")
    if missing:
        print(f"Missing local files for {len(missing)} tracks:")
        for track_name in missing[:20]:
            print(f"  - {track_name}")
        if len(missing) > 20:
            print(f"  ... and {len(missing) - 20} more")


def download_and_upload(limit: int, download_dir: Path | None = None):
    tracks = read_dataset_tracks(limit)
    uploaded = 0
    failed = []

    print(f"Downloading/uploading up to {len(tracks)} tracks from dataset.")
    if download_dir:
        download_dir.mkdir(parents=True, exist_ok=True)
        print(f"Keeping downloaded mp3 files in {download_dir}")

    for index, track_name in enumerate(tracks, start=1):
        print(f"[{index}/{len(tracks)}] {track_name}")
        if check_track_exists(track_name):
            print(f"SKIP existing: {track_name}")
            continue

        try:
            if download_dir:
                file_path = download_mp3(track_name, str(download_dir))
                upload_to_s3(file_path, track_name)
                uploaded += 1
            else:
                import tempfile

                with tempfile.TemporaryDirectory() as temp_dir:
                    file_path = download_mp3(track_name, temp_dir)
                    upload_to_s3(file_path, track_name)
                    uploaded += 1
        except Exception as exc:
            print(f"FAILED: {track_name}: {exc}")
            failed.append(track_name)

    print(f"Uploaded {uploaded} downloaded tracks.")
    if failed:
        print(f"Failed {len(failed)} tracks:")
        for track_name in failed:
            print(f"  - {track_name}")


def main():
    parser = argparse.ArgumentParser(
        description="Batch upload demo audio files to MinIO for tracks in data/dataset.csv."
    )
    parser.add_argument("--limit", type=int, default=20, help="Number of dataset tracks to process.")
    parser.add_argument("--folder", type=Path, help="Folder containing existing mp3/audio files.")
    parser.add_argument(
        "--download",
        action="store_true",
        help="Download missing audio from YouTube search results, then upload to MinIO.",
    )
    parser.add_argument(
        "--download-dir",
        type=Path,
        help="Keep downloaded mp3 files in this folder instead of using a temporary folder.",
    )
    args = parser.parse_args()

    if args.folder:
        upload_from_folder(args.folder, args.limit)
        return

    if args.download:
        download_and_upload(args.limit, args.download_dir)
        return

    parser.error("Choose either --folder <audio-folder> or --download.")


if __name__ == "__main__":
    main()
