# Dialed In

<p align="center">
  <img src="coffee-recipe-app/dialed_in/static/icons/icon.svg" alt="Dialed In Logo" width="180">
</p>

Dialed In is a self-hosted coffee companion for organizing coffee beans, method-specific brew recipes and long-term dial-in measurements. It runs in the browser, works across phones, tablets and desktops, and can be hosted on any suitable computer or server.

## Features

- Manage coffee beans with roaster, origin, blend, roast level, strength, acidity/bitterness, decaf status, flavor notes and reorder links
- Create separate recipes for espresso, V60, Pour Over, AeroPress, French Press, milk drinks and other brewing methods
- Run multi-step recipes in a guided brewing view with instructions and built-in timers
- Log brews with grind setting, dose, yield, time, taste, rating and notes
- Calculate grind recommendations based on previous measurements and the configured grinder range
- Configure grinder limits and espresso machine capabilities such as temperature, pressure and flow control
- Explore bean origins on an interactive world map
- Search, filter and favorite beans and recipes
- Import bean information from product links or barcodes
- Use light and dark themes with responsive layouts for desktop and mobile
- Export and restore all app data as a JSON backup

## Screenshots

<p align="center">
  <img src="assets/main.jpeg" alt="Dashboard" height="500">
  <img src="assets/recipes.jpeg" alt="Recipe overview" height="500">
  <img src="assets/new.jpeg" alt="Adding a new bean, recipe or measurement" height="500">
  <img src="assets/map.jpeg" alt="Coffee bean origin map" height="500">
</p>

## Getting started

Dialed In is not tied to a particular device or operating system. The simplest way to host it is with Docker, but it can also be started directly with Python.

### Docker Compose

From the `coffee-recipe-app` directory, run:

```bash
docker compose up -d --build
```

Then open:

```text
http://localhost:8080
```

When accessing Dialed In from another device, use the address or domain name of the computer hosting it.

To stop the application:

```bash
docker compose down
```

### Run with Python

From the `coffee-recipe-app` directory, create a virtual environment:

```bash
python -m venv .venv
```

Activate it:

```bash
# Linux / macOS
source .venv/bin/activate

# Windows PowerShell
.venv\Scripts\Activate.ps1
```

Install the requirements and start Dialed In:

```bash
pip install -r requirements.txt
python run.py
```

Open `http://localhost:8080` in a browser.

## Backups

Open **Settings** and select **Export JSON** to download a complete backup. Importing a backup replaces the beans, recipes, measurements and settings currently stored in the app, so creating a fresh export beforehand is recommended.

## Privacy and access

Dialed In has no built-in user accounts and is primarily intended for private, self-hosted use. When making it reachable outside a trusted network, place it behind appropriate authentication and a secure connection instead of exposing it directly.

## License

Creative Commons Attribution–NonCommercial 4.0

Full license text:  
https://creativecommons.org/licenses/by-nc/4.0/legalcode.txt
