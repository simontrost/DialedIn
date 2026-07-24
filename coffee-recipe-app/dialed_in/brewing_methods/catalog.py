from __future__ import annotations

from copy import deepcopy
from typing import Any


def number_field(
    key: str,
    label: str,
    unit: str = "",
    *,
    default: float | int | None = None,
    minimum: float | int | None = None,
    maximum: float | int | None = None,
    step: float | int = 1,
    required: bool = False,
    help_text: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "type": "number",
        "unit": unit,
        "default": default,
        "min": minimum,
        "max": maximum,
        "step": step,
        "required": required,
        "help": help_text,
    }


def select_field(
    key: str,
    label: str,
    options: list[tuple[str, str]],
    *,
    default: str = "",
    help_text: str = "",
) -> dict[str, Any]:
    return {
        "key": key,
        "label": label,
        "type": "select",
        "options": [{"value": value, "label": label} for value, label in options],
        "default": default,
        "required": False,
        "help": help_text,
    }


ESPRESSO_FIELDS = [
    number_field("dose", "Dose", "g in", default=18, minimum=1, maximum=40, step=0.1, required=True),
    number_field("beverageYield", "Yield", "g out", default=36, minimum=1, maximum=120, step=0.1, required=True),
    number_field("targetTime", "Target time", "sec", default=28, minimum=1, maximum=180, required=True),
    number_field("grind", "Grind setting", default=17, minimum=0, maximum=200, step=0.1),
    number_field("temperature", "Temperature", "°C", default=93, minimum=70, maximum=110, step=0.5),
    number_field("pressure", "Pressure", "bar", default=9, minimum=0, maximum=15, step=0.1),
]

BREWING_METHODS: dict[str, dict[str, Any]] = {
    "espresso": {
        "id": "espresso",
        "name": "Espresso",
        "icon": "☕",
        "description": "Pressure extraction with a defined dose, beverage yield, time, temperature and pressure.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": ESPRESSO_FIELDS,
        "defaultSteps": [],
    },
    "americano": {
        "id": "americano",
        "name": "Americano",
        "icon": "◒",
        "description": "An espresso recipe extended with hot water and a selectable serving order.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": ESPRESSO_FIELDS + [
            number_field("addedWater", "Added water", "g", default=100, minimum=1, maximum=600, step=1, required=True),
            number_field("waterTemperature", "Water temperature", "°C", default=90, minimum=40, maximum=100, step=1),
            select_field(
                "servingOrder",
                "Serving order",
                [("water_first", "Water first / long black style"), ("espresso_first", "Espresso first")],
                default="espresso_first",
            ),
        ],
        "defaultSteps": [],
    },
    "flat_white": {
        "id": "flat_white",
        "name": "Flat White",
        "icon": "◓",
        "description": "A compact milk drink based on espresso and finely textured steamed milk.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": ESPRESSO_FIELDS + [
            number_field("milkAmount", "Milk", "g", default=130, minimum=1, maximum=500, step=1, required=True),
            number_field("milkTemperature", "Milk temperature", "°C", default=60, minimum=35, maximum=80, step=1),
            number_field("cupVolume", "Cup volume", "ml", default=180, minimum=60, maximum=500, step=5),
            select_field(
                "milkTexture",
                "Milk texture",
                [("thin_microfoam", "Thin microfoam"), ("medium_microfoam", "Medium microfoam")],
                default="thin_microfoam",
            ),
        ],
        "defaultSteps": [],
    },
    "cappuccino": {
        "id": "cappuccino",
        "name": "Cappuccino",
        "icon": "◉",
        "description": "Espresso with steamed milk and a more pronounced microfoam layer than a flat white.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": ESPRESSO_FIELDS + [
            number_field("milkAmount", "Milk", "g", default=110, minimum=1, maximum=500, step=1, required=True),
            number_field("milkTemperature", "Milk temperature", "°C", default=60, minimum=35, maximum=80, step=1),
            number_field("cupVolume", "Cup volume", "ml", default=180, minimum=60, maximum=500, step=5),
            select_field("milkTexture", "Milk texture", [("medium_microfoam", "Medium microfoam"), ("thick_microfoam", "Thicker microfoam")], default="medium_microfoam"),
        ],
        "defaultSteps": [],
    },
    "latte": {
        "id": "latte",
        "name": "Caffè Latte",
        "icon": "◐",
        "description": "Espresso with a larger amount of steamed milk and a thin microfoam layer.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": ESPRESSO_FIELDS + [
            number_field("milkAmount", "Milk", "g", default=220, minimum=1, maximum=700, step=1, required=True),
            number_field("milkTemperature", "Milk temperature", "°C", default=60, minimum=35, maximum=80, step=1),
            number_field("cupVolume", "Cup volume", "ml", default=300, minimum=100, maximum=700, step=5),
            select_field("milkTexture", "Milk texture", [("thin_microfoam", "Thin microfoam"), ("medium_microfoam", "Medium microfoam")], default="thin_microfoam"),
        ],
        "defaultSteps": [],
    },
    "v60": {
        "id": "v60",
        "name": "V60",
        "icon": "▽",
        "description": "Cone pour-over with bloom and one or more controlled pours.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=15, minimum=1, maximum=100, step=0.1, required=True),
            number_field("waterAmount", "Total water", "g", default=250, minimum=1, maximum=1500, step=1, required=True),
            number_field("targetTime", "Target brew time", "sec", default=180, minimum=30, maximum=900, required=True),
            number_field("grind", "Grind setting", default=22, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=94, minimum=70, maximum=100, step=0.5),
            select_field("dripperSize", "Dripper size", [("01", "V60 01"), ("02", "V60 02"), ("03", "V60 03")], default="02"),
            number_field("bloomWater", "Bloom water", "g", default=45, minimum=1, maximum=300, step=1),
            number_field("bloomTime", "Bloom time", "sec", default=30, minimum=0, maximum=180, step=1),
        ],
        "defaultSteps": [
            {"title": "Bloom", "waterAmount": 45, "waitSeconds": 30, "note": "Wet all grounds evenly."},
            {"title": "First pour", "waterAmount": 105, "waitSeconds": 20, "note": "Pour gently in small circles."},
            {"title": "Final pour", "waterAmount": 100, "waitSeconds": 0, "note": "Finish to the total target water."},
        ],
    },
    "pour_over": {
        "id": "pour_over",
        "name": "Pour Over",
        "icon": "⌄",
        "description": "A generic manual pour-over recipe for drippers that are not tied to a V60 or Chemex preset.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=18, minimum=1, maximum=150, step=0.1, required=True),
            number_field("waterAmount", "Total water", "g", default=300, minimum=1, maximum=2000, step=1, required=True),
            number_field("targetTime", "Target brew time", "sec", default=195, minimum=30, maximum=1200, required=True),
            number_field("grind", "Grind setting", default=24, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=94, minimum=70, maximum=100, step=0.5),
            number_field("bloomWater", "Bloom water", "g", default=55, minimum=0, maximum=400, step=1),
            number_field("bloomTime", "Bloom time", "sec", default=30, minimum=0, maximum=180, step=1),
            select_field("filterType", "Filter", [("paper", "Paper"), ("metal", "Metal"), ("cloth", "Cloth")], default="paper"),
            select_field("agitation", "Agitation", [("none", "None"), ("swirl", "Swirl"), ("stir", "Stir")], default="swirl"),
        ],
        "defaultSteps": [
            {"title": "Bloom", "waterAmount": 55, "waitSeconds": 30, "note": "Wet the full coffee bed evenly."},
            {"title": "Main pour", "waterAmount": 145, "waitSeconds": 20, "note": "Pour with a steady controlled flow."},
            {"title": "Finish", "waterAmount": 100, "waitSeconds": 0, "note": "Complete the pour and allow full drawdown."},
        ],
    },
    "chemex": {
        "id": "chemex",
        "name": "Chemex",
        "icon": "◇",
        "description": "Large-format pour-over with a bloom and staged pours through a thick paper filter.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=30, minimum=1, maximum=150, step=0.1, required=True),
            number_field("waterAmount", "Total water", "g", default=500, minimum=1, maximum=2000, step=1, required=True),
            number_field("targetTime", "Target brew time", "sec", default=240, minimum=60, maximum=1200, required=True),
            number_field("grind", "Grind setting", default=28, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=94, minimum=70, maximum=100, step=0.5),
            number_field("bloomWater", "Bloom water", "g", default=70, minimum=1, maximum=400, step=1),
            number_field("bloomTime", "Bloom time", "sec", default=40, minimum=0, maximum=180),
        ],
        "defaultSteps": [
            {"title": "Bloom", "waterAmount": 70, "waitSeconds": 40, "note": "Gently agitate to wet the complete bed."},
            {"title": "Main pour", "waterAmount": 230, "waitSeconds": 25, "note": "Keep the water level stable."},
            {"title": "Finish", "waterAmount": 200, "waitSeconds": 0, "note": "Let the bed drain completely."},
        ],
    },
    "aeropress": {
        "id": "aeropress",
        "name": "AeroPress",
        "icon": "⇣",
        "description": "Immersion and pressure brewing with configurable orientation, steep and press stages.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=15, minimum=1, maximum=50, step=0.1, required=True),
            number_field("waterAmount", "Water", "g", default=200, minimum=1, maximum=500, step=1, required=True),
            number_field("targetTime", "Total brew time", "sec", default=120, minimum=20, maximum=600, required=True),
            number_field("grind", "Grind setting", default=15, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=85, minimum=50, maximum=100, step=0.5),
            select_field("orientation", "Method", [("standard", "Standard"), ("inverted", "Inverted")], default="standard"),
            number_field("stirTime", "Stir time", "sec", default=10, minimum=0, maximum=120),
            number_field("pressTime", "Press time", "sec", default=30, minimum=5, maximum=180),
        ],
        "defaultSteps": [
            {"title": "Add water", "waterAmount": 200, "waitSeconds": 10, "note": "Start the timer and stir."},
            {"title": "Steep", "waterAmount": 0, "waitSeconds": 70, "note": "Let the coffee steep."},
            {"title": "Press", "waterAmount": 0, "waitSeconds": 30, "note": "Press slowly and evenly."},
        ],
    },
    "french_press": {
        "id": "french_press",
        "name": "French Press",
        "icon": "▥",
        "description": "Full-immersion brew with a defined steep time and plunge.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=30, minimum=1, maximum=200, step=0.1, required=True),
            number_field("waterAmount", "Water", "g", default=500, minimum=1, maximum=2500, step=1, required=True),
            number_field("targetTime", "Steep time", "sec", default=240, minimum=30, maximum=1200, required=True),
            number_field("grind", "Grind setting", default=32, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=94, minimum=70, maximum=100, step=0.5),
            select_field("agitation", "Agitation", [("none", "None"), ("gentle_stir", "Gentle stir"), ("break_crust", "Break crust")], default="gentle_stir"),
        ],
        "defaultSteps": [
            {"title": "Fill", "waterAmount": 500, "waitSeconds": 30, "note": "Saturate all grounds."},
            {"title": "Steep", "waterAmount": 0, "waitSeconds": 210, "note": "Leave the plunger above the coffee."},
            {"title": "Plunge", "waterAmount": 0, "waitSeconds": 20, "note": "Press gently and serve immediately."},
        ],
    },
    "moka": {
        "id": "moka",
        "name": "Moka Pot",
        "icon": "♨",
        "description": "Stovetop brewing with boiler water, basket dose and controlled heat.",
        "supportsDialIn": True,
        "supportsSteps": False,
        "fields": [
            number_field("dose", "Coffee", "g", default=18, minimum=1, maximum=80, step=0.1, required=True),
            number_field("waterAmount", "Boiler water", "g", default=150, minimum=1, maximum=1000, step=1, required=True),
            number_field("beverageYield", "Expected yield", "g", default=110, minimum=1, maximum=800, step=1),
            number_field("targetTime", "Approx. brew time", "sec", default=240, minimum=30, maximum=900),
            number_field("grind", "Grind setting", default=13, minimum=0, maximum=200, step=0.1),
            select_field("heatLevel", "Heat level", [("low", "Low"), ("medium", "Medium")], default="low"),
            select_field("stopPoint", "Stop point", [("first_sputter", "At first sputter"), ("pale_stream", "When the stream turns pale")], default="first_sputter"),
        ],
        "defaultSteps": [],
    },
    "cold_brew": {
        "id": "cold_brew",
        "name": "Cold Brew",
        "icon": "❄",
        "description": "Long cold extraction with an optional concentrate dilution ratio.",
        "supportsDialIn": False,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=100, minimum=1, maximum=1000, step=1, required=True),
            number_field("waterAmount", "Water", "g", default=1000, minimum=1, maximum=10000, step=1, required=True),
            number_field("targetTime", "Steep time", "min", default=720, minimum=30, maximum=2880, step=15, required=True),
            number_field("grind", "Grind setting", default=35, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Water temperature", "°C", default=20, minimum=1, maximum=35, step=1),
            select_field("brewStyle", "Brew style", [("ready_to_drink", "Ready to drink"), ("concentrate", "Concentrate")], default="ready_to_drink"),
            number_field("dilution", "Dilution water per 1 part coffee", "parts", default=1, minimum=0, maximum=10, step=0.1),
        ],
        "defaultSteps": [
            {"title": "Combine", "waterAmount": 1000, "waitSeconds": 0, "note": "Mix until all grounds are wet."},
            {"title": "Steep", "waterAmount": 0, "waitSeconds": 43200, "note": "Cover and leave for the selected steep time."},
            {"title": "Filter", "waterAmount": 0, "waitSeconds": 0, "note": "Filter and refrigerate."},
        ],
    },
    "custom": {
        "id": "custom",
        "name": "Custom method",
        "icon": "＋",
        "description": "A flexible recipe with common variables and a custom sequence.",
        "supportsDialIn": True,
        "supportsSteps": True,
        "fields": [
            number_field("dose", "Coffee", "g", default=18, minimum=0, maximum=1000, step=0.1),
            number_field("waterAmount", "Water", "g", default=250, minimum=0, maximum=10000, step=1),
            number_field("beverageYield", "Beverage yield", "g", default=None, minimum=0, maximum=10000, step=0.1),
            number_field("targetTime", "Target time", "sec", default=180, minimum=0, maximum=10000, step=1),
            number_field("grind", "Grind setting", default=None, minimum=0, maximum=200, step=0.1),
            number_field("temperature", "Temperature", "°C", default=93, minimum=0, maximum=110, step=0.5),
        ],
        "defaultSteps": [],
    },
}


def list_methods() -> list[dict[str, Any]]:
    return [deepcopy(method) for method in BREWING_METHODS.values()]


def get_method(method_id: str) -> dict[str, Any] | None:
    method = BREWING_METHODS.get(method_id)
    return deepcopy(method) if method else None
