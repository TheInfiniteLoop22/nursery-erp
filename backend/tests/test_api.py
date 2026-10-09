import asyncio
import threading

import pytest

from app.models.employee_scan_log import EmployeeScanLog
from app.models.product import Product
from app.services.event_bus import EventBus
from tests.conftest import PASSWORD

API = "/api/v1"


# ------------------------------------------------------------------ auth
def test_login_returns_jwt_and_role(client, make_user, auth_headers):
    user = make_user("employee")
    headers = auth_headers(user)
    me = client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "employee"


def test_login_error_does_not_reveal_which_field_was_wrong(client, make_user):
    user = make_user("employee")
    wrong_pw = client.post(f"{API}/auth/login", json={"user_username": user.user_username, "user_password": "nope"})
    wrong_user = client.post(f"{API}/auth/login", json={"user_username": "no_such_user_xyz", "user_password": "nope"})
    assert wrong_pw.status_code == wrong_user.status_code == 401
    assert wrong_pw.json() == wrong_user.json()


def test_protected_route_requires_token(client):
    assert client.get(f"{API}/orders/all").status_code in (401, 403)
    bad = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer not.a.jwt"})
    assert bad.status_code == 401


# ------------------------------------------------------------------ RBAC
@pytest.mark.parametrize("role", ["employee", "nursery"])
def test_non_admin_cannot_register_users(client, make_user, auth_headers, role):
    headers = auth_headers(make_user(role))
    res = client.post(
        f"{API}/auth/register",
        headers=headers,
        json={"user_username": "x_should_not_exist", "user_password": "secret123", "role": "employee"},
    )
    assert res.status_code == 403


def test_admin_can_register_users(client, make_user, auth_headers, db):
    from app.models.user import UserTable

    headers = auth_headers(make_user("admin"))
    username = "t_reg_" + "abc123"
    db.query(UserTable).filter(UserTable.user_username == username).delete()
    db.commit()
    res = client.post(
        f"{API}/auth/register",
        headers=headers,
        json={"user_username": username, "user_password": "secret123", "role": "nursery"},
    )
    try:
        assert res.status_code == 200, res.text
        assert res.json()["role"] == "nursery"
        stored = db.query(UserTable).filter(UserTable.user_username == username).one()
        assert stored.user_password != "secret123"  # bcrypt hash, never plain text
        assert stored.user_password.startswith("$2")
    finally:
        db.query(UserTable).filter(UserTable.user_username == username).delete()
        db.commit()


# ------------------------------------------------------------------ scan pipeline
def test_scan_deducts_stock_and_logs(client, db, make_user, auth_headers, order_with_stock):
    order, product = order_with_stock
    employee = make_user("employee")
    res = client.post(
        f"{API}/employees/scan",
        headers=auth_headers(employee),
        json={"order_id": order.order_id, "product_id": product.product_id, "quantity_scanned": 1},
    )
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["new_inventory_quantity"] == 9
    assert body["remaining_order_quantity"] == 2

    db.expire_all()
    assert db.get(Product, product.product_id).inventory_quantity == 9
    assert db.query(EmployeeScanLog).filter(EmployeeScanLog.order_id == order.order_id).count() == 1


def test_scan_cannot_exceed_ordered_quantity(client, make_user, auth_headers, order_with_stock):
    order, product = order_with_stock
    headers = auth_headers(make_user("employee"))
    payload = {"order_id": order.order_id, "product_id": product.product_id, "quantity_scanned": 1}
    for _ in range(3):
        assert client.post(f"{API}/employees/scan", headers=headers, json=payload).status_code == 200
    fourth = client.post(f"{API}/employees/scan", headers=headers, json=payload)
    assert fourth.status_code == 400
    assert "fully scanned" in fourth.json()["detail"]


def test_scan_rejects_unknown_product(client, make_user, auth_headers, order_with_stock):
    order, _ = order_with_stock
    res = client.post(
        f"{API}/employees/scan",
        headers=auth_headers(make_user("employee")),
        json={"order_id": order.order_id, "product_id": "00000000", "quantity_scanned": 1},
    )
    assert res.status_code == 404


# ------------------------------------------------------------------ live updates (SSE bus)
def test_event_bus_delivers_events_published_from_worker_threads():
    bus = EventBus()

    async def scenario():
        queue = bus.subscribe()
        threading.Thread(target=bus.publish, args=("scan", {"order_id": "o1"})).start()
        event = await asyncio.wait_for(queue.get(), timeout=2)
        bus.unsubscribe(queue)
        return event

    event = asyncio.run(scenario())
    assert event["type"] == "scan"
    assert event["order_id"] == "o1"
    assert "at" in event
    assert bus.subscriber_count == 0


def test_event_bus_is_noop_without_subscribers():
    EventBus().publish("scan", {"order_id": "o1"})  # must not raise


def test_stream_rejects_bad_token(client):
    res = client.get(f"{API}/stream/events", params={"token": "definitely-not-a-valid-jwt"})
    assert res.status_code == 401


# ------------------------------------------------------------------ concurrency and rate limiting
def test_concurrent_scans_cannot_oversell_a_line(client, db, make_user, auth_headers, order_with_stock):
    """8 simultaneous scans against a line that needs 3 units: exactly 3 may succeed (row locks)."""
    from concurrent.futures import ThreadPoolExecutor

    order, product = order_with_stock
    headers = auth_headers(make_user("employee"))
    payload = {"order_id": order.order_id, "product_id": product.product_id, "quantity_scanned": 1}

    def scan(_):
        return client.post(f"{API}/employees/scan", headers=headers, json=payload).status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        codes = list(pool.map(scan, range(8)))

    assert codes.count(200) == 3, codes
    assert codes.count(400) == 5, codes
    db.expire_all()
    assert db.get(Product, product.product_id).inventory_quantity == 7
    scanned = sum(r.scanned_quantity for r in db.query(EmployeeScanLog).filter(EmployeeScanLog.order_id == order.order_id))
    assert scanned == 3


def test_login_is_rate_limited_after_repeated_failures(client, make_user):
    from app.core.rate_limit import login_limiter

    user = make_user("employee")
    login_limiter.reset()
    bad = {"user_username": user.user_username, "user_password": "wrong"}
    for _ in range(5):
        assert client.post(f"{API}/auth/login", json=bad).status_code == 401
    blocked = client.post(f"{API}/auth/login", json=bad)
    assert blocked.status_code == 429
    assert int(blocked.headers["Retry-After"]) > 0
    # the correct password is also refused while locked out, and other usernames are unaffected
    good = {"user_username": user.user_username, "user_password": PASSWORD}
    assert client.post(f"{API}/auth/login", json=good).status_code == 429
    other = make_user("employee")
    assert client.post(f"{API}/auth/login", json={"user_username": other.user_username, "user_password": PASSWORD}).status_code == 200
    login_limiter.reset()


def test_unpaginated_lists_accept_limit_and_offset(client, make_user, auth_headers):
    headers = auth_headers(make_user("admin"))
    for path in ("/events/all", "/notifications/low-stock"):
        assert client.get(f"{API}{path}?limit=1", headers=headers).status_code == 200, path
        assert len(client.get(f"{API}{path}?limit=1", headers=headers).json()) <= 1
        assert client.get(f"{API}{path}?limit=0", headers=headers).status_code == 422
        assert client.get(f"{API}{path}?limit=100000", headers=headers).status_code == 422
