from sqlalchemy import inspect, text

from app.core.database import engine


def _ensure_user_role_constraint() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "user_table" not in existing_tables:
        return

    with engine.begin() as connection:
        # Recreate check constraint with nursery support (PostgreSQL-safe idempotent flow).
        connection.execute(text("ALTER TABLE user_table DROP CONSTRAINT IF EXISTS role_check"))
        connection.execute(
            text(
                "ALTER TABLE user_table "
                "ADD CONSTRAINT role_check "
                "CHECK (role in ('admin', 'employee', 'nursery', 'head_installation', 'head_maintenance'))"
            )
        )


def _ensure_user_hourly_rate_column() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "user_table" not in existing_tables:
        return

    columns = {column["name"] for column in inspector.get_columns("user_table")}

    with engine.begin() as connection:
        if "hourly_rate" not in columns:
            connection.execute(text("ALTER TABLE user_table ADD COLUMN hourly_rate NUMERIC(10, 2)"))
        connection.execute(text("UPDATE user_table SET hourly_rate = 0 WHERE hourly_rate IS NULL"))
        connection.execute(text("ALTER TABLE user_table ALTER COLUMN hourly_rate SET DEFAULT 0"))
        connection.execute(text("ALTER TABLE user_table ALTER COLUMN hourly_rate SET NOT NULL"))

        if "hourly_rate_multiplier" not in columns:
            connection.execute(text("ALTER TABLE user_table ADD COLUMN hourly_rate_multiplier NUMERIC(14, 6)"))
        connection.execute(text("UPDATE user_table SET hourly_rate_multiplier = 1.0 WHERE hourly_rate_multiplier IS NULL"))
        connection.execute(text("ALTER TABLE user_table ALTER COLUMN hourly_rate_multiplier SET DEFAULT 1.0"))
        connection.execute(text("ALTER TABLE user_table ALTER COLUMN hourly_rate_multiplier SET NOT NULL"))


def _ensure_product_columns() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "product" not in existing_tables:
        return

    columns = {column["name"] for column in inspector.get_columns("product")}

    with engine.begin() as connection:
        if "section" not in columns:
            connection.execute(text("ALTER TABLE product ADD COLUMN section VARCHAR"))
        if "zones" not in columns:
            connection.execute(text("ALTER TABLE product ADD COLUMN zones INTEGER"))
        if "subzone" not in columns:
            connection.execute(text("ALTER TABLE product ADD COLUMN subzone VARCHAR"))
        if "gallons" not in columns:
            connection.execute(text("ALTER TABLE product ADD COLUMN gallons VARCHAR"))
        else:
            connection.execute(text("ALTER TABLE product ALTER COLUMN gallons TYPE VARCHAR USING gallons::text"))

        connection.execute(text("UPDATE product SET section = 'tree' WHERE section IS NULL OR section = ''"))
        connection.execute(text("UPDATE product SET zones = 1 WHERE zones IS NULL"))
        connection.execute(text("ALTER TABLE product ALTER COLUMN section SET DEFAULT 'tree'"))
        connection.execute(text("ALTER TABLE product ALTER COLUMN section SET NOT NULL"))
        connection.execute(text("ALTER TABLE product ALTER COLUMN zones SET DEFAULT 1"))
        connection.execute(text("ALTER TABLE product ALTER COLUMN zones SET NOT NULL"))


def _ensure_product_submission_columns() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "product_submission" not in existing_tables:
        return

    columns = {column["name"] for column in inspector.get_columns("product_submission")}

    with engine.begin() as connection:
        if "section" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN section VARCHAR"))
        if "zones" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN zones INTEGER"))
        if "subzone" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN subzone VARCHAR"))
        if "gallons" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN gallons VARCHAR"))
        else:
            connection.execute(text("ALTER TABLE product_submission ALTER COLUMN gallons TYPE VARCHAR USING gallons::text"))
        if "barcode_status" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN barcode_status VARCHAR"))
        if "barcode_printed_at" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN barcode_printed_at TIMESTAMPTZ"))
        if "barcode_printed_by" not in columns:
            connection.execute(text("ALTER TABLE product_submission ADD COLUMN barcode_printed_by VARCHAR"))

        connection.execute(text("UPDATE product_submission SET section = 'tree' WHERE section IS NULL OR section = ''"))
        connection.execute(text("UPDATE product_submission SET zones = 1 WHERE zones IS NULL"))
        connection.execute(text("UPDATE product_submission SET barcode_status = 'NOT_SET' WHERE barcode_status IS NULL OR barcode_status = ''"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN section SET DEFAULT 'tree'"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN section SET NOT NULL"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN zones SET DEFAULT 1"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN zones SET NOT NULL"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN barcode_status SET DEFAULT 'NOT_SET'"))
        connection.execute(text("ALTER TABLE product_submission ALTER COLUMN barcode_status SET NOT NULL"))


def _ensure_performance_indexes() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    statements: list[str] = []
    if "order_table" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_order_table_status ON order_table(status)",
            "CREATE INDEX IF NOT EXISTS idx_order_table_ordered_at ON order_table(ordered_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_order_table_status_ordered_at ON order_table(status, ordered_at DESC)",
        ])
    if "ordered_products" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_ordered_products_order_id ON ordered_products(order_id)",
            "CREATE INDEX IF NOT EXISTS idx_ordered_products_product_id ON ordered_products(product_id)",
        ])
    if "product" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_product_item_name ON product(item_name)",
            "CREATE INDEX IF NOT EXISTS idx_product_section ON product(section)",
            "CREATE INDEX IF NOT EXISTS idx_product_nursery_item_name ON product(nursery_id, item_name)",
        ])
    if "notification" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_notification_created_at ON notification(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_notification_reference_id ON notification(reference_id)",
            "CREATE INDEX IF NOT EXISTS idx_notification_type ON notification(type)",
        ])
    if "product_submission" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_product_submission_status ON product_submission(status)",
            "CREATE INDEX IF NOT EXISTS idx_product_submission_created_at ON product_submission(created_at DESC)",
            "CREATE INDEX IF NOT EXISTS idx_product_submission_status_created_at ON product_submission(status, created_at DESC)",
        ])
    if "employee_scan_log" in existing_tables:
        statements.extend([
            "CREATE INDEX IF NOT EXISTS idx_employee_scan_log_order_product ON employee_scan_log(order_id, product_id)",
            "CREATE INDEX IF NOT EXISTS idx_employee_scan_log_employee_scanned_at ON employee_scan_log(employee_id, scanned_at DESC)",
        ])

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def _ensure_order_table_designer_column() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "order_table" not in existing_tables:
        return
    columns = {column["name"] for column in inspector.get_columns("order_table")}
    if "designer_name" in columns:
        return
    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE order_table ADD COLUMN designer_name VARCHAR(50)"))


def _ensure_order_table_work_order_type_column() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "order_table" not in existing_tables:
        return

    columns = {column["name"] for column in inspector.get_columns("order_table")}

    with engine.begin() as connection:
        if "work_order_type" not in columns:
            connection.execute(text("ALTER TABLE order_table ADD COLUMN work_order_type VARCHAR(20)"))

        connection.execute(text("UPDATE order_table SET work_order_type = 'INSTALL' WHERE work_order_type IS NULL OR work_order_type = ''"))
        connection.execute(text("ALTER TABLE order_table ALTER COLUMN work_order_type SET DEFAULT 'INSTALL'"))
        connection.execute(text("ALTER TABLE order_table ALTER COLUMN work_order_type SET NOT NULL"))
        connection.execute(text("ALTER TABLE order_table DROP CONSTRAINT IF EXISTS order_table_work_order_type_check"))
        connection.execute(
            text(
                "ALTER TABLE order_table ADD CONSTRAINT order_table_work_order_type_check "
                "CHECK (work_order_type in ('MAINTENANCE', 'INSTALL'))"
            )
        )


def _ensure_nursery_vendor_contact_columns() -> None:
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    if "nursery" not in existing_tables:
        return

    columns = {column["name"] for column in inspector.get_columns("nursery")}

    with engine.begin() as connection:
        if "contact_email" not in columns:
            connection.execute(text("ALTER TABLE nursery ADD COLUMN contact_email VARCHAR(255)"))
        if "contact_phone" not in columns:
            connection.execute(text("ALTER TABLE nursery ADD COLUMN contact_phone VARCHAR(64)"))
        if "notes" not in columns:
            connection.execute(text("ALTER TABLE nursery ADD COLUMN notes TEXT"))


def _widen_product_rate_columns() -> None:
    """Allow price multiplier precision (was percent with fewer decimals)."""
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "product" in existing_tables:
            try:
                connection.execute(
                    text(
                        "ALTER TABLE product ALTER COLUMN rate_percentage "
                        "TYPE NUMERIC(14, 6) USING rate_percentage::numeric"
                    )
                )
            except Exception:
                pass
        if "ordered_products" in existing_tables:
            try:
                connection.execute(
                    text(
                        "ALTER TABLE ordered_products ALTER COLUMN rate_percentage "
                        "TYPE NUMERIC(14, 6) USING rate_percentage::numeric"
                    )
                )
            except Exception:
                pass


def sync_schema() -> None:
    _ensure_user_role_constraint()
    _ensure_user_hourly_rate_column()
    _ensure_product_columns()
    _ensure_product_submission_columns()
    _ensure_order_table_designer_column()
    _ensure_order_table_work_order_type_column()
    _ensure_nursery_vendor_contact_columns()
    _widen_product_rate_columns()
    _ensure_performance_indexes()


def seed_default_zones() -> None:
    inspector = inspect(engine)
    if "zone_configuration" not in inspector.get_table_names():
        return

    with engine.begin() as connection:
        existing_count = connection.execute(text("SELECT COUNT(*) FROM zone_configuration")).scalar_one()
        if existing_count and existing_count > 0:
            return

        for zone_number in range(1, 7):
            connection.execute(
                text("INSERT INTO zone_configuration (zone_number, subzone_count) VALUES (:zone_number, 0)"),
                {"zone_number": zone_number},
            )
