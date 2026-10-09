import hashlib


def generate_product_id_8digit(
    nursery_id: str,
    size: str,
    item_name: str,
    *,
    zone_number: int = 1,
    subzone: str | None = None,
) -> str:
    nursery = nursery_id.strip().lower()
    size_key = size.strip().lower()
    name_key = item_name.strip().lower()
    sub_key = subzone.strip().lower() if subzone and subzone.strip() else ""

    raw = f"{nursery}|{size_key}|{name_key}|{zone_number}|{sub_key}"

    # SHA256 -> take part -> convert to int -> mod 8 digits
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()

    # Take first 12 hex chars -> convert to int
    num = int(digest[:12], 16)

    # Ensure 8 digits
    product_id = num % 100_000_000

    # Pad with zeros if needed
    return f"{product_id:08d}"
