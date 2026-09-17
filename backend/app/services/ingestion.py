import os
import shutil
import tempfile
import time
import zipfile
from pathlib import Path
from git import Repo # type: ignore


MAX_ARCHIVE_SIZE_BYTES = int(os.getenv("REPOSEER_MAX_ARCHIVE_SIZE_MB", "50")) * 1024 * 1024
MAX_EXTRACTED_SIZE_BYTES = int(os.getenv("REPOSEER_MAX_EXTRACTED_SIZE_MB", "250")) * 1024 * 1024
MAX_ARCHIVE_FILES = int(os.getenv("REPOSEER_MAX_ARCHIVE_FILES", "10000"))


class IngestionService:
    """Handles local directory scanning and temporary GitHub cloning."""

    @staticmethod
    def clone_github_repo(repo_url: str) -> str:
        """Clones a public GitHub repo into a temporary system directory."""
        temp_dir = tempfile.mkdtemp(prefix="reposeer_repo_")
        try:
            Repo.clone_from(repo_url, temp_dir, depth=1)
            return temp_dir
        except Exception as e:
            if os.path.exists(temp_dir):
                shutil.rmtree(temp_dir)
            raise RuntimeError(f"Failed to clone repository: {str(e)}")

    @staticmethod
    def collect_python_files(target_path: str) -> list[dict[str, str]]:
        """Walks target directory and extracts paths + source code for all .py files."""
        root_path = Path(target_path)
        python_files = []

        if not root_path.exists():
            raise FileNotFoundError(f"Path does not exist: {target_path}")

        for path in root_path.rglob("*.py"):
            # Skip virtual environments and common hidden/build folders
            if any(part.startswith(".") or part in ("venv", "env", "__pycache__", "build", "dist") for part in path.parts):
                continue

            try:
                relative_path = str(path.relative_to(root_path))
                with open(path, "r", encoding="utf-8") as f:
                    content = f.read()

                python_files.append({
                    "relative_path": relative_path,
                    "absolute_path": str(path),
                    "code": content
                })
            except Exception:
                # Skip unreadable or non-UTF8 files gracefully
                continue

        return python_files

    @staticmethod
    def extract_zip_safely(archive: zipfile.ZipFile, destination: str) -> None:
        """Validate and extract an uploaded archive within configured limits."""
        destination_path = Path(destination).resolve()
        entries = archive.infolist()
        file_entries = [entry for entry in entries if not entry.is_dir()]

        if len(file_entries) > MAX_ARCHIVE_FILES:
            raise ValueError(
                f"The uploaded ZIP contains too many files. The limit is {MAX_ARCHIVE_FILES:,}."
            )

        extracted_size = sum(entry.file_size for entry in file_entries)
        if extracted_size > MAX_EXTRACTED_SIZE_BYTES:
            limit_mb = MAX_EXTRACTED_SIZE_BYTES // (1024 * 1024)
            raise ValueError(
                f"The uploaded ZIP expands beyond the {limit_mb}MB extraction limit."
            )

        for entry in entries:
            entry_path = Path(entry.filename)
            target_path = (destination_path / entry_path).resolve()
            if target_path != destination_path and destination_path not in target_path.parents:
                raise ValueError("The uploaded ZIP contains an unsafe path.")

            unix_mode = (entry.external_attr >> 16) & 0o170000
            if unix_mode == 0o120000:
                raise ValueError("The uploaded ZIP contains an unsupported symbolic link.")

        destination_path.mkdir(parents=True, exist_ok=True)
        for entry in entries:
            target_path = destination_path / Path(entry.filename)
            if entry.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue

            target_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry, "r") as source, target_path.open("wb") as target:
                shutil.copyfileobj(source, target)

    @staticmethod
    def cleanup_temp_dir(temp_dir: str) -> None:
        """Removes temporary repository clone directory."""
        temp_path = Path(temp_dir).resolve()
        temp_root = Path(tempfile.gettempdir()).resolve()
        is_reposeer_temp = (
            temp_path.parent == temp_root
            and temp_path.name.startswith(("reposeer_repo_", "reposeer_upload_"))
        )
        if temp_path.exists() and is_reposeer_temp:
            shutil.rmtree(temp_dir, ignore_errors=True)

    @staticmethod
    def cleanup_expired_temp_dirs(max_age_seconds: int) -> None:
        """Removes abandoned Reposeer temp directories older than the retention window."""
        temp_root = Path(tempfile.gettempdir()).resolve()
        current_time = time.time()
        for prefix in ("reposeer_repo_", "reposeer_upload_"):
            for temp_path in temp_root.glob(f"{prefix}*"):
                try:
                    if temp_path.is_dir() and current_time - temp_path.stat().st_mtime > max_age_seconds:
                        shutil.rmtree(temp_path, ignore_errors=True)
                except OSError:
                    continue