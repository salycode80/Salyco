"""Shared fixtures for the article test modules.

Named so Django's discovery — which matches the glob `test*.py` — leaves it
alone. `testing.py` and `test_support.py` would both be imported as test
modules; `testing_support` is not.
"""
from django.test import override_settings

# The article templates are the project's first Django-rendered pages, and so
# the first thing here to use {% static %}. Production serves static files
# through whitenoise's manifest storage, so a URL exists only once
# collectstatic has written staticfiles.json — which happens at container start
# (Backend/entrypoint.sh:9) and never during a test run. Django's
# ManifestStaticFilesStorage skips the manifest when settings.DEBUG is true
# (contrib/staticfiles/storage.py:174), which is why a page renders fine under
# runserver and every test render dies with "Missing staticfiles manifest
# entry".
#
# Swapping in the plain storage is the honest trade: the assertion worth making
# in a test is that the template renders and the URL is a real path, not what
# whitenoise hashed the filename to. The bytes actually served through nginx are
# verified separately, on a running instance.
plain_staticfiles = override_settings(
    STORAGES={
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {
            "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
        },
    }
)
