"""Storage for checklist runs."""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional

from .models import (
    ChecklistRun,
    ChecklistTemplate,
    ItemStatus,
    TestMetadata,
    run_from_dict,
    run_to_dict,
    template_from_dict,
)


class ChecklistStorage:
    """Simple file-based storage for checklist runs."""

    def __init__(self, storage_path: Path):
        """Initialize storage.

        Args:
            storage_path: Path to storage directory
        """
        self.storage_path = storage_path
        self.runs_path = storage_path / "runs"
        self.runs_path.mkdir(parents=True, exist_ok=True)

    def create_run(self, user_id: str, project_id: Optional[str] = None) -> ChecklistRun:
        """Create a new checklist run.

        Args:
            user_id: User identifier
            project_id: Optional project identifier

        Returns:
            Created ChecklistRun
        """
        run_id = str(uuid.uuid4())
        run = ChecklistRun(id=run_id, user_id=user_id, project_id=project_id)
        self._save_run(run)
        return run

    def get_run(self, run_id: str) -> Optional[ChecklistRun]:
        """Get a checklist run by ID.

        Args:
            run_id: Run identifier

        Returns:
            ChecklistRun or None if not found
        """
        run_file = self.runs_path / f"{run_id}.json"
        if not run_file.exists():
            return None

        with open(run_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        return run_from_dict(data)

    def update_run(
        self, run_id: str, marks: Dict[str, str], metadata: Optional[Dict[str, str]] = None
    ) -> Optional[ChecklistRun]:
        """Update marks and metadata for a checklist run.

        Args:
            run_id: Run identifier
            marks: Dictionary of item_id -> status
            metadata: Optional dictionary with test metadata

        Returns:
            Updated ChecklistRun or None if not found
        """
        run = self.get_run(run_id)
        if not run:
            return None

        # Update marks
        for item_id, status_str in marks.items():
            run.marks[item_id] = ItemStatus(status_str)

        # Update metadata if provided
        if metadata:
            run.metadata = TestMetadata(
                tester_name=metadata.get("tester_name"),
                test_environment=metadata.get("test_environment"),
                browser_platform=metadata.get("browser_platform"),
                test_duration=metadata.get("test_duration"),
                additional_notes=metadata.get("additional_notes"),
            )

        run.updated_at = datetime.now()
        self._save_run(run)
        return run

    def _save_run(self, run: ChecklistRun):
        """Save a run to disk.

        Args:
            run: ChecklistRun to save
        """
        run_file = self.runs_path / f"{run.id}.json"
        with open(run_file, "w", encoding="utf-8") as f:
            json.dump(run_to_dict(run), f, indent=2)


def load_template() -> ChecklistTemplate:
    """Load the checklist template from seed file.

    Returns:
        ChecklistTemplate
    """
    template_path = Path(__file__).parent / "seed_template.json"
    with open(template_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    return template_from_dict(data)
