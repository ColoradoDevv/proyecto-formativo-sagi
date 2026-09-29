# URLs del modulo returns.

from rest_framework.routers import DefaultRouter
from .views import LoanReturnViewSet

router = DefaultRouter()
router.register(r'', LoanReturnViewSet, basename='returns')

urlpatterns = router.urls