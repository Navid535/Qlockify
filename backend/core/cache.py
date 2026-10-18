from urllib.parse import urlencode

from django.core.cache import cache


def user_cache_key(user_id, namespace, value="list"):
    return f"quera-clock:user:{user_id}:{namespace}:{value}"


def user_cache_version_key(user_id, namespace):
    return user_cache_key(user_id, namespace, "version")


def get_user_cache_version(user_id, namespace):
    return cache.get(user_cache_version_key(user_id, namespace), 1)


def bump_user_cache_version(user_id, namespace):
    version_key = user_cache_version_key(user_id, namespace)
    version = cache.get(version_key, 1) + 1
    cache.set(version_key, version, timeout=None)
    return version


def request_cache_key(user_id, namespace, query_params):
    pairs = []
    for key in sorted(query_params.keys()):
        for value in sorted(query_params.getlist(key)):
            pairs.append((key, value))
    suffix = urlencode(pairs) or "list"
    version = get_user_cache_version(user_id, namespace)
    return user_cache_key(user_id, namespace, f"v{version}:{suffix}")


def get_cached_response(key):
    return cache.get(key)


def set_cached_response(key, data, timeout=60):
    cache.set(key, data, timeout=timeout)
    return data


def clear_cached_response(key):
    cache.delete(key)
