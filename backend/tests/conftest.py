"""Shared fixtures. Tests run against whatever DATABASE_URL points at.

CI provides a throwaway Postgres service container; locally set TEST_DATABASE_URL
(backend/.env) to a Neon `test` branch. Every row the tests create uses a unique ``t_<uuid>`` id/username
and is deleted again, so the demo data is never touched.
"""

import os
import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
os.environ.setdefault("SECRET_KEY", "test-secret-key")

# Prefer a dedicated test database (e.g. a Neon `test` branch) so demo data is never touched.
# Read from the environment, or from backend/.env, before the app imports its DB engine.
_test_url = os.getenv("TEST_DATABASE_URL")
if not _test_url:
    try:
        from dotenv import dotenv_values

        _test_url = dotenv_values(Path(__file__).resolve().parent.parent / ".env").get("TEST_DATABASE_URL")
    except ImportError:
        _test_url = None
if _test_url:
    os.environ["DATABASE_URL"] = _test_url

from fastapi.testclient import TestClient  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.core.migrations import upgrade_to_head  # noqa: E402
from app.core.schema_sync import seed_default_zones  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models.employee_scan_log import EmployeeScanLog  # noqa: E402
from app.models.nursery import Nursery  # noqa: E402
from app.models.order_table import OrderTable  # noqa: E402
from app.models.ordered_products import OrderedProducts  # noqa: E402
from app.models.product import Product  # noqa: E402
from app.models.user import UserTable  # noqa: E402

PASSWORD = "Passw0rd!test"


def _uid() -> str:
    return "t_" + uuid.uuid4().hex[:10]


@pytest.fixture(scope="session", autouse=True)
def schema():
    upgrade_to_head()
    seed_default_zones()


@pytest.fixture()
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client():
    # No `with` block on purpose: that would re-run the app's startup schema sync
    # (ALTER TABLE) while fixtures hold open transactions, which blocks on locks.
    yield TestClient(app)


@pytest.fixture()
def make_user(db):
    created: list[str] = []

    def _make(role: str) -> UserTable:
        user = UserTable(
            user_id=_uid(),
            user_username=_uid(),
            user_password=hash_password(PASSWORD),
            role=role,
        )
        db.add(user)
        db.commit()
        created.append(user.user_id)
        return user

    yield _make

    db.rollback()
    for user_id in created:
        db.query(EmployeeScanLog).filter(EmployeeScanLog.employee_id == user_id).delete()
        db.query(OrderTable).filter(OrderTable.user_id == user_id).delete()
        db.query(UserTable).filter(UserTable.user_id == user_id).delete()
    db.commit()


@pytest.fixture()
def auth_headers(client):
    def _headers(user: UserTable) -> dict[str, str]:
        res = client.post(
            "/api/v1/auth/login",
            json={"user_username": user.user_username, "user_password": PASSWORD},
        )
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    return _headers


@pytest.fixture()
def order_with_stock(db, make_user):
    """An IN_PROGRESS order for 3 units of a product that has 10 in stock."""
    admin = make_user("admin")
    nursery = Nursery(nursery_id=_uid(), nursery_name="Test Vendor")
    product = Product(
        product_id=str(uuid.uuid4().int)[:8],
        nursery_id=nursery.nursery_id,
        item_name="Test Oak",
        section="tree",
        zones=1,
        size="2ft",
        inventory_quantity=10,
        ordered_quantity=0,
        low_stock_threshold=2,
        base_price_per_unit=10,
        rate_percentage=1,
    )
    order = OrderTable(
        order_id=_uid(),
        user_id=admin.user_id,
        client_name="Test Client",
        total_order_amount=30,
        status="IN_PROGRESS",
    )
    db.add(nursery)
    db.flush()
    db.add_all([product, order])
    db.flush()
    db.add(
        OrderedProducts(
            order_id=order.order_id,
            product_id=product.product_id,
            quantity=3,
            unit_price=10,
            rate_percentage=1,
            total_price=30,
        )
    )
    db.commit()

    yield order, product

    db.rollback()
    db.query(EmployeeScanLog).filter(EmployeeScanLog.order_id == order.order_id).delete()
    db.query(OrderedProducts).filter(OrderedProducts.order_id == order.order_id).delete()
    db.query(OrderTable).filter(OrderTable.order_id == order.order_id).delete()
    db.query(Product).filter(Product.product_id == product.product_id).delete()
    db.query(Nursery).filter(Nursery.nursery_id == nursery.nursery_id).delete()
    db.commit()
