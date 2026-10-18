from rest_framework.request import Request
from rest_framework.test import APIRequestFactory, APISimpleTestCase

from core.pagination import DefaultPagination


class PaginationAPIChecks(APISimpleTestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.queryset = list(range(1, 31))  # ۳۰ آیتم نمونه

    def paginate(self, query_string=''):
        django_request = self.factory.get(f'/fake-url/?{query_string}')
        request = Request(django_request)
        paginator = DefaultPagination()
        page = paginator.paginate_queryset(self.queryset, request)
        return paginator, page

    def test_default_pagination_returns_ten_items(self):
        paginator, page = self.paginate()
        self.assertEqual(len(page), 10)
        self.assertEqual(page, self.queryset[:10])

    def test_limit_parameter_controls_page_size(self):
        paginator, page = self.paginate('limit=5')
        self.assertEqual(len(page), 5)
        self.assertEqual(page, self.queryset[:5])

    def test_offset_parameter_controls_start_position(self):
        paginator, page = self.paginate('limit=5&offset=10')
        self.assertEqual(len(page), 5)
        self.assertEqual(page, self.queryset[10:15])

    def test_large_limit_is_limited_to_max_limit(self):
        paginator, page = self.paginate('limit=1000')
        self.assertEqual(len(page), min(len(self.queryset), paginator.max_limit))
        self.assertEqual(paginator.max_limit, 100)

    def test_paginated_response_contains_standard_keys(self):
        paginator, page = self.paginate()
        response = paginator.get_paginated_response(page)
        self.assertIn('count', response.data)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIn('results', response.data)
        self.assertEqual(response.data['count'], len(self.queryset))