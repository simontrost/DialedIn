from __future__ import annotations

import re

from ..utils import fold_text, normalize_text

ORIGIN_REGIONS: dict[str, list[str]] = {
    "Brazil": ["Cerrado Mineiro", "Espírito Santo", "Mogiana", "Minas Gerais", "Sul de Minas"],
    "Burundi": ["Kayanza", "Kirundo", "Ngozi"],
    "Colombia": ["Antioquia", "Cauca", "Huila", "Nariño", "Sierra Nevada", "Tolima"],
    "Costa Rica": ["Brunca", "Central Valley", "Tarrazú", "West Valley"],
    "El Salvador": ["Alotepec-Metapán", "Apaneca-Ilamatepec", "Bálsamo-Quezaltepec"],
    "Ethiopia": ["Guji", "Harrar", "Limu", "Sidama", "Yirgacheffe"],
    "Guatemala": ["Acatenango", "Antigua", "Atitlán", "Cobán", "Huehuetenango"],
    "Honduras": ["Agalta", "Copán", "El Paraíso", "Montecillos", "Opalaca"],
    "India": ["Baba Budangiri", "Chikmagalur", "Coorg", "Kerala"],
    "Indonesia": ["Bali", "Flores", "Java", "Sulawesi", "Sumatra"],
    "Jamaica": ["Blue Mountains"],
    "Kenya": ["Embu", "Kirinyaga", "Kiambu", "Murang'a", "Nyeri"],
    "Mexico": ["Chiapas", "Oaxaca", "Veracruz"],
    "Nicaragua": ["Jinotega", "Matagalpa", "Nueva Segovia"],
    "Panama": ["Boquete", "Volcán"],
    "Papua New Guinea": ["Eastern Highlands", "Western Highlands"],
    "Peru": ["Cajamarca", "Cusco", "Junín", "San Martín"],
    "Rwanda": ["Gakenke", "Huye", "Kivu", "Nyamasheke"],
    "Tanzania": ["Arusha", "Kilimanjaro", "Mbeya"],
    "Uganda": ["Bugisu", "Rwenzori"],
    "Vietnam": ["Central Highlands", "Da Lat"],
    "Yemen": ["Bani Matar", "Haraz", "Haimah"],
}

COUNTRY_ALIASES: dict[str, tuple[str, ...]] = {
    "Brazil": ("brazil", "brasil"),
    "Burundi": ("burundi",),
    "Colombia": ("colombia", "kolumbien"),
    "Costa Rica": ("costa rica",),
    "Cuba": ("cuba", "kuba"),
    "Dominican Republic": ("dominican republic", "dominikanische republik"),
    "Ecuador": ("ecuador",),
    "El Salvador": ("el salvador",),
    "Ethiopia": ("ethiopia", "ethiopian", "äthiopien", "aethiopien"),
    "Guatemala": ("guatemala",),
    "Haiti": ("haiti",),
    "Honduras": ("honduras",),
    "India": ("india", "indian", "indien"),
    "Indonesia": ("indonesia", "indonesian", "indonesien"),
    "Jamaica": ("jamaica", "jamaika"),
    "Kenya": ("kenya", "kenian", "kenia"),
    "Laos": ("laos",),
    "Mexico": ("mexico", "mexican", "mexiko"),
    "Myanmar": ("myanmar", "burma"),
    "Nicaragua": ("nicaragua",),
    "Panama": ("panama",),
    "Papua New Guinea": ("papua new guinea", "papua-neuguinea"),
    "Peru": ("peru",),
    "Philippines": ("philippines", "philippinen"),
    "Rwanda": ("rwanda", "ruanda"),
    "Tanzania": ("tanzania", "tansania"),
    "Thailand": ("thailand",),
    "Timor-Leste": ("timor-leste", "east timor", "osttimor"),
    "Uganda": ("uganda",),
    "Vietnam": ("vietnam", "viet nam"),
    "Yemen": ("yemen", "jemen"),
}


def word_present(text: str, phrase: str) -> bool:
    folded_text = fold_text(text)
    folded_phrase = fold_text(phrase)
    return re.search(
        rf"(?<![a-z]){re.escape(folded_phrase)}(?![a-z])",
        folded_text,
    ) is not None


def detect_countries(text: str) -> list[str]:
    found: list[tuple[int, str]] = []
    folded = fold_text(text)

    for country, aliases in COUNTRY_ALIASES.items():
        positions: list[int] = []
        for alias in aliases:
            match = re.search(
                rf"(?<![a-z]){re.escape(fold_text(alias))}(?![a-z])",
                folded,
            )
            if match:
                positions.append(match.start())

        if positions:
            found.append((min(positions), country))

    return [country for _, country in sorted(found)]


def detect_region(text: str, country: str) -> str:
    for region in ORIGIN_REGIONS.get(country, []):
        if word_present(text, region):
            return region

    if country == "Ethiopia" and word_present(text, "Sidamo"):
        return "Sidama"

    return ""


def detect_blend(text: str) -> str:
    folded = fold_text(text)
    arabica = re.search(r"(\d{1,3})\s*(?:%|percent)?\s*arabica", folded)
    robusta = re.search(r"(\d{1,3})\s*(?:%|percent)?\s*robusta", folded)

    if arabica and robusta:
        arabica_amount = int(arabica.group(1))
        robusta_amount = int(robusta.group(1))
        if (
            0 <= arabica_amount <= 100
            and 0 <= robusta_amount <= 100
            and arabica_amount + robusta_amount == 100
        ):
            return f"{arabica_amount}% Arabica / {robusta_amount}% Robusta"

    if re.search(r"100\s*(?:%|percent)\s*arabica", folded):
        return "100% Arabica"
    if re.search(r"100\s*(?:%|percent)\s*robusta", folded):
        return "100% Robusta"

    ratio = re.search(r"\b(\d{1,3})\s*[/:-]\s*(\d{1,3})\b", folded)
    if ratio and "arabica" in folded and "robusta" in folded:
        arabica_amount = int(ratio.group(1))
        robusta_amount = int(ratio.group(2))
        if arabica_amount + robusta_amount == 100:
            return f"{arabica_amount}% Arabica / {robusta_amount}% Robusta"

    if "arabica" in folded and "robusta" in folded:
        return "Arabica / Robusta blend"

    return ""


def parse_legacy_origin(value: str) -> tuple[str, str, str]:
    text = normalize_text(value)
    if not text:
        return "", "", ""

    countries = detect_countries(text)
    country = (
        countries[0]
        if len(countries) == 1
        else ("Multiple origins" if len(countries) > 1 else "")
    )
    region = (
        detect_region(text, country)
        if country and country != "Multiple origins"
        else ""
    )
    blend = detect_blend(text)
    return country, region, blend


def origin_summary(country: str, region: str, blend: str) -> str:
    location = " · ".join(part for part in (country, region) if part)
    return " · ".join(part for part in (location, blend) if part)
