from collections import defaultdict

from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.time_entries.api.serializers import TimeEntrySerializer
from apps.time_entries.models import TimeEntry
from core.cache import (
    request_cache_key,
    get_cached_response,
    set_cached_response,
    bump_user_cache_version,
)


class TimeEntryViewSet(viewsets.ModelViewSet):
    serializer_class = TimeEntrySerializer
    permission_classes = [IsAuthenticated]
    cache_namespace = "timesheet"

    def get_queryset(self):
        query_set = (
            TimeEntry.objects
            .visible_to(self.request.user)
            .select_related(
                "project",
                "project__client",
                "workspace",
                "user",
            )
            .prefetch_related("tags")
        )

        filters = {
            "workspace": self.request.query_params.get("workspace"),
            "project": self.request.query_params.get("project"),
            "project_id": self.request.query_params.get("project_id"),
            "client": self.request.query_params.get("client"),
            "client_id": self.request.query_params.get("client_id"),
            "search": self.request.query_params.get("search"),
            "status": self.request.query_params.get("status"),
            "started_after": self.request.query_params.get("started_after"),
            "started_before": self.request.query_params.get("started_before"),
            "tags": self.request.query_params.getlist("tags"),
            "tag": self.request.query_params.get("tag"),
            "tag_id": self.request.query_params.get("tag_id"),
            "ordering": self.request.query_params.get("ordering"),
        }

        if filters["workspace"]:
            query_set = query_set.filter(
                workspace_id=filters["workspace"]
            )

        project = filters["project"] or filters["project_id"]

        if project:
            query_set = query_set.filter(
                project_id=project
            )

        client = filters["client"] or filters["client_id"]

        if client:
            query_set = query_set.filter(
                project__client_id=client
            )
        search = filters["search"]

        if search:
            query_set = query_set.filter(
                Q(description__icontains=search)
                | Q(project__name__icontains=search)
                | Q(tags__name__icontains=search)
            )

        status_value = filters["status"]

        if status_value == "running":
            query_set = query_set.filter(
                end_time__isnull=True
            )
        elif status_value == "ended":
            query_set = query_set.filter(
                end_time__isnull=False
            )

        started_after = filters["started_after"]

        if started_after:
            parsed = parse_datetime(started_after)

            if parsed is not None:
                query_set = query_set.filter(
                    start_time__gte=parsed
                )

        started_before = filters["started_before"]

        if started_before:
            parsed = parse_datetime(started_before)

            if parsed is not None:
                query_set = query_set.filter(
                    start_time__lte=parsed
                )

        tag_values = []

        tag_values.extend(self.request.query_params.getlist("tags"))
        tag_values.extend(self.request.query_params.getlist("tag"))
        tag_values.extend(self.request.query_params.getlist("tag_id"))

        if tag_values:
            tag_ids = []

            for value in tag_values:
                tag_ids.extend(
                    tag_id.strip()
                    for tag_id in value.split(",")
                    if tag_id.strip()
                )

            query_set = query_set.filter(tags__id__in=tag_ids)

        allowed_ordering = {
            "start_time",
            "-start_time",
            "created_at",
            "-created_at",
        }

        ordering = filters["ordering"]

        if ordering in allowed_ordering:
            query_set = query_set.order_by(ordering)
        else:
            query_set = query_set.order_by("-start_time")

        return query_set.distinct()


    @action(detail=False, methods=["post"])
    def start(self, request):
        data = {
            "workspace": request.data.get("workspace"),
        }

        if request.data.get("start_time") is not None:
            data["start_time"] = request.data.get("start_time")

        if request.data.get("project") is not None:
            data["project"] = request.data.get("project")

        if request.data.get("project_id") is not None:
            data["project_id"] = request.data.get("project_id")

        if request.data.get("tags") is not None:
            data["tags"] = request.data.get("tags")

        if request.data.get("description") is not None:
            data["description"] = request.data.get("description")

        if request.data.get("is_billable") is not None:
            data["is_billable"] = request.data.get("is_billable")

        if "start_time" not in data:
            data["start_time"] = timezone.now()

        serializer = TimeEntrySerializer(
            data=data,
            context={"request": request},
        )

        serializer.is_valid(raise_exception=True)
        entry = serializer.save()

        bump_user_cache_version(
            user_id=entry.user.id,
            namespace=self.cache_namespace,
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"])
    def running(self, request):
        rsp = self.get_queryset().running().first()
        if rsp is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        serializer = TimeEntrySerializer(rsp, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def stop(self, request, pk=None):
        entry = self.get_object()
        if entry is None:
            return Response(status=status.HTTP_404_NOT_FOUND)
        end_time = request.data.get("end_time")
        if end_time is None:
            end_time = timezone.now()
        else:
            end_time = parse_datetime(end_time)
        if end_time <= entry.start_time:
            return Response(
                {"end_time": "End time must be greater than start time."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        entry.stop(end_time)

        bump_user_cache_version(
            user_id=entry.user.id,
            namespace=self.cache_namespace,
        )

        serializer = TimeEntrySerializer(entry, context={"request": request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def _grouped_response(self, request):
        cache_key = request_cache_key(
            user_id=request.user.id,
            namespace=self.cache_namespace,
            query_params=request.query_params
        )
        cached_response = get_cached_response(cache_key)
        if cached_response is not None:
            return Response(cached_response)

        queryset = self.get_queryset()

        entries = list(queryset)

        grouped_entries = defaultdict(list)

        for entry in entries:
            date_key = entry.start_time.date().isoformat()
            grouped_entries[date_key].append(entry)

        groups = []
        seen_dates = set()

        for entry in entries:
            date_key = entry.start_time.date().isoformat()

            if date_key in seen_dates:
                continue

            seen_dates.add(date_key)

            day_entries = grouped_entries[date_key]

            total_ms = sum(
                (entry.duration_seconds or 0) * 1000
                for entry in day_entries
            )

            serializer = TimeEntrySerializer(
                day_entries,
                many=True,
                context={"request": request},
            )

            groups.append({
                "key": date_key,
                "week_start": date_key,
                "week_end": date_key,
                "total_ms": total_ms,
                "days": [
                    {
                        "key": date_key,
                        "date": date_key,
                        "total_ms": total_ms,
                        "entries": serializer.data,
                    }
                ],
            })

        server_now = timezone.now()
        response_data = {
            "items_per_page": 10,
            "current_page_items_count": len(entries),
            "total_items": len(entries),
            "offset": 0,
            "next_offset": None,
            "has_more": False,
            "server_now_ms": int(server_now.timestamp() * 1000),
            "server_now": server_now.isoformat(),
            "groups": groups,
        }
        set_cached_response(cache_key, response_data)
        return Response(response_data)


    def list(self, request, *args, **kwargs):
        return self._grouped_response(request)

    @action(detail=False, methods=["get"])
    def grouped(self, request):
        return self._grouped_response(request)


    def perform_create(self, serializer):
        entry = serializer.save()
        bump_user_cache_version(
            user_id=entry.user.id,
            namespace=self.cache_namespace
        )

    def perform_update(self, serializer):
        entry = serializer.save()
        bump_user_cache_version(
            user_id=entry.user.id,
            namespace=self.cache_namespace
        )

    def perform_destroy(self, instance):
        user_id = instance.user.id
        instance.delete()
        bump_user_cache_version(
            user_id=user_id,
            namespace=self.cache_namespace
        )
