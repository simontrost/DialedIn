import { escapeHtml, iconMarkup } from "../core/utils.js";

export const FLAVOR_NOTE_CATEGORIES = Object.freeze([
  {
    name: "Sweet & cocoa",
    notes: [
      ["Chocolate", "chocolate"],
      ["Dark Chocolate", "dark-chocolate"],
      ["Cocoa", "cocoa"],
      ["Nougat", "nougat"],
      ["Caramel", "caramel"],
      ["Vanilla", "vanilla"],
      ["Honey", "honey"],
      ["Brown Sugar", "brown-sugar"],
      ["Marzipan", "marzipan"]
    ]
  },
  {
    name: "Nutty",
    notes: [
      ["Hazelnut", "hazelnut"],
      ["Almond", "almond"],
      ["Walnut", "walnut"],
      ["Peanut", "peanut"]
    ]
  },
  {
    name: "Fruit",
    notes: [
      ["Plum", "plum"],
      ["Cherry", "cherry"],
      ["Strawberry", "strawberry"],
      ["Blueberry", "blueberry"],
      ["Raspberry", "raspberry"],
      ["Apple", "apple"],
      ["Pear", "pear"],
      ["Peach", "peach"],
      ["Apricot", "apricot"],
      ["Orange", "orange"],
      ["Lemon", "lemon"],
      ["Grapefruit", "grapefruit"],
      ["Pineapple", "pineapple"],
      ["Tropical Fruit", "tropical-fruit"],
      ["Dates", "dates"],
      ["Dried Fruit", "dried-fruit"]
    ]
  },
  {
    name: "Floral & spice",
    notes: [
      ["Jasmine", "jasmine"],
      ["Rose", "rose"],
      ["Lavender", "lavender"],
      ["Black Tea", "black-tea"],
      ["Cinnamon", "cinnamon"],
      ["Clove", "clove"]
    ]
  }
]);

export const FLAVOR_NOTES = Object.freeze(
  FLAVOR_NOTE_CATEGORIES.flatMap(category => category.notes.map(([name, icon]) => ({
    name,
    icon,
    category: category.name
  })))
);

const NOTE_BY_NAME = new Map(FLAVOR_NOTES.map(note => [note.name.toLocaleLowerCase(), note]));

export function canonicalFlavorNoteName(value = "") {
  const trimmed = String(value).trim();
  return NOTE_BY_NAME.get(trimmed.toLocaleLowerCase())?.name || trimmed;
}

export function flavorNoteIcon(value = "") {
  return NOTE_BY_NAME.get(String(value).trim().toLocaleLowerCase())?.icon || "custom";
}

export function flavorNoteIconMarkup(value, className = "") {
  return iconMarkup(flavorNoteIcon(value), { group: "notes", className });
}

export function flavorNotePillMarkup(value, { removable = false } = {}) {
  const name = canonicalFlavorNoteName(value);
  const removeButton = removable
    ? `<button class="flavor-note-remove" type="button" data-remove-flavor-note="${escapeHtml(name)}" aria-label="Remove ${escapeHtml(name)}">×</button>`
    : "";
  return `<span class="flavor-note-pill">${flavorNoteIconMarkup(name)}<span>${escapeHtml(name)}</span>${removeButton}</span>`;
}
