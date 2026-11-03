import allSymbolsData from "./materialSymbolsList.json";

export interface MaterialSymbolItem {
  name: string;
  label: string;
  category?: string;
}

export const POPULAR_TRANSIT_SYMBOLS: MaterialSymbolItem[] = [
  { name: "directions_bus", label: "Bus", category: "Transit" },
  { name: "directions_bus_filled", label: "Bus (Filled)", category: "Transit" },
  { name: "train", label: "Train", category: "Transit" },
  { name: "tram", label: "Tram / Light Rail", category: "Transit" },
  { name: "subway", label: "Subway / Metro", category: "Transit" },
  { name: "flight", label: "Flight / Airplane", category: "Transit" },
  { name: "flight_takeoff", label: "Flight Departure", category: "Transit" },
  { name: "flight_land", label: "Flight Arrival", category: "Transit" },
  { name: "local_taxi", label: "Taxi / Cab", category: "Transit" },
  { name: "directions_car", label: "Car", category: "Transit" },
  { name: "electric_car", label: "Electric Car", category: "Transit" },
  { name: "electric_rickshaw", label: "Electric Rickshaw / Auto", category: "Transit" },
  { name: "two_wheeler", label: "Two Wheeler / Scooter", category: "Transit" },
  { name: "motorcycle", label: "Motorcycle", category: "Transit" },
  { name: "pedal_bike", label: "Bicycle", category: "Transit" },
  { name: "directions_boat", label: "Boat / Ferry", category: "Transit" },
  { name: "departure_board", label: "Departure Board", category: "Transit" },
  { name: "airport_shuttle", label: "Airport Shuttle", category: "Transit" },
  { name: "bus_alert", label: "Bus Alert", category: "Transit" },
  { name: "traffic", label: "Traffic Signal", category: "Transit" },
  { name: "commute", label: "Commute", category: "Transit" },

  // Navigation
  { name: "arrow_forward", label: "Forward Arrow", category: "Navigation" },
  { name: "arrow_back", label: "Back Arrow", category: "Navigation" },
  { name: "arrow_upward", label: "Up Arrow", category: "Navigation" },
  { name: "arrow_downward", label: "Down Arrow", category: "Navigation" },
  { name: "turn_right", label: "Turn Right", category: "Navigation" },
  { name: "turn_left", label: "Turn Left", category: "Navigation" },
  { name: "straight", label: "Straight Ahead", category: "Navigation" },
  { name: "u_turn_left", label: "U-Turn Left", category: "Navigation" },
  { name: "u_turn_right", label: "U-Turn Right", category: "Navigation" },
  { name: "roundabout_right", label: "Roundabout", category: "Navigation" },
  { name: "near_me", label: "Near Me", category: "Navigation" },
  { name: "navigation", label: "Navigation", category: "Navigation" },
  { name: "location_on", label: "Location Pin", category: "Navigation" },
  { name: "place", label: "Place", category: "Navigation" },
  { name: "explore", label: "Compass", category: "Navigation" },
  { name: "route", label: "Route", category: "Navigation" },
  { name: "map", label: "Map", category: "Navigation" },

  // Amenities
  { name: "wc", label: "Restroom / WC", category: "Amenities" },
  { name: "accessible", label: "Wheelchair Accessible", category: "Amenities" },
  { name: "local_hospital", label: "Hospital", category: "Amenities" },
  { name: "emergency", label: "Emergency Medical", category: "Amenities" },
  { name: "local_pharmacy", label: "Pharmacy", category: "Amenities" },
  { name: "restaurant", label: "Restaurant", category: "Amenities" },
  { name: "local_cafe", label: "Cafe / Coffee", category: "Amenities" },
  { name: "hotel", label: "Hotel / Lodging", category: "Amenities" },
  { name: "luggage", label: "Luggage", category: "Amenities" },
  { name: "baggage_claim", label: "Baggage Claim", category: "Amenities" },
  { name: "local_gas_station", label: "Fuel / Gas Station", category: "Amenities" },
  { name: "ev_station", label: "EV Station", category: "Amenities" },
  { name: "local_atm", label: "ATM / Cash", category: "Amenities" },
  { name: "wifi", label: "Wi-Fi", category: "Amenities" },
  { name: "power", label: "Power Outlet", category: "Amenities" },
  { name: "elevator", label: "Elevator / Lift", category: "Amenities" },
  { name: "escalator", label: "Escalator", category: "Amenities" },
  { name: "stairs", label: "Stairs", category: "Amenities" },
  { name: "smoke_free", label: "No Smoking", category: "Amenities" },

  // Alerts
  { name: "warning", label: "Warning Alert", category: "Alerts" },
  { name: "info", label: "Information", category: "Alerts" },
  { name: "priority_high", label: "Priority / Exclamation", category: "Alerts" },
  { name: "speed", label: "Speed Limit", category: "Alerts" },
  { name: "campaign", label: "Announcement", category: "Alerts" },
  { name: "notifications", label: "Notification Bell", category: "Alerts" },
  { name: "shield", label: "Security Shield", category: "Alerts" },

  // Places
  { name: "school", label: "School / College", category: "Places" },
  { name: "temple_hindu", label: "Hindu Temple", category: "Places" },
  { name: "temple_buddhist", label: "Buddhist Temple", category: "Places" },
  { name: "mosque", label: "Mosque", category: "Places" },
  { name: "church", label: "Church", category: "Places" },
  { name: "stadium", label: "Stadium", category: "Places" },
  { name: "shopping_cart", label: "Mall / Shopping", category: "Places" },
  { name: "park", label: "Park / Garden", category: "Places" },
  { name: "apartment", label: "IT Complex / Building", category: "Places" },
  { name: "account_balance", label: "Bank / Govt", category: "Places" },
];

// Helper to convert snake_case to Title Case
function formatSymbolLabel(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

// Full set of all 4,271 Material Symbols
export const ALL_MATERIAL_SYMBOLS: MaterialSymbolItem[] = (allSymbolsData as string[]).map(
  (name) => {
    const popular = POPULAR_TRANSIT_SYMBOLS.find((p) => p.name === name);
    if (popular) return popular;
    return {
      name,
      label: formatSymbolLabel(name),
      category: "Material Symbol",
    };
  }
);
