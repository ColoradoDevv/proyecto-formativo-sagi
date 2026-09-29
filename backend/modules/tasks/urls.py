# URLs del modulo tasks.

from rest_framework.routers import DefaultRouter
from .views import TaskDefinitionViewSet, TaskAssignmentViewSet

router = DefaultRouter()
router.register(r'definitions', TaskDefinitionViewSet, basename='task-definitions')
router.register(r'assignments', TaskAssignmentViewSet, basename='task-assignments')

urlpatterns = router.urls
