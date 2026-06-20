"""
Scenario engine for Pulse Agent.

Turns a natural-language staff question into a deterministic, computed "brief"
that is injected into the LLM prompt. The numbers are computed here in Python so
the model never has to do (or invent) the arithmetic -- it only phrases the answer.

Two scenario types are supported:
  - "event_food"      -> food / pizza ordering for an event, grounded in last
                         year's closest event and its waste rate.
  - "energy_schedule" -> energy / cost impact of a schedule change (e.g. adding
                         a volleyball night), grounded in facility energy rates.

If no exact historical match exists, the closest event by attendance is used and
the brief says so honestly, so the model can say "I used our closest event".
"""

from __future__ import annotations

import json
import math
import re

from .config import PROJECT_ROOT

SCENARIO_DIR = PROJECT_ROOT / "data" / "scenario"


def _load_json(name: str, default):
    path = SCENARIO_DIR / name
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default


EVENT_HISTORY: list[dict] = _load_json("event_history.json", [])
FACILITIES: dict = _load_json("facilities.json", {})

_NUM_RE = re.compile(r"\d[\d,]*\.?\d*")
SAFETY_BUFFER = 1.08  # order ~8% over computed need so nobody goes hungry


def _nums(text: str) -> list[float]:
    out: list[float] = []
    for m in _NUM_RE.findall(text):
        try:
            out.append(float(m.replace(",", "")))
        except ValueError:
            pass
    return out


def _money(value: float) -> str:
    return f"${value:,.0f}" if value == round(value) else f"${value:,.2f}"


# --------------------------------------------------------------------------- #
# Intent detection
# --------------------------------------------------------------------------- #

def detect_intent(query: str) -> str | None:
    q = query.lower()

    energy_terms = ("energy", "electric", "kwh", "kilowatt", "power", "bill",
                    "hvac", "utility", "watt")
    place_terms = ("gym", "auditorium", "cafeteria", "lights", "classroom", "court")
    change_terms = ("season", "schedule", "more", "increase", "increasing", "extra",
                    "longer", "additional", "expand", "add", "another day",
                    "days a week", "day a week", "instead of", "twice")
    if (any(t in q for t in energy_terms) or any(t in q for t in place_terms)) and any(
        t in q for t in change_terms
    ):
        return "energy_schedule"

    food_terms = ("pizza", "pizzas", "food", "cater", "catering", "serving",
                  "servings", "order", "snacks", "meals", "lunch", "dinner")
    plan_terms = ("plan", "planning", "event", "conference", "rally", "dance",
                  "night", "party", "banquet", "open house", "game", "meeting",
                  "fundraiser", "festival")
    if any(t in q for t in food_terms) and any(t in q for t in plan_terms):
        return "event_food"
    if any(t in q for t in food_terms) and ("how much" in q or "how many" in q):
        return "event_food"
    return None


# --------------------------------------------------------------------------- #
# Event food planning
# --------------------------------------------------------------------------- #

def _parse_attendance(q: str) -> tuple[int | None, int | None]:
    adults = students = None
    am = re.search(r"(\d[\d,]*)\s*(?:ish\s*)?(?:parents|adults|guests|families|teachers|staff)", q)
    sm = re.search(r"(\d[\d,]*)\s*(?:ish\s*)?(?:students|kids|children|pupils|scholars|athletes)", q)
    if am:
        adults = int(am.group(1).replace(",", ""))
    if sm:
        students = int(sm.group(1).replace(",", ""))
    return adults, students


def _match_event(q: str, target_total: int) -> tuple[dict | None, bool]:
    """Return (event, exact_match?). Falls back to closest-by-attendance."""
    if not EVENT_HISTORY:
        return None, False
    best = None
    best_score = 0
    for ev in EVENT_HISTORY:
        score = 0
        for kw in ev.get("keywords", []):
            if kw in q:
                score = max(score, 3)
        cat = ev.get("category", "").replace("_", " ")
        if cat and cat in q:
            score = max(score, 2)
        if score > best_score:
            best_score = score
            best = ev
    if best is not None and best_score >= 2:
        return best, True
    # No keyword match -> closest by attendance
    if target_total:
        best = min(EVENT_HISTORY, key=lambda e: abs(e.get("total_attended", 0) - target_total))
    else:
        best = EVENT_HISTORY[0]
    return best, False


def _plan_event_food(query: str) -> dict | None:
    if not EVENT_HISTORY:
        return None
    q = query.lower()
    adults, students = _parse_attendance(q)
    new_total = (adults or 0) + (students or 0)
    if not new_total:
        nums = [n for n in _nums(q) if n >= 10]
        new_total = int(max(nums)) if nums else 0

    match, exact = _match_event(q, new_total)
    if match is None:
        return None

    per_person = match["pizzas_consumed"] / max(1, match["total_attended"])
    if not new_total:
        new_total = match["total_attended"]

    recommended = math.ceil(per_person * new_total * SAFETY_BUFFER)
    cost_per = float(match.get("cost_per_pizza", 13.0))
    rec_cost = recommended * cost_per

    # What naive same-ratio scaling of last year's ORDER would cost (the mistake to avoid)
    naive = math.ceil(match["pizzas_ordered"] * (new_total / max(1, match["total_attended"])))
    naive_cost = naive * cost_per
    savings = naive_cost - rec_cost
    boxes_avoided = naive - recommended

    src = (
        f"our '{match['name']}' from {match.get('season', match.get('year', 'last year'))}"
        if exact
        else f"our closest event on record, '{match['name']}' ({match.get('season', match.get('year', ''))}), "
        f"since we have no exact match for this one"
    )

    lines = [
        "SCENARIO: Event food / pizza order planning.",
        f"Best historical reference: {src}.",
        f"  - Last time: {match['total_attended']} people attended "
        f"({match.get('adults_attended', '?')} adults, {match.get('students_attended', '?')} students).",
        f"  - We ORDERED {match['pizzas_ordered']} pizzas, people only ATE about "
        f"{match['pizzas_consumed']}, so {match['pizzas_wasted']} were wasted = "
        f"{match['waste_pct']}% over-ordering.",
        f"  - Actual consumption rate was {per_person:.2f} pizzas per person.",
        f"  - That order cost {_money(match.get('total_food_cost', match['pizzas_ordered'] * cost_per))} "
        f"at {_money(cost_per)} per pizza.",
        f"  - Note: {match.get('notes', '')}",
        "",
        f"This event's expected turnout: {new_total} people"
        + (f" ({adults} adults, {students} students)." if adults and students else "."),
        "COMPUTED RECOMMENDATION (use these exact numbers):",
        f"  - Order {recommended} pizzas (consumption rate {per_person:.2f}/person x "
        f"{new_total} people, plus an 8% safety buffer).",
        f"  - Estimated cost: {_money(rec_cost)} at {_money(cost_per)} per pizza.",
        f"  - If we instead just scaled up last year's over-order, we'd buy {naive} pizzas "
        f"({_money(naive_cost)}) -- so this plan saves about {_money(savings)} and avoids "
        f"roughly {boxes_avoided} wasted boxes.",
        "HUMAN CHECK LINE (end with this idea): confirm the final pizza count with the "
        "front office and account for any dietary needs before placing the order.",
    ]
    return {
        "kind": "event_food",
        "headline": f"Order {recommended} pizzas (~{_money(rec_cost)})",
        "text": "\n".join(lines),
        "exact": exact,
    }


# --------------------------------------------------------------------------- #
# Energy schedule forecasting
# --------------------------------------------------------------------------- #

def _pick_activity(q: str) -> tuple[str, dict] | None:
    activities = FACILITIES.get("activities", {})
    for name, data in activities.items():
        if name in q:
            return name, data
    # default to a gym activity if the gym is clearly involved
    if "gym" in q and "volleyball" in activities:
        return "volleyball", activities["volleyball"]
    if activities:
        name = next(iter(activities))
        return name, activities[name]
    return None


def _forecast_energy(query: str) -> dict | None:
    if not FACILITIES:
        return None
    q = query.lower()
    picked = _pick_activity(q)
    if not picked:
        return None
    name, act = picked

    zone_name = act.get("zone", "Gym")
    zone = FACILITIES.get("zones", {}).get(zone_name, {})
    active_rate = float(zone.get("active_kwh_per_hour", 14.0))
    rate = float(FACILITIES.get("electricity_rate_usd_per_kwh", 0.16))
    hours = float(act.get("gym_hours_per_session", 3.0))
    season_weeks = int(act.get("season_weeks", 10))
    current_days = int(act.get("current_days_per_week", 1))

    # Parse "to 2 days a week" / "twice a week" / "instead of 1"
    new_days = None
    m = re.search(r"(?:to|up to)\s*(\d+)\s*days?\s*(?:a|per)\s*week", q)
    if m:
        new_days = int(m.group(1))
    elif "twice" in q:
        new_days = 2
    else:
        m2 = re.search(r"(\d+)\s*days?\s*(?:a|per)\s*week", q)
        if m2:
            new_days = int(m2.group(1))
    m3 = re.search(r"instead of\s*(\d+)", q)
    if m3:
        current_days = int(m3.group(1))
    if new_days is None:
        new_days = current_days + 1

    extra_days = max(0, new_days - current_days)
    extra_hours_week = extra_days * hours
    extra_kwh_week = extra_hours_week * active_rate
    extra_cost_week = extra_kwh_week * rate
    season_cost = extra_cost_week * season_weeks

    current_hours_week = current_days * hours
    current_kwh_week = current_hours_week * active_rate
    current_cost_week = current_kwh_week * rate

    lines = [
        f"SCENARIO: Energy/cost impact of a {name} schedule change in the {zone_name}.",
        f"Facility facts (from our records):",
        f"  - {zone_name} draws {active_rate:.1f} kWh per hour when fully active "
        f"({zone.get('active_note', '')}).",
        f"  - Electricity rate: {_money(rate)} per kWh ({FACILITIES.get('rate_note', '')}).",
        f"  - Each {name} session keeps the {zone_name} on for about {hours:g} hours "
        f"({act.get('session_note', '')}).",
        f"  - Season length: {season_weeks} weeks.",
        "",
        f"Current schedule: {current_days} day(s)/week "
        f"= {current_hours_week:g} gym-hours/week = {current_kwh_week:.0f} kWh/week "
        f"= {_money(current_cost_week)}/week.",
        f"New schedule: {new_days} day(s)/week (adds {extra_days} day(s)).",
        "COMPUTED IMPACT (use these exact numbers):",
        f"  - Extra gym time: {extra_hours_week:g} hours/week.",
        f"  - Extra energy: {extra_kwh_week:.0f} kWh/week.",
        f"  - Extra cost: {_money(extra_cost_week)}/week, which is about "
        f"{_money(season_cost)} across the {season_weeks}-week season.",
        "HUMAN CHECK LINE (end with this idea): have facilities confirm the gym schedule "
        "and the current utility rate before you lock this into the budget.",
    ]
    return {
        "kind": "energy_schedule",
        "headline": f"About {_money(extra_cost_week)}/week extra (~{_money(season_cost)}/season)",
        "text": "\n".join(lines),
        "exact": True,
    }


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #

def build_scenario_brief(query: str) -> dict | None:
    """Return a computed scenario brief dict, or None if the query isn't a
    planning/forecast scenario."""
    intent = detect_intent(query)
    if intent == "event_food":
        return _plan_event_food(query)
    if intent == "energy_schedule":
        return _forecast_energy(query)
    return None
