"""Resolve activity overrides without changing the original problem datasets."""


def dataset_is_hidden(dataset, index, visibility=None):
    inherited_hidden = dataset.get("is_hidden", False) if isinstance(dataset, dict) else dataset.is_hidden
    return not (visibility or {}).get(str(index + 1), not inherited_hidden)
