import json
import urllib.request

# Check what an asset collection looks like
url = "https://images-api.nasa.gov/search?q=mars+rover&media_type=image"

with urllib.request.urlopen(url) as res:
    data = json.loads(res.read())

item = data["collection"]["items"][0]
print("=== Item data ===")
print(json.dumps(item["data"][0], indent=2)[:300])
print("\n=== Links ===")
print(json.dumps(item.get("links", []), indent=2))

# Now fetch the asset collection for this item
nasa_id = item["data"][0]["nasa_id"]
asset_url = f"https://images-api.nasa.gov/asset/{nasa_id}"
print(f"\n=== Asset collection for {nasa_id} ===")
with urllib.request.urlopen(asset_url) as res:
    assets = json.loads(res.read())
    for a in assets["collection"]["items"]:
        print(a["href"])
