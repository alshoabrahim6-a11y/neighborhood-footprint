// Translation of pollution type codes (returned by the AI) into English labels
// and a distinct color for each type, used on the map and in the report result.
// Each type also has a "suggestion" — a short practical tip shown automatically
// with every report, so a report isn't just a dot on the map, but also gives
// the user a concrete next step they can take.
export const POLLUTION_TYPE_INFO = {
  garbage_burning: {
    label: 'Garbage Burning',
    color: '#7a2e2e',
    suggestion: 'Contact the local municipal fire and environment department — burning waste can cause air pollution and dangerous fires.',
  },
  air_pollution: {
    label: 'Air Pollution / Smoke',
    color: '#6b6b6b',
    suggestion: 'Contact the environment department or the responsible industrial facility, and avoid spending long periods in the area until air quality improves.',
  },
  illegal_dumping: {
    label: 'Illegal Dumping',
    color: '#8a6d3b',
    suggestion: 'Contact the local municipality to schedule waste removal, and avoid dumping additional waste at the same location.',
  },
  water_pollution: {
    label: 'Water Pollution',
    color: '#2e5f7a',
    suggestion: 'Avoid using water from this source directly, and contact the water and sanitation authority to check the cause.',
  },
  no_pollution: {
    label: 'No Pollution',
    color: '#2e7a3f',
    suggestion: 'No action needed — the situation looks normal at this location.',
  },
  unknown: {
    label: 'Unknown',
    color: '#999999',
    suggestion: "The system couldn't determine the pollution type with enough confidence — a manual review of the photo by the admin team is recommended.",
  },
};

export function getPollutionInfo(code) {
  return POLLUTION_TYPE_INFO[code] || POLLUTION_TYPE_INFO.unknown;
}
