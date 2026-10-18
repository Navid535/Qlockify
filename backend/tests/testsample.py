from pathlib import Path

from django.test import SimpleTestCase


ROOT = Path(__file__).resolve().parents[1]


def read_source(relative_path):
    return (ROOT / relative_path).read_text(encoding="utf-8")


class Chapter11ExerciseTests(SimpleTestCase):

    def test_base_dir_points_to_project_root(self):
        source = read_source('config/settings/base.py')
        self.assertIn('BASE_DIR = Path(__file__).resolve().parents[2]', source)


    def test_crispy_apps_are_registered(self):
        source = read_source('config/settings/base.py')
        self.assertIn('"crispy_forms"', source)
        self.assertIn('"crispy_bootstrap5"', source)


    def test_phase_one_apps_are_registered(self):
        source = read_source('config/settings/base.py')
        self.assertIn('"apps.users"', source)
        self.assertIn('"apps.workspaces"', source)
        self.assertIn('"apps.contact_notes"', source)
