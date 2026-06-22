from .base import *  # noqa: F401, F403

DEBUG = False

SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
X_FRAME_OPTIONS = "DENY"

# Behind the nginx reverse proxy, SSL is terminated at nginx and requests
# reach Django over plain HTTP. Trust the X-Forwarded-Proto header so Django
# recognizes the original request as secure (request.is_secure() -> True).
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

# Django 4.0+ validates the Origin header of unsafe (POST) requests against
# this list. Required for the /admin/ login form to pass CSRF checks over HTTPS.
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=[
        "https://thearticleanalyzer.com",
        "https://www.thearticleanalyzer.com",
    ],
)
