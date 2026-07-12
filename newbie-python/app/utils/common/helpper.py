from qdrant_client import models
from app.schemas.ai_search import NumbericFilter


def build_numeric_range_filter(
    field_name: str,
    numeric_filter: NumbericFilter,
) -> models.FieldCondition:
    operator = numeric_filter.operator
    value = numeric_filter.value

    if operator == "between":
        if not isinstance(value, list) or len(value) != 2:
            raise ValueError("Between operator requires value as [min, max]")

        min_value, max_value = value

        return models.FieldCondition(
            key=field_name,
            range=models.Range(
                gte=float(min_value),
                lte=float(max_value),
            ),
        )

    if isinstance(value, list):
        raise ValueError(f"Operator '{operator}' requires a single numeric value, not a list")

    if operator == "<":
        return models.FieldCondition(
            key=field_name,
            range=models.Range(lt=float(value)),
        )

    if operator == "<=":
        return models.FieldCondition(
            key=field_name,
            range=models.Range(lte=float(value)),
        )

    if operator == ">":
        return models.FieldCondition(
            key=field_name,
            range=models.Range(gt=float(value)),
        )

    if operator == ">=":
        return models.FieldCondition(
            key=field_name,
            range=models.Range(gte=float(value)),
        )

    if operator == "=":
        # Real-world: "khoảng/around" ≈ ±25% range thay vì exact match
        tolerance = float(value) * 0.25
        return models.FieldCondition(
            key=field_name,
            range=models.Range(
                gte=float(value) - tolerance,
                lte=float(value) + tolerance,
            ),
        )

    raise ValueError(f"Unsupported operator: {operator}")