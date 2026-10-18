from typing import Any


def read_expected_outputs(value: Any) -> tuple[list[dict[str, Any]], bool]:
    """Read saved outputs while continuing to accept the legacy single-table value."""
    if not isinstance(value, dict):
        return [], True

    stored = value.get("_expectedOutputs")
    visible = value.get("_expectedOutputVisible", True) is not False
    if isinstance(stored, list):
        outputs = [item for item in stored if isinstance(item, dict) and isinstance(item.get("columns"), list) and isinstance(item.get("rows"), list)]
        return outputs, visible

    if isinstance(value.get("columns"), list) and isinstance(value.get("rows"), list):
        return [{"name": value.get("name") or "Result", "columns": value["columns"], "rows": value["rows"]}], visible
    return [], visible


def save_expected_outputs(outputs: list[Any] | None, visible: bool) -> dict[str, Any] | None:
    if not outputs:
        return None

    normalized = []
    for output in outputs:
        item = output.model_dump(mode="json", by_alias=True) if hasattr(output, "model_dump") else dict(output)
        if not isinstance(item.get("columns"), list) or not isinstance(item.get("rows"), list):
            continue
        normalized.append({"name": item.get("name") or "Result", "columns": item["columns"], "rows": item["rows"]})
    if not normalized:
        return None
    first = normalized[0]
    return {
        "name": first.get("name") or "Result",
        "columns": first.get("columns", []),
        "rows": first.get("rows", []),
        "_expectedOutputs": normalized,
        "_expectedOutputVisible": bool(visible),
    }
