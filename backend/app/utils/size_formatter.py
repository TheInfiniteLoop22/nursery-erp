import re

NA_VALUE = "N/A"

PRODUCT_SECTION_TREE = "tree"
PRODUCT_SECTION_SHRUBS = "shrubs"
PRODUCT_SECTION_PERENNIALS = "perennials"


def section_uses_gallon_pot_sizing(section: str | None) -> bool:
    """Shrubs and perennials use gallon-based size and bulk quantity scan."""
    s = (section or "").strip().lower()
    return s in (PRODUCT_SECTION_SHRUBS, PRODUCT_SECTION_PERENNIALS)


def section_is_shrubs(section: str | None) -> bool:
    return (section or "").strip().lower() == PRODUCT_SECTION_SHRUBS


def shrubs_has_gallons_or_height(gallons: str | None, height_feet: str | None) -> bool:
    has_gallons = bool((gallons or "").strip())
    has_height = normalize_dimension_value(height_feet) != NA_VALUE
    return has_gallons or has_height

_SIZE_PATTERN = re.compile(
    r"^\s*Height:\s*(?P<height>.+?)\s*ft\s*\|\s*Caliper:\s*(?P<caliper>.+?)\s*in\s*$",
    re.IGNORECASE,
)

_GALLONS_PATTERN = re.compile(r"^\s*(?P<gallons>\d+)\s*gal(lon)?s?\s*$", re.IGNORECASE)


def normalize_dimension_value(value: str | None) -> str:
    if value is None:
        return NA_VALUE

    cleaned = value.strip()
    if not cleaned or cleaned.lower() in {"n/a", "na"}:
        return NA_VALUE
    return cleaned


def build_size_label(height_feet: str | None, caliper_inches: str | None) -> str:
    normalized_height = normalize_dimension_value(height_feet)
    normalized_caliper = normalize_dimension_value(caliper_inches)
    return f"Height: {normalized_height} ft | Caliper: {normalized_caliper} in"


def build_gallons_size_label(gallons: str | int | None) -> str:
    if gallons is None:
        return NA_VALUE

    text = str(gallons).strip()
    if not text:
        return NA_VALUE

    if not text.isdigit():
        match = _GALLONS_PATTERN.match(text)
        if not match:
            return text
        text = match.group("gallons")

    return f"{int(text)} Gallon"


def build_shrubs_size_label(gallons: str | int | None, height_feet: str | None) -> str:
    """Shrubs: pot gallons and/or height (at least one enforced by API validation)."""
    base = build_gallons_size_label(gallons)
    h = normalize_dimension_value(height_feet)
    has_gallons = base != NA_VALUE
    if not has_gallons and h == NA_VALUE:
        return NA_VALUE
    if not has_gallons:
        return f"Height: {h} ft"
    if h == NA_VALUE:
        return base
    return f"{base} | Height: {h} ft"


def build_product_size_label(
    section: str | None,
    height_feet: str | None = None,
    caliper_inches: str | None = None,
    gallons: str | int | None = None,
) -> str:
    s = (section or "").strip().lower()
    if s == PRODUCT_SECTION_SHRUBS:
        return build_shrubs_size_label(gallons, height_feet)
    if section_uses_gallon_pot_sizing(section):
        return build_gallons_size_label(gallons)

    return build_size_label(height_feet, caliper_inches)


def extract_shrub_height_from_size(size: str | None) -> str:
    if not size:
        return NA_VALUE
    s = size.strip()
    match_pipe = re.search(r"\|\s*Height:\s*(?P<height>.+?)\s*ft\s*$", s, re.IGNORECASE)
    if match_pipe:
        return normalize_dimension_value(match_pipe.group("height"))
    match_only = re.match(r"^\s*Height:\s*(?P<height>.+?)\s*ft\s*$", s, re.IGNORECASE)
    if match_only:
        return normalize_dimension_value(match_only.group("height"))
    return NA_VALUE


def extract_view_dimensions(section: str | None, size: str | None) -> tuple[str, str]:
    """Height/caliper for API views: trees from full size string; shrubs height suffix; pot perennials N/A."""
    s = (section or "").strip().lower()
    if s == PRODUCT_SECTION_SHRUBS:
        return extract_shrub_height_from_size(size), NA_VALUE
    if s == PRODUCT_SECTION_PERENNIALS:
        return NA_VALUE, NA_VALUE
    if s == PRODUCT_SECTION_TREE:
        return extract_dimensions_from_size(size)
    return extract_dimensions_from_size(size)


def extract_dimensions_from_size(size: str | None) -> tuple[str, str]:
    if not size:
        return NA_VALUE, NA_VALUE

    match = _SIZE_PATTERN.match(size)
    if not match:
        return NA_VALUE, NA_VALUE

    height_feet = normalize_dimension_value(match.group("height"))
    caliper_inches = normalize_dimension_value(match.group("caliper"))
    return height_feet, caliper_inches