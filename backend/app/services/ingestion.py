import os
import shutil
import tempfile
from pathlib import Path
from git import Repo # type: ignore


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
    def cleanup_temp_dir(temp_dir: str) -> None:
        """Removes temporary repository clone directory."""
        if os.path.exists(temp_dir) and "reposeer_repo_" in temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)