# WSGI config for sia_api project.
#
# It exposes the WSGI callable as a module-level variable named ``application``.
#
# For more information on this file, see
# https://docs.djangoproject.com/en/6.0/howto/deployment/wsgi/
# Entrada WSGI para despliegues clasicos.

import os

from dotenv import load_dotenv

from django.core.wsgi import get_wsgi_application

load_dotenv()  # P0-1: gunicorn entra por aquí, no por manage.py

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'sia_api.settings')

application = get_wsgi_application()
