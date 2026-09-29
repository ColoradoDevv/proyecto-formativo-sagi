# ASGI config for sia_api project.
#
# It exposes the ASGI callable as a module-level variable named ``application``.
#
# For more information on this file, see
# https://docs.djangoproject.com/en/6.0/howto/deployment/asgi/
# Entrada ASGI para despliegues async.

import os

from dotenv import load_dotenv

from django.core.asgi import get_asgi_application

load_dotenv()  # P0-1: misma razón que wsgi.py

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')

application = get_asgi_application()
