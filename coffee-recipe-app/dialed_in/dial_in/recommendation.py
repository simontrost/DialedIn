from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from math import exp
from statistics import mean
from typing import Any


def _parse_datetime(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def _recency_weight(value: str, newest: datetime) -> float:
    age_days = max(0.0, (newest - _parse_datetime(value)).total_seconds() / 86400)
    # Older shots still matter. The 0.2 floor prevents historical data from
    # disappearing completely while recent shots remain more influential.
    return 0.2 + 0.8 * exp(-age_days / 45.0)


def _similarity_weight(log: dict[str, Any], recipe_values: dict[str, Any]) -> float:
    weight = 1.0
    for log_key, recipe_key in (("dose", "dose"), ("beverageYield", "beverageYield")):
        measured = log.get(log_key)
        target = recipe_values.get(recipe_key)
        if measured in (None, 0) or target in (None, 0):
            continue
        relative_error = abs(float(measured) - float(target)) / max(float(target), 0.1)
        weight *= max(0.35, 1.0 - relative_error * 2.5)
    return weight


def _weighted_linear_fit(points: list[dict[str, float]]) -> tuple[float, float] | None:
    total_weight = sum(point["weight"] for point in points)
    if total_weight <= 0:
        return None
    mean_x = sum(point["grind"] * point["weight"] for point in points) / total_weight
    mean_y = sum(point["time"] * point["weight"] for point in points) / total_weight
    denominator = sum(point["weight"] * (point["grind"] - mean_x) ** 2 for point in points)
    if denominator < 1e-9:
        return None
    slope = sum(
        point["weight"] * (point["grind"] - mean_x) * (point["time"] - mean_y)
        for point in points
    ) / denominator
    intercept = mean_y - slope * mean_x
    if abs(slope) < 0.05:
        return None
    return slope, intercept


def _aggregate(logs: list[dict[str, Any]], recipe_values: dict[str, Any]) -> list[dict[str, float]]:
    newest = max((_parse_datetime(log["brewedAt"]) for log in logs), default=datetime.now(timezone.utc))
    grouped: dict[float, list[tuple[float, float]]] = defaultdict(list)
    for log in logs:
        grind = round(float(log["grind"]), 3)
        weight = _recency_weight(log["brewedAt"], newest) * _similarity_weight(log, recipe_values)
        grouped[grind].append((float(log["time"]), weight))

    points: list[dict[str, float]] = []
    for grind, values in grouped.items():
        weight = sum(item[1] for item in values)
        weighted_time = sum(item[0] * item[1] for item in values) / max(weight, 1e-9)
        points.append({"grind": grind, "time": weighted_time, "weight": weight})
    return sorted(points, key=lambda point: point["time"])


def _bracketing_prediction(points: list[dict[str, float]], target: float) -> float | None:
    candidates: list[tuple[float, float]] = []
    for left, right in zip(points, points[1:]):
        low = min(left["time"], right["time"])
        high = max(left["time"], right["time"])
        if low <= target <= high and abs(right["time"] - left["time"]) > 0.05:
            fraction = (target - left["time"]) / (right["time"] - left["time"])
            prediction = left["grind"] + fraction * (right["grind"] - left["grind"])
            candidates.append((high - low, prediction))
    if not candidates:
        return None
    return min(candidates, key=lambda item: item[0])[1]


def _taste_adjustment(taste: str, finer_direction: float, time_error: float) -> float:
    # Taste severity deliberately changes the size of the correction. Sour
    # shots move finer, bitter shots move coarser. When taste and brew time
    # strongly disagree, taste still contributes but cannot dominate the
    # time-based estimate.
    taste_strength = {
        "little_sour": 0.25,
        "sour": 0.5,
        "very_sour": 0.75,
        "hollow": 0.5,       # Legacy value: under-extracted / weak.
        "little_bitter": -0.25,
        "bitter": -0.5,
        "very_bitter": -0.75,
        "astringent": -0.5,  # Legacy value: usually over-extracted.
    }.get(taste, 0.0)
    if taste_strength == 0:
        return 0.0

    adjustment = taste_strength * finer_direction
    if abs(time_error) <= 3:
        return adjustment

    time_direction = finer_direction if time_error > 0 else -finer_direction
    agrees_with_time = adjustment * time_direction > 0
    if agrees_with_time:
        return adjustment

    # A conflicting taste signal remains useful, but is intentionally reduced
    # when the shot time is already far away from the target.
    conflict_scale = 0.6 if abs(time_error) <= 8 else 0.35
    return adjustment * conflict_scale


def calculate_recommendation(
    logs: list[dict[str, Any]],
    recipe_values: dict[str, Any],
    *,
    max_step: float = 2.5,
    grind_min: float | None = None,
    grind_max: float | None = None,
) -> dict[str, Any]:
    valid_logs = [
        log for log in logs
        if log.get("valid", True)
        and log.get("grind") is not None
        and log.get("time") is not None
    ]
    target = recipe_values.get("targetTime")
    if target in (None, ""):
        raise ValueError("The selected recipe has no target time.")
    target = float(target)
    if not valid_logs:
        raise ValueError("Add at least one valid measurement first.")

    valid_logs.sort(key=lambda log: _parse_datetime(log["brewedAt"]))
    latest = valid_logs[-1]
    latest_measured_grind = float(latest["grind"])
    current_time = float(latest["time"])

    # The UI presents the grind stored in the selected recipe as the current
    # setting. Use that same value as the starting point for the maximum-change
    # limit. Fall back to the latest measured grind for older/incomplete recipes.
    try:
        recipe_grind = float(recipe_values.get("grind"))
    except (TypeError, ValueError):
        recipe_grind = latest_measured_grind
    current_grind = recipe_grind

    # Grinder numbers are arbitrary: a change of 1 on a 1–20 grinder is much
    # larger than a change of 1 on a 1–60 grinder. Run the recommendation on a
    # normalized 0–20 scale, then convert the result back to the configured
    # grinder range. This keeps learned relationships, taste corrections and
    # cautious first steps proportional to the grinder's total adjustment span.
    configured_range = (
        grind_min is not None
        and grind_max is not None
        and float(grind_max) > float(grind_min)
    )
    normalized_span = 20.0
    if configured_range:
        physical_min = float(grind_min)
        physical_max = float(grind_max)
        physical_span = physical_max - physical_min
        grind_scale = physical_span / normalized_span

        def normalize_grind(value: float) -> float:
            return (float(value) - physical_min) / grind_scale

        def denormalize_grind(value: float) -> float:
            return physical_min + float(value) * grind_scale
    else:
        physical_min = 0.0
        physical_max = 0.0
        physical_span = 0.0
        grind_scale = 1.0

        def normalize_grind(value: float) -> float:
            return float(value)

        def denormalize_grind(value: float) -> float:
            return float(value)

    normalized_logs = [
        {**log, "grind": normalize_grind(float(log["grind"]))}
        for log in valid_logs
    ]
    normalized_latest_measured_grind = normalize_grind(latest_measured_grind)
    normalized_current_grind = normalize_grind(current_grind)
    points = _aggregate(normalized_logs, recipe_values)
    distinct_count = len(points)

    mode = "single_measurement"
    raw_prediction = normalized_latest_measured_grind
    slope: float | None = None
    bracketing = False

    if distinct_count >= 2:
        raw_prediction = _bracketing_prediction(points, target)
        if raw_prediction is not None:
            mode = "interpolation"
            bracketing = True
        else:
            closest = sorted(points, key=lambda point: abs(point["time"] - target))[: min(6, len(points))]
            fit = _weighted_linear_fit(closest)
            if fit:
                slope, intercept = fit
                raw_prediction = (target - intercept) / slope
                mode = "weighted_regression"
            else:
                raw_prediction = normalized_latest_measured_grind
    else:
        # With only one distinct setting, use a deliberately cautious step.
        # The default assumes lower grinder numbers are finer, matching the
        # common behaviour of espresso grinders and the existing app examples.
        seconds_error = target - current_time
        raw_prediction = normalized_latest_measured_grind - max(-1.0, min(1.0, seconds_error / 8.0))

    if slope is None and distinct_count >= 2:
        fit = _weighted_linear_fit(points)
        slope = fit[0] if fit else None
    finer_direction = -1.0 if slope is None or slope < 0 else 1.0
    raw_prediction += _taste_adjustment(
        str(latest.get("taste") or "neutral"),
        finer_direction,
        target - current_time,
    )

    # The value entered as "Maximum next change" is an actual grinder-unit
    # limit. A value of 5 therefore always caps the next recommendation to
    # current ±5, independent of whether the configured grinder range is 1–20,
    # 1–50 or 1–60. Only the prediction model itself uses the normalized scale.
    maximum_physical_change = physical_span if configured_range else normalized_span
    physical_max_step = max(0.1, min(float(max_step), maximum_physical_change))
    normalized_max_step = physical_max_step / grind_scale
    normalized_delta = max(
        -normalized_max_step,
        min(normalized_max_step, raw_prediction - normalized_current_grind),
    )
    normalized_recommended = normalized_current_grind + normalized_delta
    if configured_range:
        normalized_recommended = max(0.0, min(normalized_span, normalized_recommended))

    recommended = denormalize_grind(normalized_recommended)
    physical_raw_prediction = denormalize_grind(raw_prediction)
    effective_max_change = physical_max_step

    if distinct_count >= 5 and bracketing:
        confidence = "high"
    elif distinct_count >= 3:
        confidence = "medium"
    else:
        confidence = "low"

    historical_span_days = 0
    if len(valid_logs) > 1:
        historical_span_days = round(
            (_parse_datetime(valid_logs[-1]["brewedAt"]) - _parse_datetime(valid_logs[0]["brewedAt"])).total_seconds() / 86400
        )

    messages = {
        "single_measurement": "Only one distinct grind setting is available, so the next step is intentionally cautious.",
        "interpolation": "The target lies between measured results; the estimate uses the closest surrounding measurements.",
        "weighted_regression": "The target lies outside the measured range; recent and recipe-matching shots are weighted more strongly.",
    }

    return {
        "sampleCount": len(valid_logs),
        "distinctGrindCount": distinct_count,
        "historicalSpanDays": historical_span_days,
        "targetTime": round(target, 2),
        "currentGrind": round(current_grind, 3),
        "rawPrediction": round(float(physical_raw_prediction), 3),
        "recommendedGrind": round(float(recommended), 1),
        "change": round(float(recommended - current_grind), 1),
        "grinderRange": {
            "min": round(physical_min, 3) if configured_range else None,
            "max": round(physical_max, 3) if configured_range else None,
            "span": round(physical_span, 3) if configured_range else None,
        },
        "effectiveMaxChange": round(float(effective_max_change), 3),
        "confidence": confidence,
        "mode": mode,
        "message": messages[mode],
        "averageTime": round(mean(float(log["time"]) for log in valid_logs), 2),
    }
