from django.contrib import messages
from django.contrib.auth.mixins import LoginRequiredMixin
from django.db.models import Count
from django.shortcuts import render
from django.urls import reverse_lazy
from django.views.generic import TemplateView, FormView

from apps.clients.models import Client
from apps.contact_notes.forms import ContactNoteForm
from apps.projects.models import Project
from apps.tags.models import Tag
from apps.time_entries.models import TimeEntry
from apps.workspaces.models import Workspace


class LandingView(TemplateView):
    template_name = "pages/landing.html"

    def get_context_data(self, **kwargs):
        return {
            "workspace_count": Workspace.objects.all().count(),
            "project_count": Project.objects.all().count(),
        }


class StatusView(TemplateView):
    template_name = "pages/status.html"

    def get_context_data(self, **kwargs):
        return {
            "workspace_count": Workspace.objects.all().count(),
            "client_count": Client.objects.all().count(),
            "project_count": Project.objects.all().count(),
            "tag_count": Tag.objects.all().count(),
            "time_entry_count": TimeEntry.objects.all().count(),
            "running_timer_count": TimeEntry.objects.running().count()
        }

class AboutView(FormView):
    template_name = "pages/about.html"
    form_class = ContactNoteForm
    success_url = reverse_lazy('workspaces:about')

    def form_valid(self, form):
        cn = form.save(commit=False)
        messages.success(self.request, "Your contact form was successfully created.")
        cn.save()
        return super().form_valid(form)


class DashboardPreviewView(LoginRequiredMixin, TemplateView):
    template_name = "pages/dashboard.html"

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context["workspaces"] = Workspace.objects.visible_to(self.request.user).annotate(
            membership_count=Count("memberships")
        )
        context["running_timer_count"] = TimeEntry.objects.visible_to(self.request.user).running().count()
        context["recent_entries"] = TimeEntry.objects.visible_to(self.request.user).select_related(
            "project", "workspace"
        )[:5]
        return context

