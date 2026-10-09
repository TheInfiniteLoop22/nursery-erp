from decimal import Decimal

def calculate_line_total(quantity: int, unit_price: Decimal, rate_percentage: Decimal | None):
    """
    Line total = quantity * unit_price * rate_multiplier.

    ``rate_percentage`` is stored as a price multiplier (e.g. 2.25), not a percent add-on.
    """
    base = Decimal(quantity) * Decimal(unit_price)

    if rate_percentage is None:
        return base.quantize(Decimal("0.01"))

    return (base * Decimal(rate_percentage)).quantize(Decimal("0.01"))
