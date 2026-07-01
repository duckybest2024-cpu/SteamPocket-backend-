import { floatFromSeed } from "../lib/provablyFair";

export type WheelRisk = "low" | "medium" | "high";

export interface WheelSegment {
  multiplier: number;
  weight: number;
}

// Weights/multipliers are tuned so each risk level pays out UNDER 100% on
// average (a house edge), instead of the old values that returned 180–814%
// and let players mint chips. RTP per level: low ~0.97, medium ~0.97, high ~0.94.
const SEGMENTS: Record<WheelRisk, WheelSegment[]> = {
  low: [
    { multiplier: 0,    weight: 33 },
    { multiplier: 1.2,  weight: 35 },
    { multiplier: 1.5,  weight: 22 },
    { multiplier: 2,    weight: 8  },
    { multiplier: 3,    weight: 2  },
  ],
  medium: [
    { multiplier: 0,    weight: 57 },
    { multiplier: 1.5,  weight: 22 },
    { multiplier: 2,    weight: 12 },
    { multiplier: 3,    weight: 5  },
    { multiplier: 5,    weight: 3  },
    { multiplier: 10,   weight: 1  },
  ],
  high: [
    { multiplier: 0,    weight: 880 },
    { multiplier: 2,    weight: 65  },
    { multiplier: 5,    weight: 30  },
    { multiplier: 10,   weight: 15  },
    { multiplier: 30,   weight: 7   },
    { multiplier: 100,  weight: 3   },
  ],
};

export interface WheelResult {
  risk: WheelRisk;
  segments: WheelSegment[];
  landedIndex: number;
  multiplier: number;
}

export function spinWheel(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  risk: WheelRisk
): WheelResult {
  const segments = SEGMENTS[risk];
  const totalWeight = segments.reduce((sum, s) => sum + s.weight, 0);
  const float = floatFromSeed(serverSeed, clientSeed, nonce);

  let cumulative = 0;
  const target = float * totalWeight;
  let landedIndex = segments.length - 1;

  for (let i = 0; i < segments.length; i++) {
    cumulative += segments[i].weight;
    if (target < cumulative) {
      landedIndex = i;
      break;
    }
  }

  return {
    risk,
    segments,
    landedIndex,
    multiplier: segments[landedIndex].multiplier,
  };
}

export function validateWheel(risk: string): string | null {
  if (!["low", "medium", "high"].includes(risk)) {
    return 'risk must be "low", "medium", or "high"';
  }
  return null;
}
