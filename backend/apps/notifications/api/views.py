import json
import secrets
import time

from django.core.cache import cache
from django.http.response import StreamingHttpResponse, HttpResponse
from rest_framework import viewsets, status
from django.utils.crypto import get_random_string
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.notifications.api.serializers import NotificationSerializer
from apps.notifications.models import Notification


class NotificationViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return Notification.objects.filter(user=self.request.user)

    @action(detail=True, methods=["post"])
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"])
    def mark_all_read(self, request):
        count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"updated": count})

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"unread_count": self.get_queryset().filter(is_read=False).count()})


class NotificationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(user=request.user)
        serializer = NotificationSerializer(queryset, many=True)
        return Response({
            "count": queryset.count(),
            "unread_count": queryset.filter(is_read=False).count(),
            "notifications": serializer.data,
        })


class NotificationSeenAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        notification_id = request.data.get("id")
        updated = Notification.objects.filter(user=request.user, id=notification_id).update(is_read=True)
        return Response({"updated": updated})


class NotificationSeenAllAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        updated = Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"updated": updated})


class NotificationStreamTokenAPIView(APIView):
    permission_classes = (IsAuthenticated, )


    def post(self, request):
        token = get_random_string(32)
        expires_in = 300
        cache.set(f"notifications:sse:{token}", str(request.user.id), timeout=expires_in)
        return Response({"token": token, "expires_in": expires_in})

"""
    stream_token 30.0/50
        test_stream_token_endpoint_requires_authentication PASS
            test score ratio: 10.0/50
            test time: 0.002
        test_stream_token_endpoint_returns_token_and_expiry FAIL
            test score ratio: 10.0/50
            test time: 0.003
        test_stream_token_endpoint_returns_expiry_in_seconds FAIL
            test score ratio: 10.0/50
            test time: 0.003
        test_stream_token_is_stored_in_cache_for_current_user PASS
            test score ratio: 10.0/50
            test time: 0.002
        test_stream_token_url_is_registered PASS
            test score ratio: 10.0/50
            test time: 0.002
"""





def notification_stream(request):
    token = (request.GET.get("token") or "").strip()
    if not token:
        return HttpResponse("Missing token.", status=401)

    cached_user_id = cache.get(f"notifications:sse:{token}")
    if not cached_user_id:
        return HttpResponse("Invalid or expired token.", status=401)

    def events():
        last_id = None
        for _ in range(3):
            notification = Notification.objects.filter(user_id=cached_user_id).order_by("-created_at").first()
            if notification and notification.id != last_id:
                last_id = notification.id
                payload = NotificationSerializer(notification).data
                yield f"event: notification\ndata: {json.dumps(payload, default=str)}\n\n"
            else:
                yield "event: ping\ndata: {}\n\n"
            time.sleep(0.1)

    response = StreamingHttpResponse(events(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response







