import string


def normalize_subzone_code(value: str | None) -> str | None:
    if value is None:
        return None

    cleaned = value.strip().upper()
    return cleaned or None


def build_zone_label(zone_number: int, subzone_code: str | None = None) -> str:
    code = normalize_subzone_code(subzone_code)
    return f"{zone_number}{code}" if code else str(zone_number)


def generate_subzone_codes(subzone_count: int) -> list[str]:
    if subzone_count <= 0:
        return []

    def to_alpha_code(index: int) -> str:
        out = ""
        n = index
        while n >= 0:
            out = string.ascii_uppercase[n % 26] + out
            n = (n // 26) - 1
        return out

    return [to_alpha_code(i) for i in range(subzone_count)]